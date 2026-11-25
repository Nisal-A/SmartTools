import assert from 'node:assert/strict';
import express from 'express';
import {
  isAllowedPdfRequest,
  shutdownPuppeteerPool,
} from '../src/config/puppeteerPool.js';
import {
  escapeHtml,
  sanitizeImageUrl,
} from '../src/utils/htmlSanitizer.js';
import {
  renderDocumentToPdfBuffer,
} from '../src/modules/pdf-engine/pdfEngine.service.js';
import pdfEngineRouter from '../src/modules/pdf-engine/pdfEngine.routes.js';

console.log('--- Running Task 2: Multi-Size PDF Engine Verification ---');

const sampleBusinessSnapshot = {
  businessName: 'SmartTools Cloud Solutions <script>alert("xss")</script>',
  taxRegistrationNo: 'TAX-99887766',
  email: 'billing@smarttools.dev',
  phone: '+1 (555) 010-2026',
  address: {
    street: '742 Evergreen Terrace',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'USA',
  },
  bankDetails: {
    bankName: 'First National Tech Bank',
    accountName: 'SmartTools Cloud Solutions LLC',
    accountNumber: '001122334455',
    routingOrSwift: 'FNTBUS33',
    iban: 'US00FNTB001122334455',
  },
};

const sampleCustomerSnapshot = {
  name: 'Acme Global Enterprises',
  companyName: 'Acme Corp',
  email: 'accounts@acme.example.com',
  phone: '+1 (555) 999-8888',
  taxId: 'ACME-TAX-500',
  billingAddress: {
    street: '100 Market Street, Suite 400',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94105',
    country: 'USA',
  },
};

const sampleItems = [
  {
    name: 'Enterprise Platform Architecture & Implementation',
    description: 'Modular monolith setup, RBAC & Multi-size PDF Engine',
    quantity: 1.5,
    unit: 'hrs',
    unitPrice: 200.0,
    discountType: 'percentage',
    discountValue: 10,
    taxRate: 8.25,
  },
  {
    name: 'Cloud Hosting & Dedicated Support Retainer',
    description: '24/7 SLA Tier-1 Monitoring',
    quantity: 2,
    unit: 'months',
    unitPrice: 149.99,
    discountType: 'fixed',
    discountValue: 19.98,
    taxRate: 8.25,
  },
];

const baseInvoicePayload = {
  invoiceNumber: 'INV-2026-0042',
  issueDate: '2026-11-25',
  dueDate: '2026-12-25',
  currency: 'USD',
  status: 'sent',
  paymentTerms: 'Net 30 days via wire transfer',
  businessSnapshot: sampleBusinessSnapshot,
  customerSnapshot: sampleCustomerSnapshot,
  items: sampleItems,
  globalDiscountType: 'percentage',
  globalDiscountValue: 5,
  shippingOrAdjustment: 0,
  amountPaid: 100,
  bankDetails: sampleBusinessSnapshot.bankDetails,
  notes: 'Thank you for choosing SmartTools!',
};

const baseQuotationPayload = {
  quotationNumber: 'QUO-2026-0019',
  issueDate: '2026-11-25',
  validUntil: '2026-12-25',
  currency: 'USD',
  status: 'sent',
  deliveryTerms: 'Within 14 business days of signed acceptance',
  paymentTerms: '50% upfront deposit, 50% upon completion',
  acceptanceTerms: 'Sign and return this quotation before the validity expiration date.',
  businessSnapshot: sampleBusinessSnapshot,
  customerSnapshot: sampleCustomerSnapshot,
  items: sampleItems,
  globalDiscountType: 'fixed',
  globalDiscountValue: 25,
  notes: 'Includes 30 days of complimentary post-launch support.',
};

function assertValidPdfBuffer(buf, label) {
  assert.equal(Buffer.isBuffer(buf), true, `${label}: Expected Buffer instance`);
  assert.equal(buf.length > 1000, true, `${label}: Expected non-empty PDF (>1000 bytes), got ${buf.length}`);
  const header = buf.subarray(0, 5).toString('ascii');
  assert.equal(header, '%PDF-', `${label}: Expected "%PDF-" header, got "${header}"`);
}

async function runTests() {
  try {
    // 1. HTML Sanitizer & SSRF URL guard unit checks
    assert.equal(
      escapeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    assert.equal(isAllowedPdfRequest('http://169.254.169.254/latest/meta-data/', 'image'), false);
    assert.equal(isAllowedPdfRequest('http://127.0.0.1:8080/internal.png', 'image'), false);
    assert.equal(isAllowedPdfRequest('https://res.cloudinary.com/demo/image/upload/sample.png', 'image'), true);
    assert.equal(
      sanitizeImageUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=') !== '',
      true
    );
    console.log('[PASS] 1. HTML Sanitizer & SSRF URL whitelist verified.');

    // 2. Invoice multi-size renders: A4, A5, LETTER, THERMAL_80, and A4 landscape
    const invoiceCombinations = [
      { pageSize: 'A4', orientation: 'portrait', templateKey: 'indigo', label: 'Invoice A4 portrait' },
      { pageSize: 'A5', orientation: 'portrait', templateKey: 'emerald', label: 'Invoice A5 portrait' },
      { pageSize: 'LETTER', orientation: 'portrait', templateKey: 'slate', label: 'Invoice LETTER portrait' },
      { pageSize: 'THERMAL_80', orientation: 'portrait', templateKey: 'indigo', label: 'Invoice THERMAL_80 roll' },
      { pageSize: 'A4', orientation: 'landscape', templateKey: 'indigo', label: 'Invoice A4 landscape' },
    ];

    for (const combo of invoiceCombinations) {
      const buf = await renderDocumentToPdfBuffer('invoice', baseInvoicePayload, combo);
      assertValidPdfBuffer(buf, combo.label);
      console.log(`  -> Rendered ${combo.label}: ${buf.length} bytes (${buf.subarray(0, 8).toString('ascii').trim()})`);
    }
    console.log('[PASS] 2. Invoice PDF buffers verified for A4, A5, LETTER, THERMAL_80, and A4 landscape.');

    // 3. Quotation multi-size renders: A4, A5, LEGAL, B5
    const quotationCombinations = [
      { pageSize: 'A4', orientation: 'portrait', templateKey: 'indigo', label: 'Quotation A4 portrait' },
      { pageSize: 'A5', orientation: 'portrait', templateKey: 'emerald', label: 'Quotation A5 portrait' },
      { pageSize: 'LEGAL', orientation: 'portrait', templateKey: 'slate', label: 'Quotation LEGAL portrait' },
      { pageSize: 'B5', orientation: 'portrait', templateKey: 'indigo', label: 'Quotation B5 portrait' },
    ];

    for (const combo of quotationCombinations) {
      const buf = await renderDocumentToPdfBuffer('quotation', baseQuotationPayload, combo);
      assertValidPdfBuffer(buf, combo.label);
      console.log(`  -> Rendered ${combo.label}: ${buf.length} bytes (${buf.subarray(0, 8).toString('ascii').trim()})`);
    }
    console.log('[PASS] 3. Quotation PDF buffers verified for A4, A5, LEGAL, and B5.');

    // 4. Verify POST /api/v1/public/pdf/render HTTP endpoint (no JWT required + rejects invalid sizes)
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/v1/public/pdf', pdfEngineRouter);

    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    const { port } = server.address();
    const endpointUrl = `http://127.0.0.1:${port}/api/v1/public/pdf/render`;

    try {
      // 4a. Valid unauthenticated Guest Invoice render via HTTP POST
      const validRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'invoice',
          paperConfig: {
            pageSize: 'A4',
            orientation: 'portrait',
            templateKey: 'indigo',
          },
          payload: baseInvoicePayload,
        }),
      });

      assert.equal(validRes.status, 200, `Expected 200 OK, got ${validRes.status}`);
      assert.equal(validRes.headers.get('content-type'), 'application/pdf');
      assert.equal(
        validRes.headers.get('content-disposition')?.includes('attachment; filename="INV-2026-0042-A4.pdf"'),
        true
      );
      const httpPdfBuffer = Buffer.from(await validRes.arrayBuffer());
      assertValidPdfBuffer(httpPdfBuffer, 'HTTP Guest POST /api/v1/public/pdf/render');

      // 4b. Invalid size: Quotation with THERMAL_80 must be rejected with 400
      const invalidRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'quotation',
          paperConfig: {
            pageSize: 'THERMAL_80',
            orientation: 'portrait',
            templateKey: 'indigo',
          },
          payload: baseQuotationPayload,
        }),
      });

      assert.equal(
        invalidRes.status,
        400,
        `Expected 400 Bad Request for Quotation with THERMAL_80, got ${invalidRes.status}`
      );
      const errBody = await invalidRes.json();
      assert.equal(errBody.success, false);

      console.log('[PASS] 4. POST /api/v1/public/pdf/render verified (succeeds without JWT, rejects Quotation + THERMAL_80).');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    console.log('--- ALL TASK 2 MULTI-SIZE PDF ENGINE VERIFICATION CHECKS PASSED ---');
  } finally {
    await shutdownPuppeteerPool();
  }
}

runTests().catch((err) => {
  console.error('PDF Engine verification failed:', err);
  process.exitCode = 1;
});
