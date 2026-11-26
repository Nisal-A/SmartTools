import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * SmartTools Live Render Production Verification Script (`scripts/verify-live-render.mjs`)
 *
 * Verifies against a deployed (or local) SmartTools stack:
 * 1. CORS Preflight & Cross-Origin Headers (`Access-Control-Allow-Origin` & `Credentials`)
 * 2. Auth Login, Cross-Origin Cookie Flags (`HttpOnly`, `Secure`, `SameSite=None`),
 *    Silent `/auth/refresh`, and `/auth/logout` Cookie Clearing
 * 3. Guest Stateless Multi-Size PDF Generation (`A4`, `A5`, `LETTER`, `THERMAL_80` for Invoice;
 *    `A4`, `A5`, `LEGAL`, `B5` for Quotation; rejects `THERMAL_80` Quotation)
 * 4. Standard User History Isolation (`403` on `/admin/history`, `?userId=` spoofing ignored,
 *    `404`/`403` on another user's document ID)
 * 5. Admin Governance Audit Logging (`/admin/history` -> verified in `/admin/audit-logs`)
 *
 * SECURITY: Never prints passwords, JWTs, cookie values, or database URIs.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFileIfPresent(path.join(ROOT_DIR, '.env'));
loadEnvFileIfPresent(path.join(ROOT_DIR, 'backend', '.env'));

function unwrapInputUrl(raw = '') {
  let cleaned = String(raw || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
  const mdMatch = cleaned.match(/^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/i);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
  } else if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/\/+$/, '');
}

const API_BASE_URL = unwrapInputUrl(
  process.env.API_BASE_URL || 'https://smarttools-api.onrender.com/api/v1'
);

const WEB_ORIGIN = unwrapInputUrl(
  process.env.WEB_ORIGIN || 'https://smarttools-web.onrender.com'
);

const EXPECT_CROSS_ORIGIN_SECURE_COOKIES =
  API_BASE_URL.startsWith('https://') ||
  process.env.EXPECT_SECURE_COOKIES === 'true';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function extractRefreshCookieValue(setCookieList = []) {
  for (const header of setCookieList) {
    const match = header.match(/(?:^|;\s*)refreshToken=([^;]*)/i);
    if (match) {
      return { rawHeader: header, value: match[1] };
    }
  }
  return null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Waits up to ~90s for Render Free Tier cold start on `/health`.
 */
async function waitForColdStart() {
  const maxAttempts = 3;
  const perAttemptTimeoutMs = 75000;
  const healthUrl = `${API_BASE_URL}/health`;
  console.log(`Target API   : ${API_BASE_URL}`);
  console.log(`Target Origin: ${WEB_ORIGIN}`);
  console.log('Warming up API (Render free instances may take ~60s on cold start)...');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetchWithTimeout(
        healthUrl,
        { headers: { Origin: WEB_ORIGIN } },
        perAttemptTimeoutMs
      );
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        console.log(
          `API reachable on attempt ${attempt}: status="${body.status || res.status}", database="${body.database || 'unknown'}", dbName="${body.dbName || 'n/a'}"`
        );
        return { reachable: true, healthResponse: res, healthBody: body };
      }
      console.log(`  Attempt ${attempt}/${maxAttempts}: HTTP ${res.status}, retrying in 5s...`);
    } catch (err) {
      console.log(
        `  Attempt ${attempt}/${maxAttempts}: ${err.name === 'AbortError' ? 'timeout (75s)' : err.message}, retrying in 5s...`
      );
    }
    if (attempt < maxAttempts) await sleep(5000);
  }

  return { reachable: false };
}

/**
 * Authenticates a user or registers an idempotent QA test user if TEST_USER_EMAIL is unset.
 */
async function ensureStandardUserSession({ email, password, label }) {
  const loginRes = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    body: JSON.stringify({ email, password }),
  });

  if (loginRes.status === 200) {
    const body = await loginRes.json();
    return { res: loginRes, body, wasRegistered: false };
  }

  if (loginRes.status !== 401) {
    const errText = await loginRes.text().catch(() => '');
    throw new Error(
      `${label} login failed with HTTP ${loginRes.status}: ${errText.slice(0, 160)}`
    );
  }

  // Register dedicated QA account if not yet present
  const regRes = await fetchWithTimeout(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    body: JSON.stringify({
      fullName: label,
      businessName: `${label} Workspace`,
      email,
      password,
    }),
  });

  if (regRes.status !== 201) {
    throw new Error(
      `${label} login returned 401 and registration returned HTTP ${regRes.status} (check credentials if account already exists with a different password)`
    );
  }

  // Perform explicit login so we test the exact /auth/login response & cookie headers
  const secondLogin = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await secondLogin.json();
  return { res: secondLogin, body, wasRegistered: true };
}

// ============================================================================
// Check 1: CORS Preflight & Cross-Origin Credentials
// ============================================================================
async function checkCorsPreflight() {
  const preflightRes = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: WEB_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });

  const allowOrigin = preflightRes.headers.get('access-control-allow-origin');
  const allowCreds = preflightRes.headers.get('access-control-allow-credentials');

  if (allowOrigin !== WEB_ORIGIN) {
    return {
      passed: false,
      detail: `Expected Access-Control-Allow-Origin="${WEB_ORIGIN}", got "${allowOrigin || 'none'}" (check CLIENT_URL on Render)`,
    };
  }

  if (allowCreds !== 'true') {
    return {
      passed: false,
      detail: `Expected Access-Control-Allow-Credentials="true", got "${allowCreds || 'none'}"`,
    };
  }

  return {
    passed: true,
    detail: `Allow-Origin="${allowOrigin}", Allow-Credentials="true" (HTTP ${preflightRes.status})`,
  };
}

// ============================================================================
// Check 2: Login, Cross-Origin Cookie Flags, Silent Refresh & Logout Clearing
// ============================================================================
async function checkAuthCookiesRefreshAndLogout(sharedState) {
  const hasExplicitTestUser = Boolean(
    process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD
  );
  const testEmail = (
    process.env.TEST_USER_EMAIL || 'live.qa.standard@smarttools.dev'
  ).trim();
  const testPassword =
    process.env.TEST_USER_PASSWORD || 'SmartToolsLiveQA!2026';

  const { res: loginRes, body: loginBody, wasRegistered } =
    await ensureStandardUserSession({
      email: testEmail,
      password: testPassword,
      label: 'SmartTools Live QA User',
    });

  if (loginRes.status !== 200 || !loginBody?.accessToken) {
    return {
      passed: false,
      detail: `Login failed (HTTP ${loginRes.status}) for ${testEmail}`,
    };
  }

  const loginCookies = getSetCookieHeaders(loginRes.headers);
  const refreshCookie = extractRefreshCookieValue(loginCookies);

  if (!refreshCookie || !refreshCookie.value) {
    return {
      passed: false,
      detail: 'Login response did not set refreshToken cookie',
    };
  }

  const rawCookie = refreshCookie.rawHeader;
  const hasHttpOnly = /;\s*HttpOnly/i.test(rawCookie);
  const hasSecure = /;\s*Secure/i.test(rawCookie);
  const hasSameSiteNone = /;\s*SameSite=None/i.test(rawCookie);

  if (!hasHttpOnly) {
    return { passed: false, detail: 'refreshToken cookie missing HttpOnly flag' };
  }

  if (EXPECT_CROSS_ORIGIN_SECURE_COOKIES && (!hasSecure || !hasSameSiteNone)) {
    return {
      passed: false,
      detail: `Cross-origin HTTPS cookie flags mismatch: Secure=${hasSecure}, SameSite=None=${hasSameSiteNone} (ensure NODE_ENV=production on Render)`,
    };
  }

  // Test silent /auth/refresh using the refresh cookie
  const refreshRes = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Origin: WEB_ORIGIN,
      Cookie: `refreshToken=${refreshCookie.value}`,
    },
  });

  if (refreshRes.status !== 200) {
    return {
      passed: false,
      detail: `Silent POST /auth/refresh failed with HTTP ${refreshRes.status}`,
    };
  }

  const refreshBody = await refreshRes.json();
  if (!refreshBody?.accessToken) {
    return {
      passed: false,
      detail: 'POST /auth/refresh returned 200 without a new accessToken',
    };
  }

  const rotatedCookie =
    extractRefreshCookieValue(getSetCookieHeaders(refreshRes.headers)) ||
    refreshCookie;

  // Test /auth/logout clears cookie with matching Secure + SameSite=None flags
  const logoutRes = await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Origin: WEB_ORIGIN,
      Cookie: `refreshToken=${rotatedCookie.value}`,
    },
  });

  if (logoutRes.status !== 200) {
    return {
      passed: false,
      detail: `POST /auth/logout failed with HTTP ${logoutRes.status}`,
    };
  }

  const logoutCookie = extractRefreshCookieValue(
    getSetCookieHeaders(logoutRes.headers)
  );
  if (!logoutCookie || logoutCookie.value !== '') {
    return {
      passed: false,
      detail: 'POST /auth/logout did not clear refreshToken cookie value',
    };
  }

  if (
    IS_HTTPS_TARGET &&
    (!/;\s*Secure/i.test(logoutCookie.rawHeader) ||
      !/;\s*SameSite=None/i.test(logoutCookie.rawHeader))
  ) {
    return {
      passed: false,
      detail:
        'POST /auth/logout clearCookie is missing Secure or SameSite=None flags',
    };
  }

  // Re-login so Check 4 has an active standard user token
  const reloginRes = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const reloginBody = await reloginRes.json();
  sharedState.standardUserToken = reloginBody.accessToken;
  sharedState.standardUserId = reloginBody.user?.id || reloginBody.data?.user?.id;
  sharedState.standardUserNote = hasExplicitTestUser
    ? 'explicit TEST_USER_EMAIL'
    : wasRegistered
      ? 'created idempotent QA user'
      : 'reused idempotent QA user';

  return {
    passed: true,
    detail: `HttpOnly=true, Secure=${hasSecure}, SameSite=${hasSameSiteNone ? 'None' : 'Lax'}, refresh & logout verified (${sharedState.standardUserNote})`,
  };
}

// ============================================================================
// Check 3: Stateless Guest Multi-Size PDF Generation
// ============================================================================
async function checkGuestMultiSizePdfs() {
  const samplePayload = {
    issueDate: '2026-11-26',
    dueDate: '2026-12-26',
    validUntil: '2026-12-26',
    currency: 'USD',
    businessSnapshot: {
      businessName: 'SmartTools Live Guest Check',
      email: 'guest@smarttools.dev',
    },
    customerSnapshot: {
      name: 'Live Verification Client',
      email: 'client@smarttools.dev',
    },
    items: [
      {
        name: 'Cloud Readiness PDF Check',
        quantity: 1,
        unitPrice: 150,
        taxRate: 10,
      },
    ],
  };

  const invoiceSizes = ['A4', 'A5', 'LETTER', 'THERMAL_80'];
  for (const size of invoiceSizes) {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/public/pdf/render`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: WEB_ORIGIN,
        },
        body: JSON.stringify({
          documentType: 'invoice',
          paperConfig: { pageSize: size, orientation: 'portrait', templateKey: 'indigo' },
          payload: { ...samplePayload, invoiceNumber: `INV-LIVE-${size}` },
        }),
      },
      60000
    );

    if (res.status !== 200) {
      return {
        passed: false,
        detail: `Guest Invoice PDF (${size}) failed with HTTP ${res.status}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const magic = buf.subarray(0, 5).toString('ascii');
    if (magic !== '%PDF-') {
      return {
        passed: false,
        detail: `Guest Invoice PDF (${size}) invalid magic header "${magic}"`,
      };
    }
  }

  const quotationSizes = ['A4', 'A5', 'LEGAL', 'B5'];
  for (const size of quotationSizes) {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/public/pdf/render`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: WEB_ORIGIN,
        },
        body: JSON.stringify({
          documentType: 'quotation',
          paperConfig: { pageSize: size, orientation: 'portrait', templateKey: 'emerald' },
          payload: { ...samplePayload, quotationNumber: `QUO-LIVE-${size}` },
        }),
      },
      60000
    );

    if (res.status !== 200) {
      return {
        passed: false,
        detail: `Guest Quotation PDF (${size}) failed with HTTP ${res.status}`,
      };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const magic = buf.subarray(0, 5).toString('ascii');
    if (magic !== '%PDF-') {
      return {
        passed: false,
        detail: `Guest Quotation PDF (${size}) invalid magic header "${magic}"`,
      };
    }
  }

  // Verify THERMAL_80 is rejected for Quotations
  const invalidQuoRes = await fetchWithTimeout(`${API_BASE_URL}/public/pdf/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    body: JSON.stringify({
      documentType: 'quotation',
      paperConfig: { pageSize: 'THERMAL_80', orientation: 'portrait' },
      payload: { ...samplePayload, quotationNumber: 'QUO-INVALID-THERMAL' },
    }),
  });

  if (invalidQuoRes.status !== 400) {
    return {
      passed: false,
      detail: `Expected Quotation + THERMAL_80 to return 400, got HTTP ${invalidQuoRes.status}`,
    };
  }

  return {
    passed: true,
    detail:
      'Invoices (A4, A5, LETTER, THERMAL_80) & Quotations (A4, A5, LEGAL, B5) valid "%PDF-"; Quotation THERMAL_80 rejected (400)',
  };
}

// ============================================================================
// Check 4: Standard User History Isolation
// ============================================================================
async function checkStandardUserIsolation(sharedState) {
  const tokenA = sharedState.standardUserToken;
  const userAId = sharedState.standardUserId;

  if (!tokenA || !userAId) {
    return {
      passed: false,
      detail: 'Skipped because standard user authentication failed in Check 2',
    };
  }

  // 1. Standard user MUST receive 403 on /admin/history
  const adminHistoryTry = await fetchWithTimeout(`${API_BASE_URL}/admin/history`, {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      Origin: WEB_ORIGIN,
    },
  });

  if (adminHistoryTry.status !== 403) {
    return {
      passed: false,
      detail: `Expected 403 on /admin/history for standard user, got HTTP ${adminHistoryTry.status}`,
    };
  }

  // 2. Ensure a second isolated peer user + temporary invoice exists, verify isolation, then delete it
  const peerSession = await ensureStandardUserSession({
    email: 'live.qa.peer@smarttools.dev',
    password: 'SmartToolsPeerQA!2026',
    label: 'SmartTools Live Peer User',
  });
  const peerToken = peerSession.body?.accessToken;
  const peerUserId =
    peerSession.body?.user?.id || peerSession.body?.data?.user?.id;

  let tempPeerInvoiceId = null;
  try {
    const createPeerInv = await fetchWithTimeout(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${peerToken}`,
        Origin: WEB_ORIGIN,
      },
      body: JSON.stringify({
        issueDate: '2026-11-26',
        dueDate: '2026-12-26',
        currency: 'USD',
        status: 'draft',
        businessSnapshot: { businessName: 'Peer Isolation Test Co' },
        customerSnapshot: { name: 'Confidential Peer Customer' },
        items: [{ name: 'Isolation Probe Item', quantity: 1, unitPrice: 99 }],
      }),
    });

    if (createPeerInv.status !== 201) {
      return {
        passed: false,
        detail: `Could not create temporary peer invoice for isolation check (HTTP ${createPeerInv.status})`,
      };
    }

    const peerInvoice = (await createPeerInv.json()).data;
    tempPeerInvoiceId = peerInvoice?._id || peerInvoice?.id;

    // Spoof ?userId=<peerUserId> as Standard User A
    const spoofedHistoryRes = await fetchWithTimeout(
      `${API_BASE_URL}/history?userId=${encodeURIComponent(peerUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          Origin: WEB_ORIGIN,
        },
      }
    );

    if (spoofedHistoryRes.status !== 200) {
      return {
        passed: false,
        detail: `GET /history returned HTTP ${spoofedHistoryRes.status}`,
      };
    }

    const spoofedBody = await spoofedHistoryRes.json();
    const leaked = (spoofedBody.data || []).some(
      (doc) =>
        doc.userId === peerUserId ||
        doc.id === String(tempPeerInvoiceId) ||
        doc.customerName === 'Confidential Peer Customer'
    );

    if (leaked) {
      return {
        passed: false,
        detail: 'SECURITY FAILURE: /history?userId=<other> leaked another user record!',
      };
    }

    // Direct access to peer's invoice ID must return 404 or 403
    const directPeerDocRes = await fetchWithTimeout(
      `${API_BASE_URL}/invoices/${tempPeerInvoiceId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          Origin: WEB_ORIGIN,
        },
      }
    );

    if (directPeerDocRes.status !== 404 && directPeerDocRes.status !== 403) {
      return {
        passed: false,
        detail: `Expected 404/403 when requesting another user's invoice ID, got HTTP ${directPeerDocRes.status}`,
      };
    }

    return {
      passed: true,
      detail: `/admin/history -> 403, /history?userId=<other> leaked 0 records, peer invoice ID -> ${directPeerDocRes.status} (temp doc cleaned up)`,
    };
  } finally {
    if (tempPeerInvoiceId && peerToken) {
      await fetchWithTimeout(`${API_BASE_URL}/invoices/${tempPeerInvoiceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${peerToken}`,
          Origin: WEB_ORIGIN,
        },
      }).catch(() => {});
    }
  }
}

// ============================================================================
// Check 5: Admin Global History & Audit Log Recording
// ============================================================================
async function checkAdminAuditLogging() {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminEmail || !adminPassword) {
    return {
      passed: false,
      detail: 'ADMIN_EMAIL or ADMIN_PASSWORD is not set in local environment/.env',
    };
  }

  const adminLoginRes = await fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  if (adminLoginRes.status !== 200) {
    return {
      passed: false,
      detail: `Admin login failed for "${adminEmail}" (HTTP ${adminLoginRes.status}). Ensure seedAdmin.js has been run against the production DB.`,
    };
  }

  const adminBody = await adminLoginRes.json();
  const adminRole = adminBody?.user?.role || adminBody?.data?.user?.role;
  const adminToken = adminBody?.accessToken;

  if (adminRole !== 'admin') {
    return {
      passed: false,
      detail: `Account "${adminEmail}" authenticated but has role="${adminRole}" instead of "admin"`,
    };
  }

  const probeTag = `live-audit-${crypto.randomBytes(4).toString('hex')}`;

  const globalHistoryRes = await fetchWithTimeout(
    `${API_BASE_URL}/admin/history?search=${encodeURIComponent(probeTag)}`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: WEB_ORIGIN,
      },
    }
  );

  if (globalHistoryRes.status !== 200) {
    return {
      passed: false,
      detail: `GET /admin/history failed with HTTP ${globalHistoryRes.status}`,
    };
  }

  const auditLogsRes = await fetchWithTimeout(
    `${API_BASE_URL}/admin/audit-logs?action=VIEW_GLOBAL_HISTORY&limit=15`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Origin: WEB_ORIGIN,
      },
    }
  );

  if (auditLogsRes.status !== 200) {
    return {
      passed: false,
      detail: `GET /admin/audit-logs failed with HTTP ${auditLogsRes.status}`,
    };
  }

  const auditLogsBody = await auditLogsRes.json();
  const logs = Array.isArray(auditLogsBody.data) ? auditLogsBody.data : [];
  const matchedEntry = logs.find(
    (entry) =>
      entry.action === 'VIEW_GLOBAL_HISTORY' &&
      entry.queryMeta?.search === probeTag
  );

  if (!matchedEntry) {
    return {
      passed: false,
      detail: `VIEW_GLOBAL_HISTORY entry with probe "${probeTag}" was not found in /admin/audit-logs`,
    };
  }

  return {
    passed: true,
    detail: `Verified new VIEW_GLOBAL_HISTORY entry (id=${matchedEntry.id || matchedEntry._id}) in /admin/audit-logs`,
  };
}

function printSummaryTable(rows) {
  const nameCol = 44;
  const statusCol = 8;
  const timeCol = 10;
  const detailCol = 58;
  const line =
    '+' +
    '-'.repeat(nameCol + 2) +
    '+' +
    '-'.repeat(statusCol + 2) +
    '+' +
    '-'.repeat(timeCol + 2) +
    '+' +
    '-'.repeat(detailCol + 2) +
    '+';

  console.log('\n' + line);
  console.log(
    `| ${'LIVE RENDER VERIFICATION CHECK'.padEnd(nameCol)} | ${'STATUS'.padEnd(statusCol)} | ${'TIME'.padEnd(timeCol)} | ${'DETAILS (NON-SECRET)'.padEnd(detailCol)} |`
  );
  console.log(line);

  for (const r of rows) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const time = `${r.durationMs}ms`;
    const clipped =
      r.detail.length > detailCol
        ? `${r.detail.slice(0, detailCol - 3)}...`
        : r.detail;
    console.log(
      `| ${r.name.padEnd(nameCol)} | ${status.padEnd(statusCol)} | ${time.padEnd(timeCol)} | ${clipped.padEnd(detailCol)} |`
    );
  }
  console.log(line);

  for (const r of rows) {
    console.log(`${r.passed ? '✓' : '✗'} ${r.name}: ${r.detail}`);
  }
}

async function main() {
  console.log('=== SmartTools Live Render Verification Suite ===');

  const warmup = await waitForColdStart();
  if (!warmup.reachable) {
    console.error(
      `\n[FATAL] Could not reach ${API_BASE_URL}/health after multiple attempts (~90s). Confirm the Render Web Service URL and deployment status.`
    );
    process.exit(1);
  }

  const sharedState = {};
  const checks = [
    { name: '1. CORS Preflight & Credentials', fn: () => checkCorsPreflight() },
    {
      name: '2. Login, Cross-Origin Cookies, Refresh & Logout',
      fn: () => checkAuthCookiesRefreshAndLogout(sharedState),
    },
    {
      name: '3. Guest Multi-Size PDFs (Invoice & Quotation)',
      fn: () => checkGuestMultiSizePdfs(),
    },
    {
      name: '4. Standard User History & Document Isolation',
      fn: () => checkStandardUserIsolation(sharedState),
    },
    {
      name: '5. Admin Global History & Audit Log Recording',
      fn: () => checkAdminAuditLogging(),
    },
  ];

  const results = [];
  for (const check of checks) {
    const start = Date.now();
    try {
      const res = await check.fn();
      results.push({
        name: check.name,
        passed: Boolean(res.passed),
        detail: res.detail || '',
        durationMs: Date.now() - start,
      });
    } catch (err) {
      results.push({
        name: check.name,
        passed: false,
        detail: err.message || 'Unhandled verification error',
        durationMs: Date.now() - start,
      });
    }
  }

  printSummaryTable(results);

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(
      `\nResult: ${failed.length} of ${results.length} live check(s) FAILED.`
    );
    process.exit(1);
  }

  console.log(
    `\nResult: ALL ${results.length} LIVE RENDER VERIFICATION CHECKS PASSED!`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error in verify-live-render:', err.message);
  process.exit(1);
});
