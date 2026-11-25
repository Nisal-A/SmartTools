import assert from 'node:assert/strict';
import {
  connectDatabase,
  clearInMemoryDatabase,
  disconnectDatabase,
} from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { seedAdmin } from '../src/scripts/seedAdmin.js';
import { User } from '../src/modules/authentication/user.model.js';
import { UserProfile } from '../src/modules/profiles/userProfile.model.js';
import { BusinessProfile } from '../src/modules/profiles/businessProfile.model.js';
import { FileMetadata } from '../src/modules/profiles/fileMetadata.model.js';
import { getNextSequence } from '../src/utils/counterService.js';
import {
  requireAuth,
  optionalAuth,
} from '../src/middleware/auth.middleware.js';
import { requireAdmin } from '../src/middleware/role.middleware.js';

console.log(
  '--- Running Platform Task 1: Auth, RBAC, Profiles & Shared Customers Integration Tests ---'
);

function extractCookieValue(setCookieHeader, cookieName = 'refreshToken') {
  if (!setCookieHeader) return null;
  const raw = Array.isArray(setCookieHeader)
    ? setCookieHeader.join('; ')
    : String(setCookieHeader);
  const match = raw.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function runTests() {
  await connectDatabase();
  clearInMemoryDatabase();

  const app = createApp();

  // Mount test-only probe routes before 404 handler by creating a wrapper app or testing on a sub-app
  // Note: createApp() mounts notFoundHandler at the end, so let's also mount a small RBAC & optionalAuth probe router on a fresh express instance or test via app
  const express = (await import('express')).default;
  const cookieParser = (await import('cookie-parser')).default;
  const testApp = express();
  testApp.use(cookieParser());
  testApp.use(express.json());
  testApp.get('/probe/optional', optionalAuth, (req, res) => {
    res.status(200).json({ user: req.user });
  });
  testApp.get('/probe/admin', requireAuth, requireAdmin, (req, res) => {
    res.status(200).json({ adminAccess: true, user: req.user });
  });
  testApp.use(app);

  const server = await new Promise((resolve) => {
    const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const apiUrl = `${baseUrl}/api/v1`;

  try {
    // =========================================================================
    // 1. Verify seedAdmin.js Idempotency (run twice)
    // =========================================================================
    process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
    process.env.ADMIN_PASSWORD = 'AdminPassword@123';

    const seedRun1 = await seedAdmin();
    assert.equal(seedRun1.created, true, 'First seedAdmin run should create admin user');
    assert.equal(seedRun1.admin.email, 'admin@smarttools.dev');
    assert.equal(seedRun1.admin.role, 'admin');

    const seedRun2 = await seedAdmin();
    assert.equal(
      seedRun2.created,
      false,
      'Second seedAdmin run must be idempotent (created === false)'
    );
    assert.equal(
      seedRun2.admin.id,
      seedRun1.admin.id,
      'Second seedAdmin run must return the exact same admin user ID'
    );

    const adminCount = await User.countDocuments({ email: 'admin@smarttools.dev' });
    assert.equal(adminCount, 1, 'Only 1 admin document should exist after running seedAdmin twice');
    console.log('✓ 1. seedAdmin.js executed twice and confirmed idempotent');

    // =========================================================================
    // 2. User Signup (User A & User B) + Bcrypt 12 rounds + Default Profiles
    // =========================================================================
    const regARes = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userA@example.com',
        password: 'PasswordA123!',
        fullName: 'Alice Founder',
        businessName: 'Alice Digital Studio',
      }),
    });
    assert.equal(regARes.status, 201, 'User A registration should return 201');
    const regABody = await regARes.json();
    assert.ok(regABody.accessToken, 'User A registration must return accessToken');
    assert.equal(regABody.user.email, 'usera@example.com');
    assert.equal(regABody.user.role, 'user');
    assert.deepEqual(regABody.user.pinnedToolIds, [
      'invoice-generator',
      'quotation-generator',
      'seo-analyzer',
    ]);

    const setCookieA = regARes.headers.get('set-cookie');
    assert.ok(
      setCookieA && setCookieA.includes('HttpOnly'),
      'Registration must set an HttpOnly refresh token cookie'
    );

    // Confirm bcrypt 12 rounds in database
    const dbUserA = await User.findOne({ email: 'usera@example.com' }).lean();
    assert.ok(
      dbUserA.passwordHash.startsWith('$2a$12$') ||
        dbUserA.passwordHash.startsWith('$2b$12$'),
      `Password hash must use 12 bcrypt rounds, got: ${dbUserA.passwordHash.slice(0, 10)}`
    );

    // Register User B
    const regBRes = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userB@example.com',
        password: 'PasswordB123!',
        fullName: 'Bob Consultant',
      }),
    });
    assert.equal(regBRes.status, 201, 'User B registration should return 201');
    const regBBody = await regBRes.json();
    const tokenB = regBBody.accessToken;
    console.log('✓ 2. User A & User B signup verified (12-round bcrypt + HttpOnly cookie)');

    // =========================================================================
    // 3. Login & Token Refresh Rotation
    // =========================================================================
    const loginARes = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userA@example.com',
        password: 'PasswordA123!',
      }),
    });
    assert.equal(loginARes.status, 200, 'Login should return 200');
    const loginABody = await loginARes.json();
    let tokenA = loginABody.accessToken;
    const refreshCookie1 = extractCookieValue(loginARes.headers.get('set-cookie'));
    assert.ok(refreshCookie1, 'Login must set refreshToken cookie');

    // Refresh token rotation
    const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `refreshToken=${refreshCookie1}`,
      },
    });
    assert.equal(refreshRes.status, 200, 'Token refresh should return 200');
    const refreshBody = await refreshRes.json();
    assert.ok(refreshBody.accessToken, 'Refresh must return new accessToken');
    tokenA = refreshBody.accessToken;

    const refreshCookie2 = extractCookieValue(refreshRes.headers.get('set-cookie'));
    assert.ok(refreshCookie2, 'Refresh must set rotated refreshToken cookie');
    assert.notEqual(
      refreshCookie1,
      refreshCookie2,
      'Rotated refresh token must differ from previous token'
    );

    // Reusing old refresh token must fail with 401
    const replayRefreshRes = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `refreshToken=${refreshCookie1}`,
      },
    });
    assert.equal(
      replayRefreshRes.status,
      401,
      'Replaying rotated-out refresh token must return 401'
    );
    console.log('✓ 3. Login and refresh token rotation verified');

    // =========================================================================
    // 4. Pinned Tools Update, Password Change & RBAC (requireAuth, optionalAuth, requireAdmin)
    // =========================================================================
    const pinRes = await fetch(`${apiUrl}/auth/me/pinned-tools`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        pinnedToolIds: ['invoice-generator'],
      }),
    });
    assert.equal(pinRes.status, 200, 'PATCH /me/pinned-tools should return 200');
    const pinBody = await pinRes.json();
    assert.deepEqual(pinBody.data.pinnedToolIds, ['invoice-generator']);

    // Check optionalAuth without token -> req.user === null
    const guestProbe = await fetch(`${baseUrl}/probe/optional`);
    const guestProbeData = await guestProbe.json();
    assert.equal(guestProbeData.user, null, 'optionalAuth without token must set req.user = null');

    // Check optionalAuth with token -> req.user populated
    const authProbe = await fetch(`${baseUrl}/probe/optional`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const authProbeData = await authProbe.json();
    assert.equal(authProbeData.user.email, 'usera@example.com');

    // Check requireAdmin rejects User A with 403 Forbidden
    const userAdminTry = await fetch(`${baseUrl}/probe/admin`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(
      userAdminTry.status,
      403,
      'Standard user accessing requireAdmin route must receive 403 Forbidden'
    );

    // Login as seeded Admin and verify requireAdmin succeeds (200)
    const adminLoginRes = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@smarttools.dev',
        password: 'AdminPassword@123',
      }),
    });
    assert.equal(adminLoginRes.status, 200);
    const { accessToken: adminToken } = await adminLoginRes.json();

    const adminProbe = await fetch(`${baseUrl}/probe/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminProbe.status, 200, 'Admin user must pass requireAdmin guard');

    // Password update test
    const pwRes = await fetch(`${apiUrl}/auth/me/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        currentPassword: 'PasswordA123!',
        newPassword: 'NewPasswordA456!',
      }),
    });
    assert.equal(pwRes.status, 200, 'Password update should return 200');

    // Login with new password
    const reloginARes = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userA@example.com',
        password: 'NewPasswordA456!',
      }),
    });
    assert.equal(reloginARes.status, 200, 'Login with updated password must succeed');
    tokenA = (await reloginARes.json()).accessToken;
    console.log('✓ 4. Pinned tools, password change, optionalAuth, and requireAdmin RBAC verified');

    // =========================================================================
    // 5. Profile Management (GET /me, PUT /personal, PUT /business, POST /business/logo)
    // =========================================================================
    const profMeRes = await fetch(`${apiUrl}/profiles/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(profMeRes.status, 200);
    const profMeBody = await profMeRes.json();
    assert.ok(profMeBody.data.personalProfile, 'GET /profiles/me must return personalProfile');
    assert.ok(profMeBody.data.businessProfile, 'GET /profiles/me must return businessProfile');

    // Update Personal Profile
    const putPersonalRes = await fetch(`${apiUrl}/profiles/personal`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        fullName: 'Alice Founder Updated',
        phone: '+1-555-0199',
        timezone: 'America/New_York',
        locale: 'en-US',
      }),
    });
    assert.equal(putPersonalRes.status, 200);
    const putPersonalBody = await putPersonalRes.json();
    assert.equal(putPersonalBody.data.fullName, 'Alice Founder Updated');
    assert.equal(putPersonalBody.data.phone, '+1-555-0199');

    // Update Business Profile
    const putBusinessRes = await fetch(`${apiUrl}/profiles/business`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        businessName: 'Alice Global Ventures LLC',
        taxRegistrationNo: 'EIN-99-1234567',
        email: 'billing@aliceventures.dev',
        phone: '+1-555-0100',
        website: 'https://aliceventures.dev',
        address: {
          street: '100 Innovation Way',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'USA',
        },
        bankDetails: {
          bankName: 'First Tech Bank',
          accountName: 'Alice Global Ventures LLC',
          accountNumber: '1122334455',
          routingOrSwift: 'FTBUS66',
        },
        defaultCurrency: 'EUR',
        defaultTaxRate: 15,
        defaultPaymentTerms: 'Net 15 days',
        defaultInvoiceSize: 'LETTER',
        defaultQuotationSize: 'LEGAL',
      }),
    });
    assert.equal(putBusinessRes.status, 200);
    const putBusinessBody = await putBusinessRes.json();
    assert.equal(putBusinessBody.data.businessName, 'Alice Global Ventures LLC');
    assert.equal(putBusinessBody.data.defaultCurrency, 'EUR');
    assert.equal(putBusinessBody.data.defaultTaxRate, 15);
    assert.equal(putBusinessBody.data.defaultInvoiceSize, 'LETTER');
    assert.equal(putBusinessBody.data.defaultQuotationSize, 'LEGAL');

    // Upload Business Logo via multipart/form-data (Multer memory upload -> Cloudinary / dev fallback)
    const samplePngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const formData = new FormData();
    const blob = new Blob([samplePngBytes], { type: 'image/png' });
    formData.append('logo', blob, 'company-logo.png');

    const logoRes = await fetch(`${apiUrl}/profiles/business/logo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      body: formData,
    });
    assert.equal(logoRes.status, 200, 'POST /profiles/business/logo should return 200');
    const logoBody = await logoRes.json();
    assert.ok(logoBody.data.logoUrl, 'Logo upload must return logoUrl');
    assert.ok(logoBody.data.logoFileId, 'Logo upload must return logoFileId');
    assert.equal(
      logoBody.data.businessProfile.logoUrl,
      logoBody.data.logoUrl,
      'Business profile must be updated with logoUrl'
    );

    const fileMetaCount = await FileMetadata.countDocuments({
      _id: logoBody.data.logoFileId,
    });
    assert.equal(fileMetaCount, 1, 'file_metadata record must be persisted');
    console.log('✓ 5. Personal profile, business profile, and Multer/Cloudinary logo upload verified');

    // =========================================================================
    // 6. Shared Customers CRUD & Cross-User Isolation (User B gets 404 on User A's Customer)
    // =========================================================================
    const createCustRes = await fetch(`${apiUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Acme Enterprise Corp',
        companyName: 'Acme Enterprise Inc.',
        email: 'accounts@acme.example.com',
        phone: '+1-800-555-0192',
        taxId: 'TAX-ACME-001',
        billingAddress: {
          street: '742 Evergreen Terrace',
          city: 'Springfield',
          state: 'IL',
          postalCode: '62701',
          country: 'USA',
        },
        notes: 'Priority enterprise client',
      }),
    });
    assert.equal(createCustRes.status, 201, 'Create customer should return 201');
    const createdCustomer = (await createCustRes.json()).data;
    const customerIdA = createdCustomer._id;
    assert.ok(customerIdA, 'Created customer must have _id');

    // Search & Pagination on GET /customers
    const listCustRes = await fetch(`${apiUrl}/customers?search=Acme&page=1&limit=10`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(listCustRes.status, 200);
    const listCustBody = await listCustRes.json();
    assert.equal(listCustBody.data.length, 1);
    assert.equal(listCustBody.pagination.total, 1);

    // Get Customer by ID (User A)
    const getCustARes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getCustARes.status, 200);

    // Update Customer by ID (User A)
    const updateCustARes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Acme Enterprise Corp Updated',
        phone: '+1-800-555-9999',
      }),
    });
    assert.equal(updateCustARes.status, 200);
    const updatedCustomer = (await updateCustARes.json()).data;
    assert.equal(updatedCustomer.name, 'Acme Enterprise Corp Updated');

    // CROSS-USER ISOLATION: User B attempts GET, PUT, DELETE on User A's customerId -> MUST get 404
    const userBGetRes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(
      userBGetRes.status,
      404,
      'User B MUST receive 404 Not Found when requesting User A customer ID'
    );

    const userBPutRes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ name: 'Hijacked Customer' }),
    });
    assert.equal(
      userBPutRes.status,
      404,
      'User B MUST receive 404 Not Found when attempting to update User A customer ID'
    );

    const userBDelRes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(
      userBDelRes.status,
      404,
      'User B MUST receive 404 Not Found when attempting to delete User A customer ID'
    );

    // User A deletes their own customer -> 200
    const userADelRes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userADelRes.status, 200, 'User A deleting own customer should return 200');

    const getAfterDelRes = await fetch(`${apiUrl}/customers/${customerIdA}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getAfterDelRes.status, 404, 'Deleted customer should return 404');
    console.log(
      '✓ 6. Shared Customers full CRUD and strict cross-user 404 isolation verified'
    );

    // =========================================================================
    // 7. Atomic Counter Utility (`getNextSequence`)
    // =========================================================================
    const currentYear = new Date().getUTCFullYear();
    const invSeq1 = await getNextSequence(dbUserA._id, 'invoice', 'INV');
    const invSeq2 = await getNextSequence(dbUserA._id, 'invoice', 'INV');
    const quoSeq1 = await getNextSequence(dbUserA._id, 'quotation', 'QUO');

    assert.equal(invSeq1, `INV-${currentYear}-0001`);
    assert.equal(invSeq2, `INV-${currentYear}-0002`);
    assert.equal(quoSeq1, `QUO-${currentYear}-0001`);
    console.log(
      `✓ 7. Atomic Counter Utility verified (${invSeq1}, ${invSeq2}, ${quoSeq1})`
    );

    console.log('\nALL PLATFORM TASK 1 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('Platform Task 1 Verification FAILED:', err);
  process.exit(1);
});
