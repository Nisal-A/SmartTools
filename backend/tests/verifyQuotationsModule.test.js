import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import {
  connectDatabase,
  clearInMemoryDatabase,
  disconnectDatabase,
} from '../src/config/db.js';
import { shutdownPuppeteerPool } from '../src/config/puppeteerPool.js';
import { signAccessToken } from '../src/middleware/auth.js';
import quotationsRouter from '../src/modules/quotations/quotations.routes.js';
import invoicesRouter from '../src/modules/invoices/invoices.routes.js';

console.log('--- Running Task 4: Quotation Generator Backend Integration Tests ---');

const userA = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'quoteUserA@smarttools.dev',
  role: 'user',
};

const userB = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'quoteUserB@smarttools.dev',
  role: 'user',
};

const tokenA = signAccessToken(userA);
const tokenB = signAccessToken(userB);

const baseQuotationPayload = {
  issueDate: '2026-11-25',
  validUntil: '2026-12-25',
  currency: 'USD',
  status: 'draft',
  deliveryTerms: 'Within 10 business days of acceptance',
  paymentTerms: '50% upfront, 50% on delivery',
  acceptanceTerms: 'Authorized signature constitutes binding purchase order.',
  businessSnapshot: {
    businessName: 'SmartTools Engineering Corp',
    taxRegistrationNo: 'US-ST-7711',
    email: 'proposals@smarttools.dev',
    phone: '+1-555-0303',
    address: {
      street: '101 Innovation Drive',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'USA',
    },
    bankDetails: {
      bankName: 'Pacific Enterprise Bank',
      accountName: 'SmartTools Engineering Corp',
      accountNumber: '1122334455',
      routingOrSwift: 'PEBKUS66',
    },
  },
  customerSnapshot: {
    name: 'Horizon Logistics Ltd',
    companyName: 'Horizon Logistics',
    email: 'procurement@horizon.example.com',
    phone: '+1-555-0404',
    billingAddress: '800 Harbor Ave, Portland, OR',
  },
  items: [
    {
      name: 'Custom ERP Integration',
      description: 'API sync & webhook pipeline',
      quantity: 2,
      unit: 'modules',
      unitPrice: 1200,
      discountType: 'percentage',
      discountValue: 10, // 2400 - 240 = 2160
      taxRate: 10, // 216 -> lineTotal = 2376
    },
  ],
  globalDiscountType: 'fixed',
  globalDiscountValue: 60, // 2160 - 60 + 216 = 2316
  notes: 'Quotation valid for 30 days.',
  pageSize: 'LEGAL',
  orientation: 'portrait',
  templateKey: 'emerald',
};

async function runIntegrationTests() {
  await connectDatabase();
  clearInMemoryDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/v1/quotations', quotationsRouter);
  app.use('/api/v1/invoices', invoicesRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const quotesUrl = `http://127.0.0.1:${port}/api/v1/quotations`;
  const invoicesUrl = `http://127.0.0.1:${port}/api/v1/invoices`;

  try {
    // 1. Reject THERMAL_80 on Quotation create
    const rejectThermalCreate = await fetch(quotesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ...baseQuotationPayload,
        pageSize: 'THERMAL_80',
      }),
    });
    assert.equal(
      rejectThermalCreate.status,
      400,
      'Quotation creation must reject THERMAL_80 with 400'
    );

    // 2. Create Quotation with auto QUO-2026-0001
    const createRes = await fetch(quotesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ...baseQuotationPayload,
        userId: userB.id, // spoof attempt must be ignored
      }),
    });
    assert.equal(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
    const createBody = await createRes.json();
    const q1 = createBody.data;
    assert.equal(String(q1.userId), userA.id);
    assert.equal(q1.quotationNumber, 'QUO-2026-0001');
    assert.equal(q1.status, 'draft');
    assert.equal(q1.pageSize, 'LEGAL');
    assert.equal(q1.subtotal, 2400);
    assert.equal(q1.itemDiscountTotal, 240);
    assert.equal(q1.discount.amount, 60);
    assert.equal(q1.taxTotal, 216);
    assert.equal(q1.grandTotal, 2316);
    assert.equal(q1.items.length, 1);

    // 3. Reject THERMAL_80 on update & update quotation to accepted with updated items
    const rejectThermalUpdate = await fetch(`${quotesUrl}/${q1._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ pageSize: 'THERMAL_80' }),
    });
    assert.equal(rejectThermalUpdate.status, 400);

    const updateRes = await fetch(`${quotesUrl}/${q1._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        status: 'accepted',
        pageSize: 'A4',
        items: [
          ...baseQuotationPayload.items,
          {
            name: 'Staff Onboarding Workshop',
            quantity: 1,
            unit: 'session',
            unitPrice: 500,
            discountType: 'fixed',
            discountValue: 0,
            taxRate: 10, // 50 -> total 550
          },
        ],
      }),
    });
    assert.equal(updateRes.status, 200);
    const updatedQ1 = (await updateRes.json()).data;
    assert.equal(updatedQ1.status, 'accepted');
    assert.equal(updatedQ1.items.length, 2);
    assert.equal(updatedQ1.subtotal, 2900);
    assert.equal(updatedQ1.taxTotal, 266);
    // (2900 - 240) - 60 + 266 = 2866
    assert.equal(updatedQ1.grandTotal, 2866);
    console.log('[PASS] 1. Quotation CRUD, atomic QUO-2026-0001, THERMAL_80 rejection, and recalculated totals verified.');

    // 4. Auto-expire validity flag when status='sent' and validUntil is in the past
    const pastQuoteRes = await fetch(quotesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ...baseQuotationPayload,
        status: 'sent',
        validUntil: '2020-01-01',
        pageSize: 'B5',
      }),
    });
    assert.equal(pastQuoteRes.status, 201);
    const pastQuote = (await pastQuoteRes.json()).data;
    assert.equal(pastQuote.quotationNumber, 'QUO-2026-0002');
    assert.equal(pastQuote.status, 'expired');

    const deletePastRes = await fetch(`${quotesUrl}/${pastQuote._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(deletePastRes.status, 200);
    const getDeletedRes = await fetch(`${quotesUrl}/${pastQuote._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getDeletedRes.status, 404);
    console.log('[PASS] 2. Auto-expired validity flag and DELETE cleanup verified.');

    // 5. Reject THERMAL_80 on PDF export; allow A4, LEGAL, B5 PDF downloads
    const rejectThermalPdf = await fetch(`${quotesUrl}/${q1._id}/pdf?size=THERMAL_80`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(rejectThermalPdf.status, 400);

    for (const size of ['A4', 'LEGAL', 'B5']) {
      const pdfRes = await fetch(`${quotesUrl}/${q1._id}/pdf?size=${size}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(pdfRes.status, 200);
      assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      assert.equal(buf.subarray(0, 5).toString('ascii'), '%PDF-');
      assert.equal(buf.length > 1000, true);
      console.log(`  -> Downloaded Quotation PDF in ${size}: ${buf.length} bytes`);
    }
    console.log('[PASS] 3. Quotation PDF export verified for A4, LEGAL, B5 and rejected for THERMAL_80.');

    // 6. Duplicate Quotation
    const dupRes = await fetch(`${quotesUrl}/${q1._id}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(dupRes.status, 201);
    const dupQuote = (await dupRes.json()).data;
    assert.notEqual(String(dupQuote._id), String(q1._id));
    assert.equal(dupQuote.quotationNumber, 'QUO-2026-0003');
    assert.equal(dupQuote.status, 'draft');
    assert.equal(dupQuote.convertedInvoiceId, null);
    assert.equal(dupQuote.items.length, 2);
    console.log('[PASS] 4. Quotation duplication verified (QUO-2026-0003, draft, cloned items).');

    // 7. Convert accepted Quotation to Invoice + verify 409 on second conversion
    const convertRes = await fetch(`${quotesUrl}/${q1._id}/convert-to-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(convertRes.status, 201, `Expected 201 on conversion, got ${convertRes.status}`);
    const convertBody = await convertRes.json();
    const { quotation: convertedQuote, invoice: createdInvoice } = convertBody.data;

    assert.equal(convertedQuote.status, 'converted');
    assert.equal(String(convertedQuote.convertedInvoiceId), String(createdInvoice._id));
    assert.equal(createdInvoice.invoiceNumber, 'INV-2026-0001');
    assert.equal(createdInvoice.status, 'draft');
    assert.equal(String(createdInvoice.sourceQuotationId), String(q1._id));
    assert.equal(createdInvoice.grandTotal, 2866);
    assert.equal(createdInvoice.items.length, 2);

    // Fetch created invoice from Invoice API to confirm persistence in invoices & invoice_items
    const fetchInvoiceRes = await fetch(`${invoicesUrl}/${createdInvoice._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(fetchInvoiceRes.status, 200);
    const fetchedInvoice = (await fetchInvoiceRes.json()).data;
    assert.equal(fetchedInvoice.items.length, 2);
    assert.equal(String(fetchedInvoice.sourceQuotationId), String(q1._id));

    // Second conversion attempt must return 409 Conflict with convertedInvoiceId
    const secondConvertRes = await fetch(`${quotesUrl}/${q1._id}/convert-to-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(secondConvertRes.status, 409);
    const secondConvertBody = await secondConvertRes.json();
    assert.equal(secondConvertBody.success, false);
    assert.equal(String(secondConvertBody.convertedInvoiceId), String(createdInvoice._id));
    console.log('[PASS] 5. Convert-to-Invoice pipeline verified (linked IDs, invoice_items, 409 on retry).');

    // 8. Cross-user 404 isolation
    const checks = [
      fetch(`${quotesUrl}/${q1._id}`, { headers: { Authorization: `Bearer ${tokenB}` } }),
      fetch(`${quotesUrl}/${q1._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ notes: 'hijack' }),
      }),
      fetch(`${quotesUrl}/${q1._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
      fetch(`${quotesUrl}/${q1._id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
      fetch(`${quotesUrl}/${q1._id}/convert-to-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
      fetch(`${quotesUrl}/${q1._id}/pdf?size=A4`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      }),
    ];
    const responses = await Promise.all(checks);
    for (const r of responses) {
      assert.equal(r.status, 404, `Expected 404 for User B cross-user request, got ${r.status}`);
    }

    const listBRes = await fetch(quotesUrl, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const listBBody = await listBRes.json();
    assert.equal(listBBody.data.length, 0);
    console.log('[PASS] 6. Cross-user 404 isolation verified across all Quotation endpoints.');

    console.log('--- ALL TASK 4 QUOTATION GENERATOR BACKEND TESTS PASSED ---');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await shutdownPuppeteerPool();
    await disconnectDatabase();
  }
}

runIntegrationTests().catch((err) => {
  console.error('Quotation module integration test failed:', err);
  process.exitCode = 1;
});
