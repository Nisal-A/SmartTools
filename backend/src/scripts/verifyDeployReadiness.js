import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
  ALWAYS_REQUIRED_ENV_KEYS,
  PRODUCTION_ONLY_REQUIRED_ENV_KEYS,
  TARGET_DB_NAME,
  hasExplicitMongoDbName,
} from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { checkCloudinaryHealth } from '../config/cloudinary.js';
import { shutdownPuppeteerPool } from '../config/puppeteerPool.js';
import { renderDocumentToPdfBuffer } from '../modules/pdf-engine/pdfEngine.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env explicitly regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Strips any `user:password@` segment from error strings so secrets never appear in output.
 */
function redactCredentials(text = '') {
  return String(text || '').replace(/\/\/[^/\s@]+@/g, '//<redacted>@');
}

function isPlaceholderSecret(val = '') {
  const lower = String(val || '').trim().toLowerCase();
  return (
    !lower ||
    lower === 'your-secret-key' ||
    lower === 'your-refresh-secret-key' ||
    lower.startsWith('replace-with-') ||
    lower.startsWith('your_') ||
    lower.startsWith('your-') ||
    lower === 'changeme'
  );
}

/**
 * Check 1: Production Environment Completeness & Secret Strength
 */
async function runEnvCheck() {
  const requiredKeys = [
    ...ALWAYS_REQUIRED_ENV_KEYS,
    ...PRODUCTION_ONLY_REQUIRED_ENV_KEYS,
  ];

  const missing = requiredKeys.filter(
    (key) => !String(process.env[key] || '').trim()
  );

  const weakIssues = [];
  const hints = [];

  if (missing.length > 0) {
    hints.push(
      `Set missing key(s) in backend/.env (and Render Environment tab): ${missing.join(', ')}`
    );
  }

  const accessSecret = String(process.env.JWT_ACCESS_SECRET || '').trim();
  if (
    accessSecret &&
    (accessSecret.length < 32 || isPlaceholderSecret(accessSecret))
  ) {
    weakIssues.push('JWT_ACCESS_SECRET (<32 chars or placeholder)');
    hints.push(
      'Generate a strong JWT_ACCESS_SECRET (32+ chars), e.g.: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  const refreshSecret = String(process.env.JWT_REFRESH_SECRET || '').trim();
  if (
    refreshSecret &&
    (refreshSecret.length < 32 || isPlaceholderSecret(refreshSecret))
  ) {
    weakIssues.push('JWT_REFRESH_SECRET (<32 chars or placeholder)');
    hints.push(
      'Generate a distinct 32+ char JWT_REFRESH_SECRET using crypto.randomBytes(32).toString("hex")'
    );
  } else if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    weakIssues.push('JWT_REFRESH_SECRET matches JWT_ACCESS_SECRET');
    hints.push('Use two distinct random secrets for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.');
  }

  const keepalive = String(process.env.KEEPALIVE_SECRET || '').trim();
  if (keepalive && (keepalive.length < 16 || isPlaceholderSecret(keepalive))) {
    weakIssues.push('KEEPALIVE_SECRET (<16 chars or placeholder)');
    hints.push('Set KEEPALIVE_SECRET to a random string of at least 16 characters.');
  }

  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  let warningNote = '';
  if (mongoUri && !hasExplicitMongoDbName(mongoUri, TARGET_DB_NAME)) {
    warningNote = `Note: MONGODB_URI omits "/${TARGET_DB_NAME}" in path (enforced via dbName option)`;
    hints.push(
      `Recommended: insert "/${TARGET_DB_NAME}" before "?" in MONGODB_URI so external tools also default to ${TARGET_DB_NAME}.`
    );
  }

  if (missing.length > 0 || weakIssues.length > 0) {
    const summaryParts = [];
    if (missing.length > 0) summaryParts.push(`Missing: ${missing.join(', ')}`);
    if (weakIssues.length > 0) summaryParts.push(`Weak: ${weakIssues.join(', ')}`);
    return {
      passed: false,
      detail: summaryParts.join(' | '),
      hints,
    };
  }

  return {
    passed: true,
    detail: warningNote || `All ${requiredKeys.length} required keys present & strong`,
    hints: warningNote ? hints : [],
  };
}

/**
 * Check 2: Live MongoDB Atlas Connection (`smart_tools_db`) + `db.admin().ping()`
 */
async function runMongoAtlasCheck() {
  const rawUri = String(process.env.MONGODB_URI || '').trim();
  if (!rawUri) {
    return {
      passed: false,
      detail: 'MONGODB_URI is not set',
      hints: ['Add your MongoDB Atlas connection string to backend/.env as MONGODB_URI.'],
    };
  }

  try {
    await connectDatabase(rawUri, { allowInMemoryFallback: false });
    const pingResult = await mongoose.connection.db.admin().ping();
    const dbName = mongoose.connection.name;

    if (!pingResult?.ok || dbName !== TARGET_DB_NAME) {
      throw new Error(
        `Unexpected ping/dbName response (dbName="${dbName}", expected "${TARGET_DB_NAME}")`
      );
    }

    return {
      passed: true,
      detail: `Connected to live MongoDB (dbName="${dbName}", ping ok=1)`,
      hints: [],
    };
  } catch (err) {
    return {
      passed: false,
      detail: redactCredentials(err.message || 'MongoDB connection failed'),
      hints: [
        'Verify your MongoDB Atlas username/password, cluster hostname, and Network Access IP allowlist (allow 0.0.0.0/0 for Render).',
      ],
    };
  } finally {
    await disconnectDatabase().catch(() => {});
  }
}

/**
 * Check 3: Live Cloudinary `api.ping()` Authentication Check
 */
async function runCloudinaryCheck() {
  try {
    const res = await checkCloudinaryHealth();
    return {
      passed: true,
      detail: `Cloudinary Admin API ping status="${res.status}"`,
      hints: [],
    };
  } catch (err) {
    return {
      passed: false,
      detail: redactCredentials(err.message || 'Cloudinary ping failed'),
      hints: [
        'Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env from your Cloudinary Dashboard.',
      ],
    };
  }
}

/**
 * Check 4: Puppeteer Headless Chromium A4 PDF Smoke Render
 */
async function runPuppeteerSmokeCheck() {
  try {
    const pdfBuffer = await renderDocumentToPdfBuffer(
      'invoice',
      {
        invoiceNumber: 'INV-PREFLIGHT-0001',
        issueDate: '2026-11-26',
        dueDate: '2026-12-26',
        currency: 'USD',
        businessSnapshot: {
          businessName: 'SmartTools Preflight Check',
          email: 'preflight@smarttools.dev',
        },
        customerSnapshot: {
          name: 'Render Verification Client',
        },
        items: [
          {
            name: 'A4 PDF Engine Smoke Render',
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
          },
        ],
      },
      { pageSize: 'A4', orientation: 'portrait', templateKey: 'indigo' }
    );

    const header = Buffer.isBuffer(pdfBuffer)
      ? pdfBuffer.subarray(0, 5).toString('ascii')
      : '';

    if (header !== '%PDF-') {
      throw new Error(`Invalid PDF magic header "${header}"`);
    }

    return {
      passed: true,
      detail: `Generated valid A4 PDF (${pdfBuffer.length} bytes, header="%PDF-") & closed Chromium`,
      hints: [],
    };
  } catch (err) {
    return {
      passed: false,
      detail: err.message || 'Puppeteer PDF render failed',
      hints: [
        'Ensure Chrome/Chromium is installed locally or set PUPPETEER_EXECUTABLE_PATH (set automatically to /usr/bin/chromium in backend/Dockerfile).',
      ],
    };
  } finally {
    await shutdownPuppeteerPool().catch(() => {});
  }
}

function formatTable(rows) {
  const colCheck = 42;
  const colStatus = 8;
  const colTime = 10;
  const divider =
    '+' +
    '-'.repeat(colCheck + 2) +
    '+' +
    '-'.repeat(colStatus + 2) +
    '+' +
    '-'.repeat(colTime + 2) +
    '+' +
    '-'.repeat(56) +
    '+';

  console.log('\n' + divider);
  console.log(
    `| ${'PRE-FLIGHT CHECK'.padEnd(colCheck)} | ${'STATUS'.padEnd(colStatus)} | ${'TIME'.padEnd(colTime)} | ${'DETAILS (NON-SECRET)'.padEnd(54)} |`
  );
  console.log(divider);

  for (const row of rows) {
    const statusStr = row.passed ? 'PASS' : 'FAIL';
    const timeStr = `${row.durationMs}ms`;
    const detailClipped =
      row.detail.length > 54 ? `${row.detail.slice(0, 51)}...` : row.detail;
    console.log(
      `| ${row.name.padEnd(colCheck)} | ${statusStr.padEnd(colStatus)} | ${timeStr.padEnd(colTime)} | ${detailClipped.padEnd(54)} |`
    );
  }
  console.log(divider);
}

async function main() {
  console.log('=== SmartTools Render Deployment Pre-Flight Verification ===');

  const checks = [
    { name: '1. Env Completeness & Secret Strength', fn: runEnvCheck },
    { name: '2. MongoDB Atlas Live Ping (smart_tools_db)', fn: runMongoAtlasCheck },
    { name: '3. Cloudinary Live api.ping() Auth', fn: runCloudinaryCheck },
    { name: '4. Puppeteer A4 PDF Smoke Render', fn: runPuppeteerSmokeCheck },
  ];

  const results = [];
  const allHints = [];

  for (const check of checks) {
    const start = Date.now();
    const outcome = await check.fn();
    const durationMs = Date.now() - start;
    results.push({
      name: check.name,
      passed: outcome.passed,
      durationMs,
      detail: outcome.detail,
    });

    if (Array.isArray(outcome.hints)) {
      for (const h of outcome.hints) {
        allHints.push(`[${check.name}] ${h}`);
      }
    }
  }

  formatTable(results);

  // Print full non-secret details if any line was clipped
  for (const r of results) {
    if (!r.passed) {
      console.error(`\n[FAIL] ${r.name}: ${r.detail}`);
    }
  }

  if (allHints.length > 0) {
    console.log('\nActionable Recommendations / Fix Hints:');
    for (const hint of allHints) {
      console.log(`  • ${hint}`);
    }
  }

  const failedCount = results.filter((r) => !r.passed).length;
  if (failedCount > 0) {
    console.error(
      `\nPre-flight result: ${failedCount} of ${results.length} check(s) FAILED. Resolve the items above before deploying to Render.`
    );
    process.exit(1);
  }

  console.log(
    `\nPre-flight result: ALL ${results.length} CHECKS PASSED! Ready for Render deployment.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected pre-flight error:', redactCredentials(err.message));
  process.exit(1);
});
