import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { assertSafeElectionId, publicDataRoot, readJson } from './data-utils.mjs';

const electionId = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? readCurrentElectionId();

if (!electionId) {
  console.error('Usage: npm run release:check -- <electionId>');
  process.exit(1);
}

try {
  assertSafeElectionId(electionId);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const steps = [
  ['npm', ['run', 'scan:secrets']],
  ['npm', ['run', 'scan:release-text', '--', electionId]],
  ['npm', ['run', 'validate:data:strict']],
  ['npm', ['run', 'report:data:check', '--', electionId]],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'smoke:preview']],
];

for (const [command, args] of steps) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  await run(command, args);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function readCurrentElectionId() {
  try {
    return readJson(join(publicDataRoot, 'active-election.json')).currentId;
  } catch {
    return undefined;
  }
}
