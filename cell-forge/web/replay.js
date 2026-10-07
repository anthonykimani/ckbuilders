import { replayStep, replaySteps, smeltReplay } from './replay-data.js';

const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let step = 0;
let timer = null;

function makeCell(cell, side) {
  const item = document.createElement('div');
  item.className = 'trace-cell';
  item.dataset.kind = cell.kind.toLowerCase();
  const symbol = document.createElement('span');
  symbol.className = 'trace-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = { State: '◇', Ore: '◆', Coal: '■', Bar: '▰' }[cell.kind];
  const name = document.createElement('strong');
  name.textContent = cell.kind;
  const facts = document.createElement('span');
  facts.className = 'trace-facts';
  facts.textContent = `${cell.capacity} CKB · ${cell.units} GAME UNIT${cell.units === 1 ? '' : 'S'}${cell.kind === 'State' ? ` · TURN ${cell.turn}` : ''}`;
  const outpoint = document.createElement('code');
  outpoint.textContent = `${side === 'input' ? 'START' : 'SMELT'} #${cell.outpointIndex}`;
  item.append(symbol, name, facts, outpoint);
  return item;
}

$('#inputs').replaceChildren(...smeltReplay.inputs.map((cell) => makeCell(cell, 'input')));
$('#outputs').replaceChildren(...smeltReplay.outputs.map((cell) => makeCell(cell, 'output')));
$('#tx-hash').textContent = smeltReplay.hash;
$('#source-detail').textContent = smeltReplay.source;

function pause() {
  if (timer) clearInterval(timer);
  timer = null;
  $('#play').textContent = 'Play replay';
  $('#play').setAttribute('aria-pressed', 'false');
}

function setStep(value) {
  step = Math.max(0, Math.min(replaySteps.length - 1, Number(value)));
  const current = replayStep(step);
  $('#theatre').dataset.step = String(step);
  $('#stage-count').textContent = `${String(step + 1).padStart(2, '0')} / 04`;
  $('#step-label').textContent = current.label;
  $('#step-title').textContent = current.title;
  $('#step-detail').textContent = current.detail;
  $('#timeline').value = String(step);
  $('#previous').disabled = step === 0;
  $('#next').disabled = step === replaySteps.length - 1;
  const url = new URL(location.href);
  url.searchParams.set('step', String(step));
  history.replaceState(null, '', url);
}

$('#previous').addEventListener('click', () => { pause(); setStep(step - 1); });
$('#next').addEventListener('click', () => { pause(); setStep(step + 1); });
$('#timeline').addEventListener('input', (event) => { pause(); setStep(event.target.value); });
$('#play').addEventListener('click', () => {
  if (timer) { pause(); return; }
  if (step === replaySteps.length - 1) setStep(0);
  $('#play').textContent = 'Pause replay';
  $('#play').setAttribute('aria-pressed', 'true');
  timer = setInterval(() => {
    if (step === replaySteps.length - 1) { pause(); return; }
    setStep(step + 1);
    if (step === replaySteps.length - 1) pause();
  }, reducedMotion.matches ? 2400 : 1800);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
const hasStep = new URLSearchParams(location.search).has('step');
const requested = Number(new URLSearchParams(location.search).get('step') || 0);
setStep(Number.isInteger(requested) ? requested : 0);
if (!hasStep && !reducedMotion.matches) {
  setTimeout(() => { if (!document.hidden && step === 0 && !timer) $('#play').click(); }, 700);
}
