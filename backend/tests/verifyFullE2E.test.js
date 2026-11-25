import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from '../src/app.js';
import {
  clearInMemoryDatabase,
  connectDatabase,
  disconnectDatabase,
} from '../src/config/db.js';
import { getWarmBrowser, shutdownPuppeteerPool } from '../src/config/puppeteerPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

console.log('--- Running Tasks 5 & 6 Full Real-Browser E2E Verification ---');

async function runFullE2E() {
  await connectDatabase();
  clearInMemoryDatabase();

  // Mount real API + static production build of frontend/dist on a single port
  const app = createApp();
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await getWarmBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1440, height: 960 });

  // Track PDF network responses
  const pdfResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/pdf/render') || url.includes('/pdf?')) {
      try {
        const buf = await response.buffer();
        pdfResponses.push({
          url,
          status: response.status(),
          contentType: response.headers()['content-type'],
          size: buf.length,
          header: buf.subarray(0, 5).toString('ascii'),
        });
      } catch {
        // Ignore buffer read errors on aborted responses
      }
    }
  });

  try {
    // =========================================================================
    // E2E 1: Guest creates Invoice in A4/A5/LEGAL/THERMAL_80, verifies distinct
    //        DocumentPaperCanvas layouts, and downloads valid PDFs (A5 & THERMAL_80)
    // =========================================================================
    await page.goto(`${baseUrl}/tools/invoice-generator`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="invoice-generator-page"]');

    const guestShellPresent = await page.$('[data-layout="guest-shell"]');
    assert.ok(guestShellPresent, 'Expected GuestShellLayout for unauthenticated visitor');
    const guestBannerPresent = await page.$('[data-testid="guest-mode-banner"]');
    assert.ok(guestBannerPresent, 'Expected GuestModeBanner visible in Guest Mode');

    // Fill Invoice fields
    await page.type('input[name="businessSnapshot.businessName"]', 'Guest Apex Studio');
    await page.type('input[name="customerSnapshot.name"]', 'Global Client Inc');
    await page.type('input[name="items.0.name"]', 'Consulting Retainer');
    await page.click('input[name="items.0.unitPrice"]', { clickCount: 3 });
    await page.type('input[name="items.0.unitPrice"]', '500');

    // Inspect distinct layouts across A4, A5, LEGAL, THERMAL_80
    const inspectLayout = async (sizeCode) => {
      await page.select('#paper-size-invoice', sizeCode);
      await new Promise((r) => setTimeout(r, 150));
      return page.evaluate(() => {
        const sheet = document.querySelector('.smarttools-paper-sheet');
        const cs = window.getComputedStyle(sheet);
        const footer = sheet.querySelector('.doc-footer-grid');
        const footerCols = footer
          ? window.getComputedStyle(footer).gridTemplateColumns.split(' ').length
          : 0;
        const thCount = sheet.querySelectorAll('table.items-table thead th').length;
        const hasLegalBox = Boolean(sheet.querySelector('.legal-terms-box'));
        const hasThermalLayout = Boolean(sheet.querySelector('[data-template="invoice-thermal-80"]'));
        return {
          paper: sheet.getAttribute('data-paper'),
          paddingTop: Math.round(parseFloat(cs.paddingTop)),
          thCount,
          footerCols,
          hasLegalBox,
          hasThermalLayout,
        };
      });
    };

    const layoutA4 = await inspectLayout('A4');
    const layoutA5 = await inspectLayout('A5');
    const layoutLegal = await inspectLayout('LEGAL');
    const layoutThermal = await inspectLayout('THERMAL_80');

    assert.equal(layoutA4.paper, 'A4');
    assert.equal(layoutA4.thCount, 6, 'A4 should render 6-column table');
    assert.equal(layoutA4.footerCols, 2, 'A4 should render side-by-side 2-column footer');

    assert.equal(layoutA5.paper, 'A5');
    assert.equal(layoutA5.thCount, 4, 'A5 should adapt to compact 4-column table');
    assert.equal(layoutA5.footerCols, 1, 'A5 should stack footer to 1 column');
    assert.ok(layoutA5.paddingTop < layoutA4.paddingTop, 'A5 margins (10mm) should be smaller than A4 (15mm)');

    assert.equal(layoutLegal.paper, 'LEGAL');
    assert.equal(layoutLegal.hasLegalBox, true, 'LEGAL should render dedicated Terms & Conditions block');

    assert.equal(layoutThermal.paper, 'THERMAL_80');
    assert.equal(layoutThermal.hasThermalLayout, true, 'THERMAL_80 should switch to single-column POS receipt');
    assert.ok(layoutThermal.paddingTop < layoutA5.paddingTop, 'THERMAL_80 margins (4mm) should be compact');
    console.log('[PASS] 1. DocumentPaperCanvas verified distinct layouts across A4, A5, LEGAL, and THERMAL_80.');

    // Trigger Guest PDF downloads in A5 and THERMAL_80
    for (const sz of ['A5', 'THERMAL_80']) {
      await page.select('#paper-size-invoice', sz);
      await new Promise((r) => setTimeout(r, 100));
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes('/api/v1/public/pdf/render'),
        { timeout: 20000 }
      );
      await page.evaluate((size) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dlBtn = btns.find((b) => b.textContent.includes(`Download ${size} PDF`));
        dlBtn?.click();
      }, sz);
      const res = await responsePromise;
      const buf = await res.buffer();
      assert.equal(
        res.status(),
        200,
        `Guest Invoice ${sz} PDF failed (${res.status()}): ${buf.toString('utf8').slice(0, 300)}`
      );
      assert.equal(res.headers()['content-type'], 'application/pdf');
      assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
      assert.ok(buf.length > 1000);
      console.log(`  -> Guest Invoice ${sz} PDF verified (${buf.length} bytes)`);
    }
    console.log('[PASS] 2. Guest Invoice PDF downloads verified in A5 and THERMAL_80 without authentication.');

    // =========================================================================
    // E2E 2: Guest creates Quotation in LEGAL size, downloads PDF, and converts
    //        it to a Guest Invoice via localStorage handoff
    // =========================================================================
    await page.goto(`${baseUrl}/tools/quotation-generator`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="quotation-generator-page"]');

    const quoteSizeOptions = await page.$$eval('#paper-size-quotation option', (opts) =>
      opts.map((o) => o.value)
    );
    assert.equal(quoteSizeOptions.includes('THERMAL_80'), false, 'Quotation selector must exclude THERMAL_80');
    assert.equal(quoteSizeOptions.includes('LEGAL'), true, 'Quotation selector must include LEGAL');

    await page.select('#paper-size-quotation', 'LEGAL');
    await page.type('input[name="businessSnapshot.businessName"]', 'Guest Quote Works');
    await page.type('input[name="customerSnapshot.name"]', 'Enterprise Buyer Ltd');
    await page.type('input[name="items.0.name"]', 'Annual SaaS License');
    await page.click('input[name="items.0.unitPrice"]', { clickCount: 3 });
    await page.type('input[name="items.0.unitPrice"]', '1200');

    // Download LEGAL Quotation PDF
    const quotePdfPromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/public/pdf/render'),
      { timeout: 20000 }
    );
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const dlBtn = btns.find((b) => b.textContent.includes('Download LEGAL PDF'));
      dlBtn?.click();
    });
    const quotePdfRes = await quotePdfPromise;
    const quotePdfBuf = await quotePdfRes.buffer();
    assert.equal(
      quotePdfRes.status(),
      200,
      `Guest Quotation LEGAL PDF failed (${quotePdfRes.status()}): ${quotePdfBuf.toString('utf8').slice(0, 300)}`
    );
    assert.equal(quotePdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');
    console.log(`  -> Guest Quotation LEGAL PDF verified (${quotePdfBuf.length} bytes)`);

    // Convert Guest Quotation -> Guest Invoice
    await page.click('[data-testid="open-convert-modal-btn"]');
    await page.waitForSelector('[data-testid="convert-to-invoice-modal"]');
    await page.click('[data-testid="confirm-convert-to-invoice-btn"]');
    await page.waitForSelector('[data-testid="invoice-generator-page"]');

    const transferredCustomer = await page.$eval(
      'input[name="customerSnapshot.name"]',
      (el) => el.value
    );
    assert.equal(transferredCustomer, 'Enterprise Buyer Ltd');
    console.log('[PASS] 3. Guest LEGAL Quotation PDF download and Guest Quote-to-Invoice handoff verified.');

    // =========================================================================
    // E2E 3: Guest clicks "Save to Cloud", registers via AuthModal, verifies
    //        draft is saved to DB, route redirects to /:newId, and localStorage cleared
    // =========================================================================
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveCloudBtn = btns.find((b) => b.textContent.includes('Save to Cloud'));
      saveCloudBtn?.click();
    });
    await page.waitForSelector('[data-testid="auth-modal"]');

    const uniqueEmail = `e2e_${Date.now()}@smarttools.dev`;
    await page.type('[data-testid="auth-modal"] input[placeholder="Alex Morgan"]', 'E2E Founder');
    await page.type('[data-testid="auth-modal"] input[placeholder="Morgan Studio LLC"]', 'Founder Labs');
    await page.type('[data-testid="auth-modal"] input[type="email"]', uniqueEmail);
    await page.type('[data-testid="auth-modal"] input[type="password"]', 'SecurePass123!');
    await page.click('[data-testid="auth-modal"] button[type="submit"]');

    // Wait for redirect to /tools/invoice-generator/:newId and AppShellLayout
    await page.waitForFunction(
      () =>
        window.location.pathname.startsWith('/tools/invoice-generator/') &&
        window.location.pathname.length > '/tools/invoice-generator/'.length,
      { timeout: 15000 }
    );
    await page.waitForSelector('[data-layout="app-shell"]');

    const remainingInvoiceDraft = await page.evaluate(() =>
      window.localStorage.getItem('smarttools_guest_invoice_draft')
    );
    assert.equal(
      remainingInvoiceDraft,
      null,
      'smarttools_guest_invoice_draft must be cleared after cloud migration'
    );
    console.log('[PASS] 4. Guest Save-to-Cloud AuthModal registration, DB save, and localStorage cleanup verified.');

    // =========================================================================
    // E2E 4: Logged-in user creates Quotation, marks Accepted, converts to Invoice,
    //        records a partial payment, and verifies status transitions cleanly
    // =========================================================================
    await page.goto(`${baseUrl}/tools/quotation-generator`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="quotation-generator-page"]');

    await page.type('input[name="customerSnapshot.name"]', 'Cloud Enterprise Client');
    await page.type('input[name="items.0.name"]', 'Dedicated Cloud Cluster');
    await page.click('input[name="items.0.unitPrice"]', { clickCount: 3 });
    await page.type('input[name="items.0.unitPrice"]', '1000');
    await page.select('[data-testid="quotation-status-select"]', 'accepted');

    // Save Quotation
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find((b) => b.textContent.trim() === 'Save Document');
      saveBtn?.click();
    });
    await page.waitForFunction(
      () =>
        window.location.pathname.startsWith('/tools/quotation-generator/') &&
        window.location.pathname.length > '/tools/quotation-generator/'.length,
      { timeout: 15000 }
    );

    // Click Convert to Invoice
    await page.click('[data-testid="open-convert-modal-btn"]');
    await page.waitForSelector('[data-testid="convert-to-invoice-modal"]');
    await page.click('[data-testid="confirm-convert-to-invoice-btn"]');

    // Wait for redirect to converted invoice URL
    await page.waitForFunction(
      () => window.location.pathname.startsWith('/tools/invoice-generator/'),
      { timeout: 15000 }
    );
    await page.waitForSelector('[data-testid="open-payment-modal-btn"]');

    // Open Payment Recorder Modal & record partial payment ($400 of $1000)
    await page.click('[data-testid="open-payment-modal-btn"]');
    await page.waitForSelector('[data-testid="payment-recorder-modal"]');
    await page.click('[data-testid="payment-amount-input"]', { clickCount: 3 });
    await page.type('[data-testid="payment-amount-input"]', '400');
    await page.click('[data-testid="confirm-record-payment-btn"]');

    // Verify InvoiceStatusBadge updates to 'partial'
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="invoice-status-badge"]')
          ?.getAttribute('data-status') === 'partial',
      { timeout: 10000 }
    );
    console.log('[PASS] 5. Authenticated Quotation -> Accepted -> Convert to Invoice -> Partial Payment status transition verified.');

    console.log('--- ALL TASKS 5 & 6 E2E VERIFICATION CHECKS PASSED ---');
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await shutdownPuppeteerPool();
    await disconnectDatabase();
  }
}

runFullE2E().catch((err) => {
  console.error('Full E2E verification failed:', err);
  process.exitCode = 1;
});
