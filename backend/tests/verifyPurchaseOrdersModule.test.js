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

console.log('--- Running Supplier Directory & Purchase Order Generator API Integration Tests ---');

async function runPurchaseOrderTests() {
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
  const suppliersUrl = `${baseUrl}/api/suppliers`;
  const poUrl = `${baseUrl}/api/purchase-orders`;
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
        fullName: 'Procurement Manager A',
        email: 'po.usera@smarttools.dev',
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
        fullName: 'Procurement Manager B',
        email: 'po.userb@smarttools.dev',
        password: 'PasswordB@123',
      }),
    });
    assert.equal(regBRes.status, 201);
    const regBBody = await regBRes.json();
    const tokenB = regBBody.accessToken;
    const userBId = regBBody.user.id;

    // 2. Supplier Directory CRUD & Strict User Isolation (/api/suppliers)
    const guestSuppliersTry = await fetch(suppliersUrl);
    assert.equal(guestSuppliersTry.status, 401, 'Guests must receive 401 on /api/suppliers');

    const createSupARes = await fetch(suppliersUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Ceylon Industrial Hardware Ltd',
        contactPerson: 'Nimal Perera',
        email: 'sales@ceylonhardware.lk',
        phone: '+94 11 555 4433',
        address: '120 Industrial Zone, Biyagama',
        taxId: 'VAT-LK-8811',
        paymentTerms: 'Net 30',
        notes: 'Primary steel & fasteners vendor',
      }),
    });
    assert.equal(createSupARes.status, 201);
    const supplierA = (await createSupARes.json()).data;
    assert.equal(String(supplierA.userId), userAId);
    assert.equal(supplierA.name, 'Ceylon Industrial Hardware Ltd');

    // User B listing /api/suppliers sees 0 records from User A
    const listSupBRes = await fetch(suppliersUrl, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(listSupBRes.status, 200);
    assert.equal((await listSupBRes.json()).data.length, 0);

    // User B cannot update or delete User A's supplier (404)
    const updateSupByB = await fetch(`${suppliersUrl}/${supplierA._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Hijacked Supplier' }),
    });
    assert.equal(updateSupByB.status, 404);

    const deleteSupByB = await fetch(`${suppliersUrl}/${supplierA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(deleteSupByB.status, 404);

    // User A updates own supplier
    const updateSupByA = await fetch(`${suppliersUrl}/${supplierA._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentTerms: 'Net 45', contactPerson: 'Nimal P.' }),
    });
    assert.equal(updateSupByA.status, 200);
    const updatedSupplierA = (await updateSupByA.json()).data;
    assert.equal(updatedSupplierA.paymentTerms, 'Net 45');
    assert.equal(updatedSupplierA.contactPerson, 'Nimal P.');
    console.log('✓ 1. /api/suppliers CRUD & strict user ownership isolation verified');

    // 3. Guest POST /api/purchase-orders (userId: null, auto PO-YYYY-0001, server-side math tampering prevention)
    const currentYear = new Date().getUTCFullYear();
    const guestPoRes = await fetch(poUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer: {
          name: 'Apex Construction Group',
          address: '55 Union Place, Colombo 02',
          phone: '+94 11 200 3000',
          email: 'procurement@apex.lk',
        },
        supplier: {
          name: 'Lanka Cement Distributors',
          contactPerson: 'Kasun Silva',
          email: 'orders@lankacement.lk',
        },
        deliveryAddress: 'Site B, Port City Colombo',
        shippingMethod: 'Flatbed Truck',
        currency: 'LKR',
        items: [
          {
            description: 'Portland Cement 50kg Bag',
            sku: 'CEM-50KG',
            quantity: 10,
            unitPrice: 2500,
            lineTotal: 1, // tampered client value must be ignored (real = 25000)
          },
          {
            description: 'Reinforcement Steel Bar 12mm',
            sku: 'REB-12MM',
            quantity: 5,
            unitPrice: 3000,
            lineTotal: 1, // tampered client value must be ignored (real = 15000)
          },
        ],
        subtotal: 2, // tampered (real = 40000)
        discount: 5000, // taxable base = 35000
        taxRate: 10, // taxAmount = 3500
        taxAmount: 0, // tampered (real = 3500)
        grandTotal: 10, // tampered (real = 38500)
        approvals: {
          preparedBy: { name: 'S. Jayawardena', title: 'Site Engineer' },
          approvedBy: { name: 'R. Fernando', title: 'Director', status: 'Approved' },
        },
        terms: 'Deliver within 7 days of PO date.',
      }),
    });
    assert.equal(guestPoRes.status, 201, `Expected 201 for Guest PO, got ${guestPoRes.status}`);
    const guestPo = (await guestPoRes.json()).data;
    assert.equal(guestPo.userId, null);
    assert.equal(guestPo.poNumber, `PO-${currentYear}-0001`);
    assert.equal(guestPo.items[0].lineTotal, 25000);
    assert.equal(guestPo.items[1].lineTotal, 15000);
    assert.equal(guestPo.subtotal, 40000);
    assert.equal(guestPo.discount, 5000);
    assert.equal(guestPo.taxAmount, 3500);
    assert.equal(guestPo.grandTotal, 38500);
    assert.equal(guestPo.approvals.approvedBy.status, 'Approved');
    console.log('✓ 2. Guest POST /api/purchase-orders, auto PO-YYYY-0001, and server-side total recalculation verified');

    // 4. Authenticated User A & User B create POs (linking User A's Supplier Directory entry)
    const userAPoRes = await fetch(poUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        supplierId: supplierA._id,
        buyer: { name: 'User A Manufacturing' },
        items: [
          {
            description: 'M10 Stainless Bolts (Box of 100)',
            sku: 'BLT-M10',
            quantity: 4,
            unitPrice: 4500,
          },
        ],
        taxRate: 0,
        discount: 0,
      }),
    });
    assert.equal(userAPoRes.status, 201);
    const poA = (await userAPoRes.json()).data;
    assert.equal(String(poA.userId), userAId);
    assert.equal(poA.poNumber, `PO-${currentYear}-0002`);
    assert.equal(poA.supplier.name, 'Ceylon Industrial Hardware Ltd', 'Supplier name auto-filled from directory');
    assert.equal(poA.grandTotal, 18000);

    const userBPoRes = await fetch(poUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        buyer: { name: 'User B Logistics' },
        supplier: { name: 'Metro Packaging' },
        items: [{ description: 'Corrugated Cartons', quantity: 100, unitPrice: 120 }],
      }),
    });
    assert.equal(userBPoRes.status, 201);
    const poB = (await userBPoRes.json()).data;
    assert.equal(String(poB.userId), userBId);

    // GET /api/purchase-orders/my for User A returns strictly poA
    const myPoARes = await fetch(`${poUrl}/my`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(myPoARes.status, 200);
    const myPoAList = (await myPoARes.json()).data;
    assert.equal(myPoAList.length, 1);
    assert.equal(String(myPoAList[0]._id), String(poA._id));
    console.log('✓ 3. Authenticated POST /api/purchase-orders (with supplierId directory link) & GET /my isolation verified');

    // 5. GET /api/purchase-orders/admin (403 for standard user, 200 paginated all 3 POs for admin)
    const userAdminPoTry = await fetch(`${poUrl}/admin`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userAdminPoTry.status, 403);

    const adminPoListRes = await fetch(`${poUrl}/admin?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminPoListRes.status, 200);
    const adminPoBody = await adminPoListRes.json();
    assert.equal(adminPoBody.pagination.total, 3);
    assert.equal(adminPoBody.data.length, 3);
    console.log('✓ 4. GET /api/purchase-orders/admin RBAC (403 user / 200 paginated admin) verified');

    // 6. DELETE /api/purchase-orders/:id & DELETE /api/suppliers/:id
    const userBDelPoA = await fetch(`${poUrl}/${poA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(userBDelPoA.status, 403, 'Non-owner deleting PO must receive 403');

    const userADelOwnPo = await fetch(`${poUrl}/${poA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userADelOwnPo.status, 200);

    const adminDelGuestPo = await fetch(`${poUrl}/${guestPo._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDelGuestPo.status, 200);

    const userADelSup = await fetch(`${suppliersUrl}/${supplierA._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userADelSup.status, 200);
    console.log('✓ 5. DELETE /api/purchase-orders/:id & DELETE /api/suppliers/:id authorization verified');

    console.log('\nALL SUPPLIER DIRECTORY & PURCHASE ORDER BACKEND API TESTS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
}

runPurchaseOrderTests().catch((err) => {
  console.error('Purchase Order & Supplier API verification FAILED:', err);
  process.exit(1);
});
