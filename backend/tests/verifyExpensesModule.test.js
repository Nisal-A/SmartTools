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
import {
  uploadExpenseAttachment,
  deleteExpenseAttachment,
  MAX_EXPENSE_ATTACHMENT_BYTES,
} from '../src/utils/cloudinaryUpload.js';

console.log('--- Running Expense Tracker & Category Budgets API Integration Tests ---');

async function runExpenseTests() {
  enableInMemoryMongooseEngine();
  clearInMemoryDatabase();

  process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
  process.env.ADMIN_PASSWORD = 'AdminPassword@123';
  await seedAdmin({ allowInMemoryFallback: true });

  // 1. Verify graceful upload & delete behavior when Cloudinary env vars are missing
  const savedCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const savedApiKey = process.env.CLOUDINARY_API_KEY;
  const savedApiSecret = process.env.CLOUDINARY_API_SECRET;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  const samplePng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const fallbackUpload = await uploadExpenseAttachment(samplePng, {
    mimeType: 'image/png',
    originalName: 'taxi-receipt.png',
    userId: 'unit_test_user',
  });
  assert.ok(fallbackUpload.url.startsWith('data:image/png;base64,'));
  assert.ok(fallbackUpload.publicId.startsWith('local_expenses_'));
  assert.equal(fallbackUpload.resourceType, 'image');

  const skipDelete = await deleteExpenseAttachment(fallbackUpload.publicId, 'image');
  assert.equal(skipDelete.result, 'skipped');

  // Verify production fails fast if Cloudinary credentials are absent
  process.env.NODE_ENV = 'production';
  await assert.rejects(
    () =>
      uploadExpenseAttachment(samplePng, {
        mimeType: 'image/png',
        originalName: 'prod.png',
      }),
    (err) => err.statusCode === 500
  );
  process.env.NODE_ENV = 'test';

  if (savedCloudName !== undefined) process.env.CLOUDINARY_CLOUD_NAME = savedCloudName;
  if (savedApiKey !== undefined) process.env.CLOUDINARY_API_KEY = savedApiKey;
  if (savedApiSecret !== undefined) process.env.CLOUDINARY_API_SECRET = savedApiSecret;

  // 2. Start Express app
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const expensesUrl = `${baseUrl}/api/expenses`;
  const v1Url = `${baseUrl}/api/v1`;

  try {
    // 3. Authenticate Admin, User A, and User B
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
        fullName: 'Finance Lead A',
        email: 'expense.usera@smarttools.dev',
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
        fullName: 'Finance Lead B',
        email: 'expense.userb@smarttools.dev',
        password: 'PasswordB@123',
      }),
    });
    assert.equal(regBRes.status, 201);
    const tokenB = (await regBRes.json()).accessToken;

    // 4. All endpoints must reject unauthenticated callers with 401
    for (const [method, url] of [
      ['GET', expensesUrl],
      ['POST', expensesUrl],
      ['GET', `${expensesUrl}/summary?month=2026-11`],
      ['PUT', `${expensesUrl}/budgets`],
      ['GET', `${expensesUrl}/admin`],
    ]) {
      const unauthRes = await fetch(url, { method });
      assert.equal(unauthRes.status, 401, `Expected 401 on unauthenticated ${method} ${url}`);
    }

    // 5. Validation checks: invalid MIME type & >5MB attachment & invalid payload
    const badMimeForm = new FormData();
    badMimeForm.append('title', 'Invalid Mime Expense');
    badMimeForm.append('category', 'Travel');
    badMimeForm.append('amount', '500');
    badMimeForm.append('expenseDate', '2026-11-10');
    badMimeForm.append('receipt', new Blob(['plain text'], { type: 'text/plain' }), 'note.txt');

    const badMimeRes = await fetch(expensesUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: badMimeForm,
    });
    assert.equal(badMimeRes.status, 400);

    const hugeBuffer = Buffer.alloc(MAX_EXPENSE_ATTACHMENT_BYTES + 1024, 0x61);
    const oversizedForm = new FormData();
    oversizedForm.append('title', 'Too Large File');
    oversizedForm.append('category', 'Travel');
    oversizedForm.append('amount', '900');
    oversizedForm.append('expenseDate', '2026-11-10');
    oversizedForm.append('receipt', new Blob([hugeBuffer], { type: 'image/png' }), 'huge.png');

    const oversizedRes = await fetch(expensesUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: oversizedForm,
    });
    assert.equal(oversizedRes.status, 400);

    const badCatRes = await fetch(expensesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Unknown Cat',
        category: 'Gaming',
        amount: 100,
        expenseDate: '2026-11-10',
      }),
    });
    assert.equal(badCatRes.status, 400);

    // 6. Create expenses via multipart/form-data (PNG receipt) & JSON
    const travelForm = new FormData();
    travelForm.append('title', 'Colombo Airport PickMe');
    travelForm.append('category', 'Travel');
    travelForm.append('amount', '4500.50');
    travelForm.append('currency', 'lkr');
    travelForm.append('expenseDate', '2026-11-12T08:30:00Z');
    travelForm.append('paymentMethod', 'Card');
    travelForm.append('vendor', 'PickMe Sri Lanka');
    travelForm.append('notes', 'Client meeting airport transfer');
    travelForm.append('receipt', new Blob([samplePng], { type: 'image/png' }), 'pickme-nov.png');

    const createTravelRes = await fetch(expensesUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: travelForm,
    });
    assert.equal(createTravelRes.status, 201);
    const travelExpense = (await createTravelRes.json()).data;
    assert.equal(travelExpense.userId, userAId);
    assert.equal(travelExpense.currency, 'LKR');
    assert.equal(travelExpense.amount, 4500.5);
    assert.ok(travelExpense.receiptAttachment?.url.startsWith('data:image/png;base64,'));
    assert.equal(travelExpense.receiptAttachment?.originalName, 'pickme-nov.png');

    const createSwRes = await fetch(expensesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Figma Team Plan',
        category: 'Software & Subscriptions',
        amount: 12000,
        currency: 'LKR',
        expenseDate: '2026-11-18T10:00:00Z',
        paymentMethod: 'Card',
        vendor: 'Figma Inc',
      }),
    });
    assert.equal(createSwRes.status, 201);
    const swExpense = (await createSwRes.json()).data;

    // Different month expense (2026-10) to verify monthly isolation
    const createOctRes = await fetch(expensesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'October Paper Reams',
        category: 'Office Supplies',
        amount: 3200,
        expenseDate: '2026-10-25T09:00:00Z',
      }),
    });
    assert.equal(createOctRes.status, 201);

    // 7. List & filter GET /api/expenses (month, category, search, sort descending)
    const novListRes = await fetch(`${expensesUrl}?month=2026-11`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(novListRes.status, 200);
    const novList = (await novListRes.json()).data;
    assert.equal(novList.length, 2);
    assert.equal(novList[0].title, 'Figma Team Plan', 'Should sort expenseDate descending');
    assert.equal(novList[1].title, 'Colombo Airport PickMe');

    const searchRes = await fetch(`${expensesUrl}?month=2026-11&category=Travel&search=PickMe`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(searchRes.status, 200);
    const searchData = (await searchRes.json()).data;
    assert.equal(searchData.length, 1);
    assert.equal(searchData[0]._id, travelExpense._id);

    // 8. Category Budgets Upsert & Monthly Summary Aggregation
    const budgetUpsertRes = await fetch(`${expensesUrl}/budgets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        month: '2026-11',
        category: 'Travel',
        limitAmount: 10000,
      }),
    });
    assert.equal(budgetUpsertRes.status, 200);
    assert.equal((await budgetUpsertRes.json()).data.limitAmount, 10000);

    // Upsert same { userId, month, category } updates cleanly without duplicate conflict
    const budgetUpdateRes = await fetch(`${expensesUrl}/budgets`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        month: '2026-11',
        budgets: [
          { category: 'Travel', limitAmount: 9000 },
          { category: 'Software & Subscriptions', limitAmount: 10000 },
        ],
      }),
    });
    assert.equal(budgetUpdateRes.status, 200);

    const summaryRes = await fetch(`${expensesUrl}/summary?month=2026-11`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(summaryRes.status, 200);
    const summary = await summaryRes.json();
    assert.equal(summary.month, '2026-11');
    assert.equal(summary.totalSpent, 16500.5);
    assert.equal(summary.totalBudget, 19000);
    assert.equal(summary.totalTransactions, 2);

    const travelCat = summary.categories.find((c) => c.category === 'Travel');
    assert.equal(travelCat.spent, 4500.5);
    assert.equal(travelCat.budgetLimit, 9000);
    assert.equal(travelCat.remaining, 4499.5);
    assert.equal(travelCat.percentUsed, 50.01);
    assert.equal(travelCat.transactionCount, 1);
    assert.equal(travelCat.isOverBudget, false);

    const swCat = summary.categories.find((c) => c.category === 'Software & Subscriptions');
    assert.equal(swCat.spent, 12000);
    assert.equal(swCat.budgetLimit, 10000);
    assert.equal(swCat.remaining, 0);
    assert.equal(swCat.percentUsed, 120);
    assert.equal(swCat.isOverBudget, true);

    // 9. Update expense & replace attachment with PDF, then remove receipt
    const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    const replaceForm = new FormData();
    replaceForm.append('title', 'Colombo Airport PickMe (Updated)');
    replaceForm.append('amount', '5000');
    replaceForm.append('receipt', new Blob([samplePdf], { type: 'application/pdf' }), 'pickme.pdf');

    const putRes = await fetch(`${expensesUrl}/${travelExpense._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: replaceForm,
    });
    assert.equal(putRes.status, 200);
    const updatedTravel = (await putRes.json()).data;
    assert.equal(updatedTravel.title, 'Colombo Airport PickMe (Updated)');
    assert.equal(updatedTravel.amount, 5000);
    assert.ok(updatedTravel.receiptAttachment.url.startsWith('data:application/pdf;base64,'));
    assert.equal(updatedTravel.receiptAttachment.resourceType, 'raw');

    const removeReceiptRes = await fetch(`${expensesUrl}/${travelExpense._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ removeReceipt: true }),
    });
    assert.equal(removeReceiptRes.status, 200);
    assert.equal((await removeReceiptRes.json()).data.receiptAttachment.url, '');

    // 10. Strict Cross-User Isolation (User B)
    const listBRes = await fetch(`${expensesUrl}?month=2026-11`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(listBRes.status, 200);
    assert.equal((await listBRes.json()).count, 0);

    const summaryBRes = await fetch(`${expensesUrl}/summary?month=2026-11`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(summaryBRes.status, 200);
    const summaryB = await summaryBRes.json();
    assert.equal(summaryB.totalSpent, 0);
    assert.equal(summaryB.totalBudget, 0);

    const foreignPut = await fetch(`${expensesUrl}/${travelExpense._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ title: 'Tampered' }),
    });
    assert.equal(foreignPut.status, 404);

    const foreignDelete = await fetch(`${expensesUrl}/${travelExpense._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(foreignDelete.status, 404);

    // 11. Admin endpoint RBAC & pagination
    const nonAdminRes = await fetch(`${expensesUrl}/admin`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(nonAdminRes.status, 403);

    const adminOverviewRes = await fetch(`${expensesUrl}/admin?page=1&limit=2&month=2026-11`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminOverviewRes.status, 200);
    const adminBody = await adminOverviewRes.json();
    assert.equal(adminBody.pagination.total, 2);
    assert.equal(adminBody.data[0].owner.email, 'expense.usera@smarttools.dev');

    // 12. Owner DELETE cleans up expense and reflects in summary
    const delRes = await fetch(`${expensesUrl}/${swExpense._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes.status, 200);

    const afterDelSummary = await (
      await fetch(`${expensesUrl}/summary?month=2026-11`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    ).json();
    assert.equal(afterDelSummary.totalSpent, 5000);
    assert.equal(afterDelSummary.totalTransactions, 1);

    console.log('PASS: Expense Tracker API integration tests passed!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
}

runExpenseTests().catch((err) => {
  console.error('Expense integration test failed:', err);
  process.exit(1);
});
