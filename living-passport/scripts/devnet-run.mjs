import { LocalDevnetPassport } from '../src/devnet.js';

const app = await new LocalDevnetPassport({
  rpcUrl: process.env.PASSPORT_DEVNET_RPC ?? 'http://127.0.0.1:8114',
  keysFile: process.env.PASSPORT_DEVNET_KEYS,
  deploymentFile: process.env.PASSPORT_DEVNET_DEPLOYMENT,
}).init();

for (const [name, action, input] of [
  ['mint', 'create', { model: 'ThinkPad T480', owner: 'Amina', repairer: 'Bench 01' }],
  ['repair', 'repair', { detail: 'Replaced battery and checked charging port', workshop: 'Bench 01' }],
  ['transfer', 'transfer', { nextOwner: 'Brian' }],
  ['repair after transfer', 'repair', { detail: 'Cleaned cooling fan', workshop: 'Bench 01' }],
  ['return transfer', 'transfer', { nextOwner: 'Amina' }],
]) {
  const state = await app[action](input);
  console.log(`${name}: committed ${state.txHash}; sequence ${state.sequence}; root ${state.historyRoot}`);
}
