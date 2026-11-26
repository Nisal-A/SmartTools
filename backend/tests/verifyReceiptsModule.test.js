process.env.NODE_ENV = 'test';
process.env.USE_IN_MEMORY_DB = 'true';

import assert from 'node:assert/strict';
import {
  enableInMemoryMongooseEngine,
  clearInMemoryDatabase,
  disconnectDatabase,
} from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { seedAdmin } from '../src/scripts/seedAdmin.js';

console.log('--- Running Receipt Generator Backend API Integration Tests ---');

async function runReceiptTests() {
  enableInMemoryMongooseEngine();
  clearInMemoryDatabase();

  process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
  process.env.ADMIN_PASSWORD = 'AdminPassword@123';
  await seedAdmin({ allowInMemoryFallback: true });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const receiptsUrl = `${baseUrl}/api/receipts`;
  const v1Url = `${baseUrl}/api/v1`;

  try {
    // 1. Authenticate Admin, User A, and User B
    const adminLoginRes = await fetch(`${v1Url}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@smarttools.dev',
        password: 'AdminPassword@123',
      }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminToken = (await adminLoginRes.json()).accessToken;

    const regARes = await fetch(`${v1Url}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Receipt User A',
        email: 'receipt.usera@smarttools.dev',
        password: 'PasswordA@123',
      }),
    });
    assert.equal(regARes.status, 201);
    const regABody = await regARes.json();
    const tokenA = regABody.accessToken;
    const userAId = regABody.user.id;

    const regBRes = await fetch(`${v1Url}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Receipt User B',
        email: 'receipt.userb@smarttools.dev',
        password: 'PasswordB@123',
      }),
    });
    assert.equal(regBRes.status, 201);
    const regBBody = await regBRes.json();
    const tokenB = regBBody.accessToken;
    const userBId = regBBody.user.id;

    // 2. Guest POST /api/receipts (no auth token -> userId: null, auto RCP-YYYY-0001, balanceDue computed)
    const currentYear = new Date().getUTCFullYear();
    const guestRes = await fetch(receiptsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business: {
          name: 'Colombo Retail Mart',
          address: '42 Galle Road, Colombo 03',
          phone: '+94 11 234 5678',
          email: 'sales@colomboretail.lk',
        },
        customer: {
          name: 'Walk-in Guest',
        },
        paymentMethod: 'Cash',
        invoiceTotal: 5000,
        amountPaid: 3500,
        balanceDue: 999999, // spoofed balanceDue must be ignored and recomputed server-side
        format: 'thermal',
        notes: 'Partial cash payment',
      }),
    });
    assert.equal(guestRes.status, 201, `Expected 201 for Guest receipt, got ${guestRes.status}`);
    const guestReceipt = (await guestRes.json()).data;
    assert.equal(guestReceipt.userId, null, 'Guest receipt must have userId: null');
    assert.equal(guestReceipt.receiptNumber, `RCP-${currentYear}-0001`);
    assert.equal(guestReceipt.currency, 'LKR');
    assert.equal(guestReceipt.invoiceTotal, 5000);
    assert.equal(guestReceipt.amountPaid, 3500);
    assert.equal(guestReceipt.balanceDue, 1500, 'Server must compute balanceDue = 5000 - 3500 = 1500');
    assert.equal(guestReceipt.format, 'thermal');

    // Validation check: missing amountPaid returns 400
    const missingPaidRes = await fetch(receiptsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business: { name: 'Shop' } }),
    });
    assert.equal(missingPaidRes.status, 400);
    console.log('✓ 1. Guest POST /api/receipts, auto RCP-YYYY-0001, validation, and balanceDue math verified');

    // 3. Create an Invoice for User A, test GET /api/receipts/prefill-invoice/:invoiceId, then create linked receipt
    const createInvARes = await fetch(`${v1Url}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        issueDate: '2026-11-26',
        dueDate: '2026-12-26',
        currency: 'LKR',
        businessSnapshot: {
          businessName: 'Lanka Digital Studio',
          email: 'billing@lankadigital.lk',
          phone: '+94 77 111 2222',
          address: { street: '10 Lotus Rd', city: 'Colombo', country: 'Sri Lanka' },
        },
        customerSnapshot: {
          name: 'Serendib Exports',
          email: 'accounts@serendib.lk',
          phone: '+94 11 999 0000',
          billingAddress: '88 Harbour View, Galle',
        },
        items: [{ name: 'Web Platform Retainer', quantity: 2, unitPrice: 12500, taxRate: 0 }],
      }),
    });
    assert.equal(createInvARes.status, 201);
    const invoiceA = (await createInvARes.json()).data;

    // User B cannot prefill from User A's invoice (404)
    const prefillByB = await fetch(`${receiptsUrl}/prefill-invoice/${invoiceA._id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(prefillByB.status, 404, 'User B must receive 404 on User A invoice prefill');

    // User A prefills from own invoice (200)
    const prefillByA = await fetch(`${receiptsUrl}/prefill-invoice/${invoiceA._id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(prefillByA.status, 200);
    const prefillData = (await prefillByA.json()).data;
    assert.equal(prefillData.linkedInvoiceId, String(invoiceA._id));
    assert.equal(prefillData.invoiceNumber, invoiceA.invoiceNumber);
    assert.equal(prefillData.currency, 'LKR');
    assert.equal(prefillData.invoiceTotal, 25000);
    assert.equal(prefillData.business.name, 'Lanka Digital Studio');
    assert.equal(prefillData.business.address, '10 Lotus Rd, Colombo, Sri Lanka');
    assert.equal(prefillData.customer.name, 'Serendib Exports');
    assert.equal(prefillData.customer.address, '88 Harbour View, Galle');

    // Admin can also prefill from User A's invoice (200)
    const prefillByAdmin = await fetch(`${receiptsUrl}/prefill-invoice/${invoiceA._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(prefillByAdmin.status, 200);
    console.log('✓ 2. GET /api/receipts/prefill-invoice/:invoiceId ownership & normalization verified');

    // 4. Logged-in User A & User B create receipts -> verify GET /api/receipts/my strict isolation
    const userAReceiptRes = await fetch(receiptsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        linkedInvoiceId: prefillData.linkedInvoiceId,
        linkedInvoiceNumber: prefillData.invoiceNumber,
        business: prefillData.business,
        customer: prefillData.customer,
        currency: prefillData.currency,
        paymentMethod: 'Bank Transfer',
        paymentReference: 'SLIPS-889900',
        invoiceTotal: prefillData.invoiceTotal,
        amountPaid: 25000,
        format: 'a5',
      }),
    });
    assert.equal(userAReceiptRes.status, 201);
    const receiptA = (await userAReceiptRes.json()).data;
    assert.equal(String(receiptA.userId), userAId);
    assert.equal(receiptA.receiptNumber, `RCP-${currentYear}-0002`);
    assert.equal(receiptA.balanceDue, 0);

    const userBReceiptRes = await fetch(receiptsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        business: { name: 'User B Consultancy' },
        customer: { name: 'Client B' },
        paymentMethod: 'Card',
        amountPaid: 8000,
      }),
    });
    assert.equal(userBReceiptRes.status, 201);
    const receiptB = (await userBReceiptRes.json()).data;
    assert.equal(String(receiptB.userId), userBId);
    assert.equal(receiptB.balanceDue, 0, 'When invoiceTotal is 0, balanceDue = max(0, amountPaid - amountPaid) = 0');

    const myARes = await fetch(`${receiptsUrl}/my`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(myARes.status, 200);
    const myAData = (await myARes.json()).data;
    assert.equal(myAData.length, 1, 'User A /my must return strictly User A receipts (excluding Guest & User B)');
    assert.equal(String(myAData[0]._id), String(receiptA._id));
    console.log('✓ 3. Authenticated POST /api/receipts & GET /api/receipts/my strict isolation verified');

    // 5. GET /api/receipts/admin -> 403 for standard user, 200 paginated all receipts (User A + User B + Guest) for Admin
    const userAdminTry = await fetch(`${receiptsUrl}/admin`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userAdminTry.status, 403, 'Standard user must receive 403 on GET /api/receipts/admin');

    const adminListRes = await fetch(`${receiptsUrl}/admin?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminListRes.status, 200);
    const adminListBody = await adminListRes.json();
    assert.equal(adminListBody.pagination.total, 3, 'Admin must see all 3 receipts (Guest + User A + User B)');
    assert.equal(adminListBody.data.length, 3);
    console.log('✓ 4. GET /api/receipts/admin RBAC (403 user / 200 paginated admin) verified');

    // 6. DELETE /api/receipts/:id -> non-owner blocked (403), owner allowed (200), admin allowed on guest receipt (200)
    const userBDeleteA = await fetch(`${receiptsUrl}/${receiptA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(userBDeleteA.status, 403, 'User B deleting User A receipt must be rejected with 403');

    const userADeleteGuest = await fetch(`${receiptsUrl}/${guestReceipt._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userADeleteGuest.status, 403, 'Standard user deleting Guest receipt must be rejected with 403');

    const userADeleteOwn = await fetch(`${receiptsUrl}/${receiptA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userADeleteOwn.status, 200, 'Owner deleting own receipt must return 200');

    const adminDeleteGuest = await fetch(`${receiptsUrl}/${guestReceipt._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDeleteGuest.status, 200, 'Admin deleting guest receipt must return 200');
    console.log('✓ 5. DELETE /api/receipts/:id owner & admin authorization verified');

    console.log('\nALL RECEIPT GENERATOR BACKEND API TESTS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
}

runReceiptTests().catch((err) => {
  console.error('Receipt Generator API verification FAILED:', err);
  process.exit(1);
});
