import { createInterface } from 'node:readline/promises';
import { initialRun } from './rules.js';
import { craftChoice } from './session.js';

const terminal = createInterface({ input: process.stdin, output: process.stdout });
let run = initialRun('local-practice', 'you');

console.log('Cell Forge — local practice (no wallet or blockchain transaction)');
console.log('Make a Pickaxe in two turns. Each turn consumes a State Cell and two ingredients.');

function prompt() {
  console.log('\nLive Cells:');
  for (const cell of run.live) {
    console.log(`  ${cell.id.padEnd(12)} ${cell.kind.padEnd(8)} ${cell.units} unit${cell.units === 1 ? '' : 's'}`);
  }
  process.stdout.write('Choose two ingredient Cell IDs, or q to quit: ');
}

prompt();
for await (const raw of terminal) {
  const answer = raw.trim();
  if (answer.toLowerCase() === 'q') break;
  try {
    const { proposal, next } = craftChoice(run, answer.split(/\s+/));
    console.log(`Spent: ${proposal.inputs.join(' + ')}`);
    console.log(`Created: ${proposal.outputs.map((cell) => cell.id).join(' + ')}`);
    run = next;
  } catch (error) {
    console.log(`Move rejected: ${error.message}`);
  }
  if (run.complete) break;
  prompt();
}

if (run.complete) console.log('\nPickaxe made in two turns. You solved the local puzzle!');
terminal.close();
