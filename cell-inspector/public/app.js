const sampleHash = '0x4cb3fa63b7d26991231f18ccd850142e08c6f5a6fcb8010c1143cea267807928';
const $ = (id) => document.getElementById(id);
const form = $('lookup-form');
const hashInput = $('hash');
const networkInput = $('network');
const clearButton = $('clear-hash');
const errorText = $('hash-error');
const inspectButton = $('inspect-button');
const region = $('result-region');
let activeRequest = null;

function ckb(shannons) {
  if (shannons == null) return 'Unknown';
  const value = BigInt(shannons);
  const whole = value / 100000000n;
  const fraction = (value % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
  return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} CKB`;
}

function shortHash(hash) {
  return hash ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : 'Unknown';
}

function showError(message, field = false) {
  errorText.textContent = message;
  errorText.hidden = false;
  hashInput.setAttribute('aria-invalid', String(field));
  if (field) hashInput.focus();
}

function clearError() {
  errorText.textContent = '';
  errorText.hidden = true;
  hashInput.removeAttribute('aria-invalid');
}

function setMode(mode) {
  $('empty-state').hidden = mode !== 'empty';
  $('loading-state').hidden = mode !== 'loading';
  $('result').hidden = mode !== 'result';
  region.setAttribute('aria-busy', String(mode === 'loading'));
  inspectButton.disabled = mode === 'loading';
  inspectButton.textContent = mode === 'loading' ? 'Inspecting…' : 'Inspect transaction';
}

function makeCell(item, direction) {
  const li = document.createElement('li');
  li.className = 'cell-card';
  const top = document.createElement('div');
  top.className = 'cell-card-top';
  const number = document.createElement('span');
  number.className = 'cell-number';
  number.textContent = `${direction} ${item.index}`;
  const amount = document.createElement('strong');
  amount.textContent = ckb(item.capacity);
  top.append(number, amount);
  const lock = document.createElement('p');
  lock.className = 'cell-meta';
  lock.textContent = `Lock · ${shortHash(item.lockHash)}`;
  const type = document.createElement('p');
  type.className = 'cell-meta';
  type.textContent = item.typeHash ? `Type · ${shortHash(item.typeHash)}` : 'No type script';
  const data = document.createElement('p');
  data.className = 'cell-data';
  data.textContent = item.dataBytes == null ? 'Previous Cell unavailable' : `${item.dataBytes} data bytes`;
  li.append(top, lock, type, data);
  return li;
}

function render(data) {
  $('result-title').textContent = shortHash(data.hash);
  $('result-title').title = data.hash;
  $('result-status').textContent = `${data.network} · ${data.status}`;
  $('input-total').textContent = ckb(data.inputTotal);
  $('output-total').textContent = ckb(data.outputTotal);
  $('fee-line').textContent = data.fee == null ? 'Fee unavailable because one or more previous Cells could not be loaded.' : `${ckb(data.fee)} left as the transaction fee`;
  const input = data.inputTotal == null ? 0n : BigInt(data.inputTotal);
  const output = BigInt(data.outputTotal);
  $('flow-fill').style.width = input > 0n ? `${Math.max(0, Math.min(100, Number(output * 10000n / input) / 100))}%` : '0%';
  $('input-count').textContent = `${data.inputs.length} ${data.inputs.length === 1 ? 'input' : 'inputs'}`;
  $('output-count').textContent = `${data.outputs.length} ${data.outputs.length === 1 ? 'output' : 'outputs'}`;
  $('inputs-list').replaceChildren(...data.inputs.map((item) => makeCell(item, 'Input')));
  $('outputs-list').replaceChildren(...data.outputs.map((item) => makeCell(item, 'Output')));
  const partial = $('partial-note');
  partial.hidden = data.unresolved === 0;
  partial.textContent = data.unresolved ? `${data.unresolved} previous Cell${data.unresolved === 1 ? '' : 's'} could not be loaded, so the input total and fee are incomplete.` : '';
  setMode('result');
}

async function inspect() {
  const hash = hashInput.value.trim();
  clearError();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    showError('Enter a transaction hash starting with 0x, followed by 64 hex characters.', true);
    return;
  }
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  setMode('loading');
  try {
    const query = new URLSearchParams({ hash, network: networkInput.value });
    const response = await fetch(`/api/inspect?${query}`, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not read this transaction.');
    if (controller !== activeRequest) return;
    render(data);
  } catch (error) {
    if (error.name === 'AbortError') return;
    setMode('empty');
    showError(error.message || 'Could not read this transaction. Try again.');
  } finally {
    if (controller === activeRequest) activeRequest = null;
  }
}

form.addEventListener('submit', (event) => { event.preventDefault(); inspect(); });
hashInput.addEventListener('input', () => { clearButton.hidden = hashInput.value.length === 0; clearError(); });
clearButton.addEventListener('click', () => {
  activeRequest?.abort();
  activeRequest = null;
  hashInput.value = '';
  clearButton.hidden = true;
  clearError();
  setMode('empty');
  hashInput.focus();
});
$('sample-button').addEventListener('click', () => {
  networkInput.value = 'testnet';
  hashInput.value = sampleHash;
  clearButton.hidden = false;
  inspect();
});
if (new URLSearchParams(location.search).get('sample') === '1') $('sample-button').click();
