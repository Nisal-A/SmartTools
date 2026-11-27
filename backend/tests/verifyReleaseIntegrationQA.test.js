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

console.log('--- Running Full-Stack Release Security & RBAC Audit Tests ---');

async function runAudit() {
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
  const v1Url = `${baseUrl}/api/v1`;

  try {
    const adminToken = (
      await (
        await fetch(`${v1Url}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@smarttools.dev',
            password: 'AdminPassword@123',
          }),
        })
      ).json()
    ).accessToken;

    const regABody = await (
      await fetch(`${v1Url}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Audit User A',
          email: 'audit.a@smarttools.dev',
          password: 'PasswordA@123',
        }),
      })
    ).json();
    const tokenA = regABody.accessToken;

    const regBBody = await (
      await fetch(`${v1Url}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Audit User B',
          email: 'audit.b@smarttools.dev',
          password: 'PasswordB@123',
        }),
      })
    ).json();
    const tokenB = regBBody.accessToken;

    // 1. Seed one owned record in each of the 4 new tools as User A
    const receiptA = (
      await (
        await fetch(`${baseUrl}/api/receipts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            business: { name: 'User A Studio' },
            customer: { name: 'Client A' },
            amountPaid: 2500,
          }),
        })
      ).json()
    ).data;

    const poA = (
      await (
        await fetch(`${baseUrl}/api/purchase-orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            buyer: { name: 'User A Studio' },
            supplier: { name: 'Supplier A' },
            items: [{ description: 'Item A', quantity: 2, unitPrice: 1000 }],
          }),
        })
      ).json()
    ).data;

    const expenseA = (
      await (
        await fetch(`${baseUrl}/api/expenses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            title: 'User A Travel',
            category: 'Travel',
            amount: 1200,
            expenseDate: '2026-11-15',
          }),
        })
      ).json()
    ).data;

    const proposalA = (
      await (
        await fetch(`${baseUrl}/api/proposals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            clientName: 'Client A',
            projectTitle: 'User A Portal',
            brief: 'Develop a dedicated customer portal for quarterly invoicing.',
          }),
        })
      ).json()
    ).data;

    // 2. Audit ALL /admin endpoints for 401 (guest), 403 Forbidden (User A & B), and 200 (Admin)
    const adminPaths = [
      '/api/v1/admin/history',
      '/api/receipts/admin',
      '/api/v1/receipts/admin',
      '/api/purchase-orders/admin',
      '/api/v1/purchase-orders/admin',
      '/api/expenses/admin',
      '/api/v1/expenses/admin',
      '/api/proposals/admin',
      '/api/v1/proposals/admin',
    ];

    for (const pathSuffix of adminPaths) {
      const guestRes = await fetch(`${baseUrl}${pathSuffix}`);
      assert.equal(guestRes.status, 401, `Guest must receive 401 on ${pathSuffix}`);

      const userARes = await fetch(`${baseUrl}${pathSuffix}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(userARes.status, 403, `Standard user must receive 403 on ${pathSuffix}`);

      const adminRes = await fetch(`${baseUrl}${pathSuffix}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(adminRes.status, 200, `Admin must receive 200 on ${pathSuffix}`);
    }
    console.log('✓ 1. All 9 /admin routes verified: 401 guest, 403 Forbidden non-admin, 200 admin');

    // 3. Audit User B isolation across all /my & CRUD endpoints
    for (const myPath of [
      '/api/receipts/my',
      '/api/purchase-orders/my',
      '/api/expenses',
      '/api/proposals/my',
    ]) {
      const resB = await fetch(`${baseUrl}${myPath}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(resB.status, 200);
      const bodyB = await resB.json();
      assert.equal(bodyB.count, 0, `User B must see 0 records on ${myPath}`);
    }

    assert.equal(
      (
        await fetch(`${baseUrl}/api/receipts/${receiptA._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenB}` },
        })
      ).status,
      403
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/purchase-orders/${poA._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenB}` },
        })
      ).status,
      403
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/expenses/${expenseA._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenB}`,
          },
          body: JSON.stringify({ title: 'Tamper' }),
        })
      ).status,
      404
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/expenses/${expenseA._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenB}` },
        })
      ).status,
      404
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/proposals/${proposalA._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenB}`,
          },
          body: JSON.stringify({ status: 'Handed Off' }),
        })
      ).status,
      404
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/proposals/${proposalA._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenB}` },
        })
      ).status,
      403
    );
    console.log('✓ 2. Strict User A vs. User B isolation verified across all /my, PUT, and DELETE endpoints');

    console.log('\nALL RELEASE SECURITY & RBAC AUDIT CHECKS PASSED!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
}

runAudit().catch((err) => {
  console.error('Release RBAC audit FAILED:', err);
  process.exit(1);
});
