import { spawn } from 'node:child_process';

const port = process.env.PREVIEW_PORT ?? '4173';
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}`;

await run('npm', ['run', 'build']);

const preview = spawn('npx', ['vite', 'preview', '--host', host, '--port', port], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

preview.stdout.on('data', (chunk) => process.stdout.write(chunk));
preview.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  await waitForHttp(baseUrl);
  await run('node', ['scripts/smoke-routes.mjs'], {
    ...process.env,
    SMOKE_BASE_URL: baseUrl,
  });
} finally {
  preview.kill('SIGTERM');
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function waitForHttp(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${url} did not become ready`);
}
