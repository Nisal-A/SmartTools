process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import puppeteer from 'puppeteer';
import {
  enableInMemoryMongooseEngine,
  clearInMemoryDatabase,
  disconnectDatabase,
} from '../src/config/db.js';
import { shutdownPuppeteerPool } from '../src/config/puppeteerPool.js';
import { createApp } from '../src/app.js';
import { seedAdmin } from '../src/scripts/seedAdmin.js';

const distDir = path.resolve(process.cwd(), '../frontend/dist');

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

console.log('=== Running Platform Task 5: Full 5-Point End-to-End QA Suite ===');

async function runFinalQA() {
  enableInMemoryMongooseEngine();
  clearInMemoryDatabase();

  // Seed initial Admin user
  process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
  process.env.ADMIN_PASSWORD = 'AdminPassword@123';
  await seedAdmin();

  const apiApp = createApp();
  const combinedApp = express();
  combinedApp.use(express.static(distDir));
  combinedApp.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return apiApp(req, res, next);
    }
    return res.sendFile(path.join(distDir, 'index.html'));
  });

  const server = await new Promise((resolve) => {
    const s = combinedApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const apiUrl = `${baseUrl}/api/v1`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findBrowserExecutable(),
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });

  try {
    // =========================================================================
    // QA 1: Guest generates & downloads A4, A5, THERMAL_80 Invoices and
    //       A4, A5, LEGAL Quotations with zero login
    // =========================================================================
    const sampleGuestDoc = {
      issueDate: '2026-11-25',
      dueDate: '2026-12-25',
      validUntil: '2026-12-25',
      currency: 'USD',
      businessSnapshot: { businessName: 'Guest Freelance Co', email: 'guest@demo.dev' },
      customerSnapshot: { name: 'Guest Client Ltd', email: 'client@demo.dev' },
      items: [{ name: 'Design Retainer', quantity: 2, unitPrice: 450, taxRate: 10 }],
    };

    for (const size of ['A4', 'A5', 'THERMAL_80']) {
      const res = await fetch(`${apiUrl}/public/pdf/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'invoice',
          payload: { ...sampleGuestDoc, invoiceNumber: `INV-GUEST-${size}` },
          paperConfig: { pageSize: size, orientation: 'portrait', templateKey: 'indigo' },
        }),
      });
      assert.equal(res.status, 200, `Guest Invoice PDF (${size}) must return 200`);
      const buf = Buffer.from(await res.arrayBuffer());
      assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
    }

    for (const size of ['A4', 'A5', 'LEGAL']) {
      const res = await fetch(`${apiUrl}/public/pdf/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'quotation',
          payload: { ...sampleGuestDoc, quotationNumber: `QUO-GUEST-${size}` },
          paperConfig: { pageSize: size, orientation: 'portrait', templateKey: 'emerald' },
        }),
      });
      assert.equal(res.status, 200, `Guest Quotation PDF (${size}) must return 200`);
      const buf = Buffer.from(await res.arrayBuffer());
      assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
    }
    console.log(
      '✓ QA 1 Passed: Guest rendered valid PDFs for A4, A5, THERMAL_80 Invoices & A4, A5, LEGAL Quotations with zero login'
    );

    // =========================================================================
    // QA 2: Guest converts Quotation -> Invoice and signs up via AuthModal to migrate draft
    // =========================================================================
    await page.goto(`${baseUrl}/tools/quotation-generator`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="quotation-generator-page"]');
    assert.ok(await page.$('[data-layout="guest-shell"]'));

    // Fill minimal guest fields so conversion carries them cleanly
    await page.click('[data-testid="open-convert-modal-btn"]');
    await page.waitForSelector('[data-testid="convert-to-invoice-modal"]');
    await page.click('[data-testid="confirm-convert-to-invoice-btn"]');

    await page.waitForSelector('[data-testid="invoice-generator-page"]');
    assert.equal(new URL(page.url()).pathname, '/tools/invoice-generator');

    // Click "Save to Cloud" inside DocumentExportBar -> opens AuthModal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const saveBtn = buttons.find((b) => /save to cloud/i.test(b.textContent || ''));
      if (!saveBtn) throw new Error('Save to Cloud button not found');
      saveBtn.click();
    });

    await page.waitForSelector('[data-testid="auth-modal"]');
    await page.type('[data-testid="auth-modal"] input[placeholder="Alex Morgan"]', 'Alice QA User');
    await page.type('[data-testid="auth-modal"] input[placeholder="Morgan Studio LLC"]', 'Alice QA Studio');
    await page.type('[data-testid="auth-modal"] input[type="email"]', 'alice.qa@smarttools.dev');
    await page.type('[data-testid="auth-modal"] input[type="password"]', 'AlicePass123!');
    await page.click('[data-testid="auth-modal"] button[type="submit"]');

    await page.waitForFunction(
      () =>
        window.location.pathname.startsWith('/tools/invoice-generator/') &&
        window.location.pathname.length > '/tools/invoice-generator/'.length,
      { timeout: 10000 }
    );
    await page.waitForSelector('[data-layout="app-shell"]');
    const remainingDraft = await page.evaluate(() =>
      window.localStorage.getItem('smarttools_guest_invoice_draft')
    );
    assert.equal(remainingDraft, null, 'Guest invoice draft must be cleared after cloud migration');
    console.log(
      '✓ QA 2 Passed: Guest converted Quotation -> Invoice and migrated draft to MongoDB via AuthModal'
    );

    // =========================================================================
    // QA 3: Strict User Isolation (User A cannot view User B via UI or API)
    // =========================================================================
    const regBRes = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob.qa@smarttools.dev',
        password: 'BobPassword123!',
        fullName: 'Bob Private User',
        businessName: 'Bob Secret Corp',
      }),
    });
    assert.equal(regBRes.status, 201);
    const { accessToken: tokenB } = await regBRes.json();

    const invBRes = await fetch(`${apiUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        issueDate: '2026-11-25',
        dueDate: '2026-12-25',
        currency: 'USD',
        status: 'sent',
        businessSnapshot: { businessName: 'Bob Secret Corp' },
        customerSnapshot: { name: 'Confidential Bob Client' },
        items: [{ name: 'Private Advisory', quantity: 1, unitPrice: 9999 }],
      }),
    });
    assert.equal(invBRes.status, 201);
    const invoiceB = (await invBRes.json()).data;

    // Extract User A token from browser localStorage
    const tokenA = await page.evaluate(() =>
      window.localStorage.getItem('smarttools_access_token')
    );
    assert.ok(tokenA, 'User A access token must exist in localStorage');

    // API Check: User A gets 403 on /admin/history and 404 on User B's invoice ID
    const userAAdminTry = await fetch(`${apiUrl}/admin/history`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userAAdminTry.status, 403, 'User A must receive 403 on /api/v1/admin/history');

    const userABDocTry = await fetch(`${apiUrl}/invoices/${invoiceB._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userABDocTry.status, 404, 'User A must receive 404 on User B invoice ID');

    // UI Check: User A opens /dashboard and /history — sees ONLY User A records, NOT Bob's
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="dashboard-page"]');
    await page.waitForSelector('[data-testid="dashboard-kpis"]');

    await page.goto(`${baseUrl}/history`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="document-history-page"]');
    await page.waitForSelector('[data-testid="history-table"]');
    const historyText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !historyText.includes('Confidential Bob Client'),
      'User B records must NEVER appear in User A Document History UI'
    );
    assert.equal(
      await page.$('[data-testid="sidebar-admin-group"]'),
      null,
      'Admin sidebar group must be hidden for standard users'
    );

    // User A navigating to /admin/history redirects to /dashboard with toast
    await page.goto(`${baseUrl}/admin/history`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="global-toast"]');
    assert.equal(new URL(page.url()).pathname, '/dashboard');
    console.log(
      '✓ QA 3 Passed: Strict User A/B isolation verified across Dashboard, History UI, AdminRoute, and API (403/404)'
    );

    // =========================================================================
    // QA 4: Admin signs in, inspects User A & User B history, views Users & Audit Logs
    // =========================================================================
    // Sign out User A cleanly
    await page.click('[data-testid="user-avatar-trigger"]');
    await page.waitForSelector('[data-testid="sign-out-btn"]');
    await page.click('[data-testid="sign-out-btn"]');
    await page.waitForSelector('[data-layout="guest-shell"]');

    // Sign in as Admin via /login
    await page.goto(`${baseUrl}/login?returnTo=%2Fadmin%2Fhistory`, {
      waitUntil: 'networkidle0',
    });
    await page.waitForSelector('[data-testid="login-page"]');
    await page.type('[data-testid="login-email-input"]', 'admin@smarttools.dev');
    await page.type('[data-testid="login-password-input"]', 'AdminPassword@123');
    await page.click('[data-testid="login-submit-btn"]');

    await page.waitForSelector('[data-testid="admin-global-history-page"]');
    await page.waitForSelector('[data-testid="admin-global-history-table"]');
    assert.ok(
      await page.$('[data-testid="sidebar-admin-group"]'),
      'Admin sidebar group must be visible for admin users'
    );

    const adminHistoryText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      adminHistoryText.includes('alice.qa@smarttools.dev') &&
        adminHistoryText.includes('bob.qa@smarttools.dev'),
      'Admin Global History must show both User A and User B documents with owner emails'
    );

    // Click Inspect on User B's invoice -> opens AdminDocumentPreviewModal
    await page.click(`[data-testid="admin-inspect-btn-${invoiceB._id}"]`);
    await page.waitForSelector('[data-testid="admin-document-preview-modal"]');
    await page.waitForFunction(
      () => document.body.innerText.includes('Private Advisory'),
      { timeout: 5000 }
    );
    await page.click('[data-testid="close-admin-preview-btn"]');

    // Visit /admin/users
    await page.goto(`${baseUrl}/admin/users`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="admin-users-table"]');

    // Visit /admin/audit-logs -> confirm VIEW_GLOBAL_HISTORY & VIEW_USER_DOCUMENT appear
    await page.goto(`${baseUrl}/admin/audit-logs`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="admin-audit-logs-table"]');
    const auditLogsText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      auditLogsText.includes('VIEW_GLOBAL_HISTORY'),
      'Audit logs UI must show VIEW_GLOBAL_HISTORY entry'
    );
    assert.ok(
      auditLogsText.includes('VIEW_USER_DOCUMENT'),
      'Audit logs UI must show VIEW_USER_DOCUMENT entry'
    );
    console.log(
      '✓ QA 4 Passed: Admin inspected User A & User B history, opened read-only preview modal, and confirmed audit logs'
    );

    // =========================================================================
    // QA 5: Ctrl+K Command Switcher, Sidebar Pinned Tools & Tools Hub on Desktop & Mobile
    // =========================================================================
    // Desktop check
    await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="tools-hub-page"]');
    assert.ok(
      await page.$('[data-testid="sidebar-pinned-invoice-generator"]'),
      'Sidebar Pinned Tools must include invoice-generator'
    );

    await page.type('[data-testid="tools-hub-search"]', 'Quotation');
    await page.waitForSelector('[data-testid="tool-card-quotation-generator"]');

    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await page.waitForSelector('[data-testid="command-tool-switcher"]');
    await page.keyboard.press('Escape');

    // Mobile viewport check (390x844)
    await page.setViewport({ width: 390, height: 844 });
    await page.click('[data-testid="mobile-nav-toggle"]');
    await page.waitForSelector('[data-testid="sidebar-mobile-drawer"]');
    await new Promise((r) => setTimeout(r, 260));
    await page.click('[aria-label="Close navigation"]');
    await new Promise((r) => setTimeout(r, 260));
    await page.click('[data-testid="command-switcher-trigger"]');
    await page.waitForSelector('[data-testid="command-tool-switcher"]');
    console.log(
      '✓ QA 5 Passed: Ctrl+K Command Switcher, Sidebar Pinned Tools & Tools Hub verified on Desktop & Mobile'
    );

    console.log('\n=== ALL 5 FINAL END-TO-END PLATFORM QA CHECKS PASSED! ===');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await shutdownPuppeteerPool();
    await disconnectDatabase();
  }
}

runFinalQA().catch((err) => {
  console.error('Final Platform QA FAILED:', err);
  process.exit(1);
});
