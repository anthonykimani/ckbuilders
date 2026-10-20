// Public-testnet deployment and end-to-end check for Living Passport.
//
//   node scripts/testnet.mjs keys     create/show the disposable testnet keys and balances
//   node scripts/testnet.mjs deploy   publish the Rust Type Script as a code Cell
//   node scripts/testnet.mjs e2e      create → two-signer repair → transfer → close
//
// Keys live in .deploy/testnet-keys.json (gitignored, mode 600). They are throwaway
// testnet keys: never fund them with anything but faucet CKB.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ClientPublicTestnet, SignerCkbPrivateKey, Transaction, fixedPointToString, hashCkb, hexFrom } from '@ckb-ccc/core';
import { createPassport, transferPassport, closePassport } from '../src/public-actions.js';
import { loadPassport } from '../src/public-chain.js';
import { draftRepair, encodeRequest, decodeRequest, approveRepair } from '../src/public-repair.js';

const root = new URL('../', import.meta.url);
const keysFile = new URL('.deploy/testnet-keys.json', root);
const deploymentFile = new URL('public-web/deployment.testnet.json', root);
const binary = readFileSync(new URL('rust-contract/target/riscv64imac-unknown-none-elf/release/living-passport-type', root));
const ROLES = ['deployer', 'owner', 'workshop', 'buyer'];
const ckb = (shannons) => `${fixedPointToString(shannons)} CKB`;

const RPC = 'https://testnet.ckb.dev/';
const client = new ClientPublicTestnet({ url: RPC });

async function assertTestnet() {
  const info = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_blockchain_info', params: [] }) }).then((r) => r.json());
  if (info.result?.chain !== 'ckb_testnet') throw new Error(`Refusing to run outside ckb_testnet (got ${info.result?.chain}).`);
}

function loadKeys() {
  if (!existsSync(keysFile)) {
    mkdirSync(new URL('.deploy/', root), { recursive: true });
    const keys = Object.fromEntries(ROLES.map((role) => [role, hexFrom(randomBytes(32))]));
    writeFileSync(keysFile, JSON.stringify(keys, null, 2), { mode: 0o600 });
  }
  const keys = JSON.parse(readFileSync(keysFile, 'utf8'));
  return Object.fromEntries(ROLES.map((role) => [role, new SignerCkbPrivateKey(client, keys[role])]));
}

async function balance(signer) {
  return client.getBalance([(await signer.getRecommendedAddressObj()).script]);
}

async function send(signer, outputs) {
  const tx = Transaction.from({ outputs: outputs.map(([lock, capacity]) => ({ lock, capacity })), outputsData: outputs.map(() => '0x') });
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer);
  const hash = await signer.sendTransaction(tx);
  await client.waitTransaction(hash, 0, 180000, 3000);
  return hash;
}

const deployCost = BigInt(binary.length + 61 + 1) * 100_000_000n; // data + 61-byte secp cell
const roleFunding = { owner: 800_00000000n, workshop: 300_00000000n, buyer: 100_00000000n };

async function keys(signers) {
  const needed = deployCost + Object.values(roleFunding).reduce((a, b) => a + b, 0n) + 100_00000000n;
  for (const role of ROLES) {
    console.log(`${role.padEnd(9)} ${await signers[role].getRecommendedAddress()}  ${ckb(await balance(signers[role]))}`);
  }
  console.log(`\nContract binary: ${binary.length} bytes → about ${ckb(deployCost)} of capacity.`);
  console.log(`Fund only the deployer with at least ${ckb(needed)} from https://faucet.nervos.org/ ; it pays the other roles.`);
}

async function deploy(signers) {
  if (existsSync(deploymentFile)) {
    const current = JSON.parse(readFileSync(deploymentFile, 'utf8'));
    if (current.codeHash === hashCkb(binary)) { console.log(`Already deployed: ${current.txHash}`); return; }
    if (current.txHash) console.log(`Binary changed since ${current.txHash}; deploying a new version.`);
  }
  const deployer = signers.deployer;
  const lock = (await deployer.getRecommendedAddressObj()).script;
  const tx = Transaction.from({ outputs: [{ lock }], outputsData: [hexFrom(binary)] });
  await tx.completeInputsByCapacity(deployer);
  await tx.completeFeeBy(deployer);
  const txHash = await deployer.sendTransaction(tx);
  console.log(`Deploy submitted: ${txHash}`);
  await client.waitTransaction(txHash, 1, 300000, 3000);
  const record = { network: 'ckb_testnet', codeHash: hashCkb(binary), hashType: 'data2', txHash, index: 0, binaryBytes: binary.length, deployedAt: new Date().toISOString() };
  writeFileSync(deploymentFile, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`Deployed. Code hash ${record.codeHash}; record written to public-web/deployment.testnet.json`);
}

async function e2e(signers) {
  const deployment = JSON.parse(readFileSync(deploymentFile, 'utf8'));
  if (deployment.codeHash !== hashCkb(binary)) throw new Error('Local binary differs from the deployed one. Run deploy first.');
  const topUp = [];
  for (const [role, amount] of Object.entries(roleFunding)) {
    if (await balance(signers[role]) < amount / 2n) topUp.push([(await signers[role].getRecommendedAddressObj()).script, amount]);
  }
  if (topUp.length) console.log(`funding roles: ${await send(signers.deployer, topUp)}`);
  const workshopAddress = await signers.workshop.getRecommendedAddress();
  const buyerAddress = await signers.buyer.getRecommendedAddress();

  const created = await createPassport(signers.owner, deployment, { model: 'ThinkPad T480 (testnet e2e)', owner: 'Owner A', workshopAddress });
  console.log(`create   ${created.txHash}\n         passport ${created.args}`);
  let passport = await loadPassport(client, deployment, created.args);

  const request = await draftRepair(signers.workshop, deployment, passport, 'Replaced battery; charging port checked');
  const link = await encodeRequest(request);
  console.log(`repair   workshop-signed draft ${request.tx.hash()} (${link.length}-char link)`);
  const workshopOnly = await client.sendTransaction(request.tx).then((hash) => hash, (error) => error);
  if (!(workshopOnly instanceof Error)) throw new Error(`Node accepted a repair without the owner's signature: ${workshopOnly}`);
  console.log(`         node rejected workshop-only submission as expected (${String(workshopOnly.message).split('\n')[0].slice(0, 90)})`);
  const repairHash = await approveRepair(signers.owner, deployment, await decodeRequest(link));
  console.log(`         owner co-signed and submitted ${repairHash}`);
  passport = await loadPassport(client, deployment, created.args);

  const transferHash = await transferPassport(signers.owner, deployment, passport, { recipientAddress: buyerAddress, note: 'Sold to buyer after repair' });
  console.log(`transfer ${transferHash}`);
  passport = await loadPassport(client, deployment, created.args);
  console.log(`history  ${passport.events.map((e) => `#${e.sequence} ${['create', 'repair', 'transfer'][e.action]}: ${e.detail}`).join(' | ')}`);

  const before = await balance(signers.buyer);
  const closeHash = await closePassport(signers.buyer, deployment, passport);
  console.log(`close    ${closeHash} (buyer balance ${ckb(before)} → ${ckb(await balance(signers.buyer))})`);
  if (await loadPassport(client, deployment, created.args)) throw new Error('Passport still live after close.');
}

// Leaves a live passport with one approved repair and prints a second, pending repair link.
async function demo(signers) {
  const deployment = JSON.parse(readFileSync(deploymentFile, 'utf8'));
  if (await balance(signers.owner) < 700_00000000n) console.log(`funding owner: ${await send(signers.deployer, [[(await signers.owner.getRecommendedAddressObj()).script, 800_00000000n]])}`);
  const created = await createPassport(signers.owner, deployment, { model: 'Dell Latitude 5490', owner: 'Demo owner', workshopAddress: await signers.workshop.getRecommendedAddress() });
  let passport = await loadPassport(client, deployment, created.args);
  await approveRepair(signers.owner, deployment, await draftRepair(signers.workshop, deployment, passport, 'Replaced keyboard and cleaned cooling fan'));
  passport = await loadPassport(client, deployment, created.args);
  const pending = await encodeRequest(await draftRepair(signers.workshop, deployment, passport, 'Fitted new 240 GB SSD, reinstalled OS'));
  console.log(`passport ?passport=${created.args}`);
  console.log(`pending  #repair=${pending}`);
}

const command = process.argv[2];
const actions = { keys, deploy, e2e, demo };
if (!actions[command]) { console.error('Usage: node scripts/testnet.mjs keys|deploy|e2e|demo'); process.exit(1); }
try {
  await assertTestnet();
  await actions[command](loadKeys());
} catch (error) {
  console.error(`FAILED: ${error?.message ?? error}`);
  console.error(String(error?.stack ?? '').split('\n').slice(1, 6).map((line) => line.slice(0, 160)).join('\n'));
  process.exit(1);
}
