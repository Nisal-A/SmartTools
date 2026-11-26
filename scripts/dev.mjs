import { spawn } from 'node:child_process';

/**
 * Unified SmartTools Local Development Launcher
 *
 * Starts both the Express API server (`backend`, port 5000) and Vite dev
 * server (`frontend`, port 5173) concurrently and cleanly terminates both on exit.
 */

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function prefixLines(stream, label, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      target.write(`[${label}] ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (buffer) {
      target.write(`[${label}] ${buffer}\n`);
    }
  });
}

const children = [
  { label: 'backend', args: ['--prefix', 'backend', 'run', 'dev'] },
  { label: 'frontend', args: ['--prefix', 'frontend', 'run', 'dev'] },
].map(({ label, args }) => {
  const proc = spawn(npmCmd, args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
  });

  prefixLines(proc.stdout, label, process.stdout);
  prefixLines(proc.stderr, label, process.stderr);

  proc.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`[dev] ${label} exited (${reason})`);
  });

  return proc;
});

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of children) {
    if (!proc.killed) {
      proc.kill();
    }
  }
  process.exit(exitCode);
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
