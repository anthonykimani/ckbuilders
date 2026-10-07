import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import {
  Cell, CellInput, ClientPublicTestnet, OutPoint, Script, SignerCkbPrivateKey,
  Transaction, hashCkb, hexFrom,
} from '@ckb-ccc/core';
import { CAPACITY, encodeRecord } from './chain-codec.js';

const secp = {
  codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
  hashType: 'type',
  cellDeps: [{ cellDep: {
    outPoint: { txHash: '0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293', index: 0 },
    depType: 'depGroup',
  } }],
};
const text = (value, max) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || Buffer.byteLength(trimmed, 'utf8') > max) throw new Error(`Enter 1–${max} UTF-8 bytes of text.`);
  return trimmed;
};
const raw = (hex) => Buffer.from(hex.slice(2), 'hex');

export class LocalDevnetPassport {
  constructor({ rpcUrl, keysFile, deploymentFile, stateFile }) {
    const url = new URL(rpcUrl);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local devnet RPC only.');
    this.rpcUrl = rpcUrl;
    this.stateFile = stateFile;
    const keys = readFileSync(keysFile, 'utf8').trim().split(/\r?\n/).slice(0, 3).map((key) => `0x${key.trim().replace(/^0x/, '')}`);
    if (keys.length !== 3 || keys.some((key) => !/^0x[0-9a-fA-F]{64}$/.test(key))) throw new Error('Expected three disposable devnet keys.');
    this.deployment = JSON.parse(readFileSync(deploymentFile, 'utf8')).devnet?.['living-passport-type'];
    if (!this.deployment?.codeHash || this.deployment.cellDeps?.length !== 1) throw new Error('Missing passport deployment.');
    const defaults = new ClientPublicTestnet({ url: rpcUrl, fallbacks: [] });
    this.client = new ClientPublicTestnet({ url: rpcUrl, fallbacks: [], scripts: { ...defaults.scripts, Secp256k1Blake160: secp } });
    this.signers = keys.map((key) => new SignerCkbPrivateKey(this.client, key));
    this.state = null;
  }

  async init() {
    const response = await fetch(this.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_blockchain_info', params: [] }) });
    const info = await response.json();
    if (!response.ok || info.error || !String(info.result?.chain ?? '').includes('dev')) throw new Error('Refusing to sign outside a CKB dev chain.');
    this.locks = await Promise.all(this.signers.map(async (signer) => (await signer.getRecommendedAddressObj()).script));
    if (this.locks.some((lock) => lock.codeHash !== secp.codeHash)) throw new Error('Unexpected devnet Lock script.');
    if (this.stateFile && existsSync(this.stateFile)) {
      const saved = JSON.parse(readFileSync(this.stateFile, 'utf8'));
      const response = await fetch(this.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'get_transaction', params: [saved.state.txHash] }) });
      const transaction = (await response.json()).result;
      if (transaction?.tx_status?.status !== 'committed' || transaction.transaction.outputs_data[0] !== saved.state.record.data) throw new Error('Saved passport does not match the local chain.');
      this.state = { ...saved.state, type: Script.from(saved.state.type) };
      this.workshopCell = Cell.from({ outPoint: OutPoint.from({ txHash: saved.workshopTxHash, index: saved.workshopIndex }), cellOutput: { lock: this.locks[1], capacity: 10_000_000_000n }, outputData: '0x' });
    }
    return this;
  }

  persist() {
    if (!this.stateFile) return;
    const saved = { state: { ...this.state, type: { codeHash: this.state.type.codeHash, hashType: this.state.type.hashType, args: this.state.type.args } }, workshopTxHash: this.workshopCell.outPoint.txHash, workshopIndex: Number(this.workshopCell.outPoint.index) };
    writeFileSync(this.stateFile, JSON.stringify(saved), { mode: 0o600 });
  }

  async pureCell(signer, minimum) {
    for await (const cell of signer.findCells({ scriptLenRange: [0, 1], outputDataLenRange: [0, 1] }, true, 'asc', 1)) {
      if (cell.cellOutput.capacity >= minimum) return cell;
    }
    throw new Error('No sufficiently funded disposable devnet Cell.');
  }

  addInput(tx, cell) {
    tx.inputs.push(CellInput.from({ previousOutput: cell.outPoint, cellOutput: cell.cellOutput, outputData: cell.outputData }));
  }

  async send(tx, ownerSigner = this.signers[0], additionalSigner) {
    tx.cellDeps.push(this.deployment.cellDeps[0].cellDep);
    // The attester's signature increases witness size after the owner's fee estimate.
    await tx.completeFeeBy(ownerSigner, 3000);
    const ownerSigned = await ownerSigner.signTransaction(tx);
    const signed = additionalSigner ? await additionalSigner.signTransaction(ownerSigned) : ownerSigned;
    const hash = await this.client.sendTransaction(signed);
    const committed = await this.client.waitTransaction(hash, 0, 120000, 2000);
    if (!committed) throw new Error(`Transaction ${hash} was submitted but not confirmed; inspect the node before retrying.`);
    return hash;
  }

  cell(hash, type, record, lock = this.locks[0]) {
    return Cell.from({ outPoint: OutPoint.from({ txHash: hash, index: 0 }), cellOutput: { lock, type, capacity: CAPACITY }, outputData: record.data });
  }

  async fundWorkshop() {
    if (this.workshopCell) return this.workshopCell;
    const tx = Transaction.default();
    tx.addOutput({ lock: this.locks[1], capacity: 10_000_000_000n }, '0x');
    tx.addOutput({ lock: this.locks[2], capacity: 10_000_000_000n }, '0x');
    await tx.completeInputsByCapacity(this.signers[0]);
    await tx.completeFeeBy(this.signers[0], 1000);
    const hash = await this.signers[0].sendTransaction(tx);
    const committed = await this.client.waitTransaction(hash, 0, 120000, 2000);
    if (!committed) throw new Error(`Workshop funding was submitted but not confirmed: ${hash}`);
    this.workshopCell = Cell.from({ outPoint: OutPoint.from({ txHash: hash, index: 0 }), cellOutput: { lock: this.locks[1], capacity: 10_000_000_000n }, outputData: '0x' });
    return this.workshopCell;
  }

  async create(input) {
    if (this.state) throw new Error('This local chain session already has a passport. Restart with a fresh state to create another.');
    const model = text(input.model, 80);
    const owner = text(input.owner, 60);
    const repairer = text(input.repairer, 60);
    await this.fundWorkshop();
    const funding = await this.pureCell(this.signers[0], CAPACITY + 100_000_000n);
    const itemId = hashCkb(Buffer.concat([Buffer.from(funding.outPoint.toBytes()), randomBytes(16)]));
    const type = Script.from({ codeHash: this.deployment.codeHash, hashType: this.deployment.hashType, args: hexFrom(Buffer.concat([Buffer.from(funding.outPoint.toBytes()), raw(this.locks[1].hash())])) });
    const record = encodeRecord({ action: 0, sequence: 0, itemId, previousRoot: itemId, actorHash: this.locks[0].hash(), recipientHash: this.locks[0].hash(), detail: `${model} / ${owner}` });
    const tx = Transaction.default();
    this.addInput(tx, funding);
    tx.addOutput({ lock: this.locks[0], type, capacity: CAPACITY }, record.data);
    const txHash = await this.send(tx);
    this.state = { itemId, model, owner, repairer, ownerIndex: 0, sequence: 0, historyRoot: record.historyRoot, type, record, txHash, events: [{ action: 'mint', model, owner, repairer, sequence: 0, eventHash: record.eventHash, historyRoot: record.historyRoot, txHash, actorHash: record.actorHash, recipientHash: record.recipientHash }] };
    this.persist();
    return this.publicState();
  }

  async repair(input) {
    if (!this.state) throw new Error('Create a passport first.');
    const detail = text(input.detail, 160);
    const workshop = text(input.workshop, 60);
    if (workshop !== this.state.repairer) throw new Error('Use the configured workshop label.');
    const old = this.state;
    const record = encodeRecord({ action: 1, sequence: old.sequence + 1, itemId: old.itemId, previousRoot: old.historyRoot, actorHash: this.locks[1].hash(), recipientHash: this.locks[old.ownerIndex].hash(), detail });
    const tx = Transaction.default();
    this.addInput(tx, this.cell(old.txHash, old.type, old.record, this.locks[old.ownerIndex]));
    this.addInput(tx, this.workshopCell);
    tx.addOutput({ lock: this.locks[old.ownerIndex], type: old.type, capacity: CAPACITY }, record.data);
    tx.addOutput({ lock: this.locks[1], capacity: 10_000_000_000n }, '0x');
    const txHash = await this.send(tx, this.signers[old.ownerIndex], this.signers[1]);
    this.workshopCell = Cell.from({ outPoint: OutPoint.from({ txHash, index: 1 }), cellOutput: { lock: this.locks[1], capacity: 10_000_000_000n }, outputData: '0x' });
    this.state = { ...old, sequence: record.sequence, historyRoot: record.historyRoot, record, txHash, events: [...old.events, { action: 'repair', workshop, detail, sequence: record.sequence, eventHash: record.eventHash, historyRoot: record.historyRoot, txHash, actorHash: record.actorHash, recipientHash: record.recipientHash }] };
    this.persist();
    return this.publicState();
  }

  async transfer(input) {
    if (!this.state) throw new Error('Create a passport first.');
    const nextOwner = text(input.nextOwner, 60);
    if (nextOwner === this.state.owner) throw new Error('Choose a different owner label.');
    const old = this.state;
    const nextIndex = old.ownerIndex === 0 ? 2 : 0;
    const record = encodeRecord({ action: 2, sequence: old.sequence + 1, itemId: old.itemId, previousRoot: old.historyRoot, actorHash: this.locks[old.ownerIndex].hash(), recipientHash: this.locks[nextIndex].hash(), detail: `Transferred to ${nextOwner}` });
    const tx = Transaction.default();
    this.addInput(tx, this.cell(old.txHash, old.type, old.record, this.locks[old.ownerIndex]));
    tx.addOutput({ lock: this.locks[nextIndex], type: old.type, capacity: CAPACITY }, record.data);
    const txHash = await this.send(tx, this.signers[old.ownerIndex]);
    this.state = { ...old, owner: nextOwner, ownerIndex: nextIndex, sequence: record.sequence, historyRoot: record.historyRoot, record, txHash, events: [...old.events, { action: 'transfer', from: old.owner, to: nextOwner, sequence: record.sequence, eventHash: record.eventHash, historyRoot: record.historyRoot, txHash, actorHash: record.actorHash, recipientHash: record.recipientHash }] };
    this.persist();
    return this.publicState();
  }

  publicState() {
    if (!this.state) return null;
    const { type, record, ...publicData } = this.state;
    return { ...publicData, typeHash: type.hash(), ownerLockHash: record.recipientHash, chain: 'local CKB devnet' };
  }
}
