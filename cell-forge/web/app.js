import { initialRun } from '../src/rules.js';
import { craftChoice } from '../src/session.js';

const $ = (selector) => document.querySelector(selector);
let run;
let selected;
let history;
let closed;

function reset() {
  run = initialRun('practice', 'you');
  selected = [];
  history = [];
  closed = false;
  $('#feedback').textContent = 'Select Ore and Coal to begin.';
  render();
}

function render() {
  const turn = run.live.find((cell) => cell.kind === 'State')?.turn ?? 2;
  $('#turn').textContent = closed ? 'RUN CLOSED' : `TURN ${turn} / 2`;
  $('#instruction').textContent = closed ? 'The practice run is closed. Start again to play another.' : run.complete ? 'Pickaxe forged. Close the run to spend the remaining game Cells.' : 'Select two ingredient Cells below. The State Cell is included automatically.';
  $('#cells').replaceChildren(...run.live.map((cell) => {
    const button = document.createElement('button');
    const isState = cell.kind === 'State';
    button.type = 'button';
    button.className = `cell ${isState ? 'state' : ''} ${selected.includes(cell.id) ? 'selected' : ''}`;
    button.disabled = isState || closed || run.complete;
    button.setAttribute('aria-pressed', String(selected.includes(cell.id)));
    button.setAttribute('aria-label', `${cell.kind}, ${cell.units} game unit${cell.units === 1 ? '' : 's'}${isState ? ', run state' : ''}`);
    button.innerHTML = `<span class="cell-marker" aria-hidden="true">${{ State: '◇', Ore: '◆', Coal: '◼', Wood: '╱', Bar: '▰', Pickaxe: '⚒' }[cell.kind]}</span><span class="cell-name">${cell.kind}</span><span class="cell-meta">${isState ? `TURN ${cell.turn}` : `${cell.units} GAME UNIT${cell.units === 1 ? '' : 'S'}`}</span>`;
    if (!isState) button.addEventListener('click', () => toggle(cell.id));
    return button;
  }));
  $('#craft').hidden = closed || Boolean(run.complete);
  $('#close').hidden = !run.complete || closed;
  $('#craft').disabled = selected.length !== 2;
  $('#craft').textContent = selected.length === 2 ? 'Forge selected cells →' : `Choose ${2 - selected.length} ingredient${selected.length === 1 ? '' : 's'}`;
  $('#history').replaceChildren(...history.map((entry) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>${entry.label}</span><small>${entry.detail}</small>`;
    return item;
  }));
  if (!history.length) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = 'No Cells spent yet. Your first move will appear here.';
    $('#history').append(item);
  }
}

function toggle(id) {
  selected = selected.includes(id) ? selected.filter((value) => value !== id) : selected.length < 2 ? [...selected, id] : [selected[1], id];
  $('#feedback').textContent = selected.length === 2 ? 'Ready to check this recipe.' : 'Choose one more ingredient Cell.';
  render();
}

$('#craft').addEventListener('click', () => {
  try {
    const { proposal, next } = craftChoice(run, selected);
    const ingredients = selected.map((id) => run.live.find((cell) => cell.id === id).kind);
    const product = next.live.find((cell) => cell.id === proposal.outputs[1].id);
    history.push({ label: `Turn ${product.id.split('-')[1]} · ${proposal.recipe}`, detail: `Spent State + ${ingredients.join(' + ')} → new State + ${product.kind} (${product.units} units)` });
    run = next;
    selected = [];
    $('#feedback').textContent = `${product.kind} forged. The old Cells were spent and new Cells created.`;
    render();
  } catch (error) {
    $('#feedback').textContent = error.message;
  }
});

$('#close').addEventListener('click', () => {
  if (!run.complete || run.live.map((cell) => cell.kind).sort().join(',') !== 'Pickaxe,State') return;
  history.push({ label: 'Run closed', detail: 'Spent State + Pickaxe. Practice Cells removed.' });
  run = { ...run, live: [] };
  closed = true;
  $('#feedback').textContent = 'Run closed. This was a browser simulation, not a submitted transaction.';
  render();
});
$('#reset').addEventListener('click', reset);
reset();
