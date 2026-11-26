process.env.NODE_ENV = 'test';
process.env.USE_IN_MEMORY_DB = 'true';

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
import invoicesRouter from '../src/modules/invoices/invoices.routes.js';

console.log('--- Running Task 3: Invoice Generator Backend Integration Tests ---');

const userA = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'userA@smarttools.dev',
  role: 'user',
};

const userB = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'userB@smarttools.dev',
  role: 'user',
};

const tokenA = signAccessToken(userA);
const tokenB = signAccessToken(userB);

const baseCreatePayload = {
  issueDate: '2026-11-25',
  dueDate: '2026-12-25',
  currency: 'USD',
  paymentTerms: 'Net 30',
  sourceQuotationId: new mongoose.Types.ObjectId().toString(),
  businessSnapshot: {
    businessName: 'Alpha Studio LLC',
    taxRegistrationNo: 'US-ALPHA-01',
    email: 'finance@alphastudio.dev',
    phone: '+1-555-0101',
    address: {
      street: '500 Startup Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'USA',
    },
  },
  customerSnapshot: {
    name: 'Beta Retail Group',
    companyName: 'Beta Retail Inc',
    email: 'ap@betaretail.example.com',
    phone: '+1-555-0202',
    billingAddress: '200 Commerce Blvd, Dallas, TX',
  },
  bankDetails: {
    bankName: 'Silicon Commercial Bank',
    accountName: 'Alpha Studio LLC',
    accountNumber: '9876543210',
    routingOrSwift: 'SCBUS33',
  },
  items: [
    {
      name: 'UI/UX Design Package',
      description: 'Design system & responsive prototypes',
      quantity: 2,
      unit: 'sprints',
      unitPrice: 500,
      discountType: 'percentage',
      discountValue: 10, // 1000 - 100 = 900
      taxRate: 10, // 10% of 900 = 90 -> lineTotal = 990
    },
  ],
  globalDiscountType: 'fixed',
  globalDiscountValue: 0,
  notes: 'Initial project milestone invoice',
  pageSize: 'A4',
  orientation: 'portrait',
  templateKey: 'indigo',
};

async function runIntegrationTests() {
  await connectDatabase();
  clearInMemoryDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/v1/invoices', invoicesRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1/invoices`;

  try {
    // 1. Create Invoice with auto-generated atomic number INV-2026-0001
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        ...baseCreatePayload,
        // Attempt spoofed userId in body — service must ignore it and bind to userA.id
        userId: userB.id,
      }),
    });

    assert.equal(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
    const createdBody = await createRes.json();
    assert.equal(createdBody.success, true);

    const invoice1 = createdBody.data;
    assert.equal(String(invoice1.userId), userA.id, 'Invoice must belong strictly to User A');
    assert.equal(invoice1.invoiceNumber, 'INV-2026-0001');
    assert.equal(invoice1.status, 'draft');
    assert.equal(invoice1.subtotal, 1000);
    assert.equal(invoice1.itemDiscountTotal, 100);
    assert.equal(invoice1.taxTotal, 90);
    assert.equal(invoice1.grandTotal, 990);
    assert.equal(invoice1.amountPaid, 0);
    assert.equal(invoice1.balanceDue, 990);
    assert.equal(invoice1.items.length, 1);
    assert.equal(invoice1.items[0].lineTotal, 990);
    console.log('[PASS] 1. Created invoice with atomic INV-2026-0001 & server-computed totals.');

    // 2. Update items via PUT /api/v1/invoices/:id & verify recalculated totals
    const updateRes = await fetch(`${baseUrl}/${invoice1._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        status: 'sent',
        items: [
          {
            name: 'UI/UX Design Package',
            quantity: 2,
            unitPrice: 500,
            discountType: 'percentage',
            discountValue: 10, // gross 1000, disc 100, taxable 900, tax 90 (10%), total 990
            taxRate: 10,
          },
          {
            name: 'Frontend React Integration',
            quantity: 1.5,
            unitPrice: 400, // gross 600, disc 0, taxable 600, tax 60 (10%), total 660
            discountType: 'fixed',
            discountValue: 0,
            taxRate: 10,
          },
        ],
        globalDiscountType: 'fixed',
        globalDiscountValue: 50, // net after item discount (1500) - 50 + tax (150) = 1600
      }),
    });

    assert.equal(updateRes.status, 200);
    const updatedBody = await updateRes.json();
    const updatedInvoice = updatedBody.data;
    assert.equal(updatedInvoice.items.length, 2);
    assert.equal(updatedInvoice.subtotal, 1600);
    assert.equal(updatedInvoice.itemDiscountTotal, 100);
    assert.equal(updatedInvoice.discount.amount, 50);
    assert.equal(updatedInvoice.taxTotal, 150);
    assert.equal(updatedInvoice.grandTotal, 1600);
    assert.equal(updatedInvoice.balanceDue, 1600);
    assert.equal(updatedInvoice.status, 'sent');
    console.log('[PASS] 2. Updated invoice items and verified recalculated totals (grandTotal = 1600).');

    // 3. Record partial payment (600) -> status transitions to 'partial', balanceDue = 1000
    const payPartialRes = await fetch(`${baseUrl}/${invoice1._id}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amount: 600,
        paymentDate: '2026-11-26',
        method: 'bank_transfer',
        referenceNo: 'WIRE-001',
        notes: 'First installment',
      }),
    });

    assert.equal(payPartialRes.status, 201);
    const payPartialBody = await payPartialRes.json();
    assert.equal(payPartialBody.data.amountPaid, 600);
    assert.equal(payPartialBody.data.balanceDue, 1000);
    assert.equal(payPartialBody.data.status, 'partial');
    assert.equal(payPartialBody.data.payments.length, 1);

    // 4. Record remaining payment (1000) -> status transitions to 'paid', balanceDue = 0
    const payFullRes = await fetch(`${baseUrl}/${invoice1._id}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        amount: 1000,
        paymentDate: '2026-11-27',
        method: 'card',
        referenceNo: 'STRIPE-002',
        notes: 'Final settlement',
      }),
    });

    assert.equal(payFullRes.status, 201);
    const payFullBody = await payFullRes.json();
    assert.equal(payFullBody.data.amountPaid, 1600);
    assert.equal(payFullBody.data.balanceDue, 0);
    assert.equal(payFullBody.data.status, 'paid');
    assert.equal(payFullBody.data.payments.length, 2);
    console.log('[PASS] 3. Recorded partial then full payments (status -> partial -> paid).');

    // 5. Duplicate invoice -> new atomic INV-2026-0002, status = 'draft', amountPaid = 0, sourceQuotationId = null
    const dupRes = await fetch(`${baseUrl}/${invoice1._id}/duplicate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    assert.equal(dupRes.status, 201);
    const dupBody = await dupRes.json();
    const duplicatedInvoice = dupBody.data;
    assert.NotEqual?.(String(duplicatedInvoice._id), String(invoice1._id));
    assert.equal(duplicatedInvoice.invoiceNumber, 'INV-2026-0002');
    assert.equal(duplicatedInvoice.status, 'draft');
    assert.equal(duplicatedInvoice.amountPaid, 0);
    assert.equal(duplicatedInvoice.balanceDue, 1600);
    assert.equal(duplicatedInvoice.sourceQuotationId, null);
    assert.equal(duplicatedInvoice.items.length, 2);
    assert.equal(duplicatedInvoice.payments.length, 0);
    console.log('[PASS] 4. Duplicated invoice with new atomic INV-2026-0002, draft status, and reset payments.');

    // 6. Download PDF in A5 and THERMAL_80
    for (const size of ['A5', 'THERMAL_80']) {
      const pdfRes = await fetch(`${baseUrl}/${invoice1._id}/pdf?size=${size}`, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      });
      assert.equal(pdfRes.status, 200, `Expected 200 for PDF size ${size}`);
      assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');
      assert.equal(pdfBuf.length > 1000, true);
      console.log(`  -> Downloaded saved invoice PDF in ${size}: ${pdfBuf.length} bytes`);
    }
    console.log('[PASS] 5. Downloaded saved invoice PDFs in A5 and THERMAL_80.');

    // 7. Verify User B receives 404 Not Found when accessing User A's invoice ID
    const userBGetRes = await fetch(`${baseUrl}/${invoice1._id}`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.equal(userBGetRes.status, 404, 'User B must receive 404 when requesting User A invoice');

    const userBPdfRes = await fetch(`${baseUrl}/${invoice1._id}/pdf?size=A4`, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.equal(userBPdfRes.status, 404, 'User B must receive 404 when requesting User A invoice PDF');

    const userBDeleteRes = await fetch(`${baseUrl}/${invoice1._id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    assert.equal(userBDeleteRes.status, 404, 'User B must receive 404 when trying to delete User A invoice');

    const userBListRes = await fetch(baseUrl, {
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    const userBListBody = await userBListRes.json();
    assert.equal(userBListBody.data.length, 0, 'User B list must contain 0 invoices from User A');
    console.log('[PASS] 6. Verified strict ownership isolation (User B gets 404 on User A invoice ID).');

    console.log('--- ALL TASK 3 INVOICE GENERATOR BACKEND TESTS PASSED ---');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await shutdownPuppeteerPool();
    await disconnectDatabase();
  }
}

runIntegrationTests().catch((err) => {
  console.error('Invoice module integration test failed:', err);
  process.exitCode = 1;
});
