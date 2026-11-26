import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Non-interactive Backend CI Test Runner (`backend/tests/runAllTests.js`)
 *
 * Executes every SmartTools backend unit & integration test suite sequentially
 * in isolated child processes with `NODE_ENV=test` and `USE_IN_MEMORY_DB=true`,
 * ensuring clean teardown of Express servers, Mongoose models, and Puppeteer
 * Chromium instances with zero hanging handles.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function collectTestFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith('.test.js'))
    .sort()
    .map((file) => path.join(dirPath, file));
}

const standaloneSuites = [
  path.join(__dirname, 'verifyRenderReadiness.test.js'),
  path.join(__dirname, 'verifyPlatformTask1.test.js'),
  path.join(__dirname, 'verifyPlatformTask2.test.js'),
  path.join(__dirname, 'verifyInvoicesModule.test.js'),
  path.join(__dirname, 'verifyQuotationsModule.test.js'),
  path.join(__dirname, 'verifyReceiptsModule.test.js'),
  path.join(__dirname, 'verifyPurchaseOrdersModule.test.js'),
  path.join(__dirname, 'verifyExpensesModule.test.js'),
  path.join(__dirname, 'verifyProposalsModule.test.js'),
  path.join(__dirname, 'verifyPdfEngine.test.js'),
];

const seoNodeTestFiles = [
  ...collectTestFiles(path.join(__dirname, 'seo-analyzer', 'unit')),
  ...collectTestFiles(path.join(__dirname, 'seo-analyzer', 'integration')),
];

function runNodeCommand(args, label, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    console.log(`\n▶ Running ${label}...`);

    const child = spawn(process.execPath, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        USE_IN_MEMORY_DB: 'true',
      },
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${label} timed out after ${timeoutMs}ms (possible open handle)`));
    }, timeoutMs);
    timer.unref();

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      if (code === 0) {
        console.log(`✔ ${label} passed (${elapsed}s)`);
        resolve();
      } else {
        reject(
          new Error(
            `${label} failed with exit code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`
          )
        );
      }
    });
  });
}

async function main() {
  const suiteStart = Date.now();
  console.log('=== SmartTools Backend Automated Test Suite ===');

  for (const suitePath of standaloneSuites) {
    const relName = path.relative(path.resolve(__dirname, '..'), suitePath);
    await runNodeCommand([suitePath], relName);
  }

  if (seoNodeTestFiles.length > 0) {
    await runNodeCommand(
      ['--test', ...seoNodeTestFiles],
      `SEO Analyzer Unit & RBAC Suite (${seoNodeTestFiles.length} test files)`
    );
  }

  const totalSec = ((Date.now() - suiteStart) / 1000).toFixed(2);
  console.log(`\n=== ALL BACKEND TEST SUITES PASSED CLEANLY (${totalSec}s) ===`);
}

main().catch((err) => {
  console.error(`\n✖ Backend test runner failed: ${err.message}`);
  process.exit(1);
});
