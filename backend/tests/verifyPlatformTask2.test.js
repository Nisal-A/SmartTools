import assert from 'node:assert/strict';
import {
  connectDatabase,
  clearInMemoryDatabase,
  disconnectDatabase,
} from '../src/config/db.js';
import { shutdownPuppeteerPool } from '../src/config/puppeteerPool.js';
import { createApp } from '../src/app.js';
import { seedAdmin } from '../src/scripts/seedAdmin.js';
import { AdminAuditLog } from '../src/modules/admin/models/adminAuditLog.model.js';

console.log(
  '--- Running Platform Task 2: Unified Document History & Admin Governance Security Tests ---'
);

async function runTests() {
  await connectDatabase();
  clearInMemoryDatabase();

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const apiUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // =========================================================================
    // 1. Seed Admin & Register Standard Users A and B
    // =========================================================================
    process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
    process.env.ADMIN_PASSWORD = 'AdminPassword@123';
    const seeded = await seedAdmin();
    const adminId = seeded.admin.id;

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

    const regARes = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@smarttools.dev',
        password: 'AlicePassword123!',
        fullName: 'Alice Builder',
        businessName: 'Alice Studio LLC',
      }),
    });
    assert.equal(regARes.status, 201);
    const regABody = await regARes.json();
    const tokenA = regABody.accessToken;
    const userAId = regABody.user.id;

    const regBRes = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob@smarttools.dev',
        password: 'BobPassword123!',
        fullName: 'Bob Architect',
        businessName: 'Bob Architecture Inc',
      }),
    });
    assert.equal(regBRes.status, 201);
    const regBBody = await regBRes.json();
    const tokenB = regBBody.accessToken;
    const userBId = regBBody.user.id;

    // =========================================================================
    // 2. Seed Invoices & Quotations for User A and User B
    // =========================================================================
    // User A creates 1 Invoice ($1,000, $400 paid -> $600 balance) and 1 Quotation ($2,500)
    const createInvARes = await fetch(`${apiUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        issueDate: '2026-11-01',
        dueDate: '2026-11-10', // past due date -> overdue check
        currency: 'USD',
        status: 'sent',
        businessSnapshot: {
          businessName: 'Alice Studio LLC',
          email: 'alice@smarttools.dev',
        },
        customerSnapshot: {
          name: 'Client Alpha Corp',
          email: 'alpha@client.example.com',
        },
        items: [
          {
            name: 'Full-Stack Web Platform',
            quantity: 1,
            unitPrice: 1000,
            taxRate: 0,
            discountValue: 0,
          },
        ],
        amountPaid: 400,
      }),
    });
    assert.equal(createInvARes.status, 201);
    const invoiceA = (await createInvARes.json()).data;

    const createQuoARes = await fetch(`${apiUrl}/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        issueDate: '2026-11-20',
        validUntil: '2026-12-20',
        currency: 'USD',
        status: 'sent',
        businessSnapshot: {
          businessName: 'Alice Studio LLC',
        },
        customerSnapshot: {
          name: 'Client Gamma Holdings',
        },
        items: [
          {
            name: 'Enterprise Cloud Retainer',
            quantity: 5,
            unitPrice: 500,
            taxRate: 0,
            discountValue: 0,
          },
        ],
      }),
    });
    assert.equal(createQuoARes.status, 201);
    const quotationA = (await createQuoARes.json()).data;

    // User B creates 1 Invoice ($3,200) and 1 Quotation ($900)
    const createInvBRes = await fetch(`${apiUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        issueDate: '2026-11-22',
        dueDate: '2026-12-22',
        currency: 'USD',
        status: 'sent',
        businessSnapshot: {
          businessName: 'Bob Architecture Inc',
        },
        customerSnapshot: {
          name: 'Secret Client Omega',
        },
        items: [
          {
            name: 'Architectural Blueprint Package',
            quantity: 4,
            unitPrice: 800,
            taxRate: 0,
            discountValue: 0,
          },
        ],
      }),
    });
    assert.equal(createInvBRes.status, 201);
    const invoiceB = (await createInvBRes.json()).data;

    const createQuoBRes = await fetch(`${apiUrl}/quotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        issueDate: '2026-11-23',
        validUntil: '2026-12-23',
        currency: 'USD',
        status: 'accepted',
        businessSnapshot: {
          businessName: 'Bob Architecture Inc',
        },
        customerSnapshot: {
          name: 'Secret Client Sigma',
        },
        items: [
          {
            name: 'Site Inspection Consultation',
            quantity: 3,
            unitPrice: 300,
            taxRate: 0,
            discountValue: 0,
          },
        ],
      }),
    });
    assert.equal(createQuoBRes.status, 201);
    const quotationB = (await createQuoBRes.json()).data;
    console.log('✓ 1. Seeded Admin, User A, User B, and independent Invoices & Quotations');

    // =========================================================================
    // 3. SECURITY CHECK 1: Standard User A calling GET /api/v1/history?userId=<UserB>
    //    MUST ONLY receive User A's records!
    // =========================================================================
    const spoofedHistoryRes = await fetch(
      `${apiUrl}/history?userId=${encodeURIComponent(userBId)}`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.equal(spoofedHistoryRes.status, 200);
    const spoofedHistoryBody = await spoofedHistoryRes.json();

    assert.equal(
      spoofedHistoryBody.data.length,
      2,
      'User A must receive strictly their 2 documents (1 invoice + 1 quotation)'
    );
    for (const item of spoofedHistoryBody.data) {
      assert.equal(
        item.userId,
        userAId,
        `History leak detected! Expected userId ${userAId}, got ${item.userId}`
      );
      assert.notEqual(
        item.customerName,
        'Secret Client Omega',
        'User B customer name must never appear in User A history'
      );
      // Verify normalized History DTO fields
      assert.ok(item.id);
      assert.ok(['invoice', 'quotation'].includes(item.toolType));
      assert.ok(item.documentNumber);
      assert.ok(item.customerName);
      assert.equal(item.currency, 'USD');
      assert.equal(typeof item.grandTotal, 'number');
      assert.ok(item.pageSize);
      assert.ok(item.status);
    }

    // Filter User A history by toolType=invoice
    const onlyInvARes = await fetch(`${apiUrl}/history?toolType=invoice`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(onlyInvARes.status, 200);
    const onlyInvABody = await onlyInvARes.json();
    assert.equal(onlyInvABody.data.length, 1);
    assert.equal(onlyInvABody.data[0].toolType, 'invoice');
    assert.equal(onlyInvABody.data[0].id, String(invoiceA._id));
    console.log(
      '✓ 2. Security Check 1 Passed: GET /api/v1/history?userId=<UserB> strictly returned ONLY User A records'
    );

    // =========================================================================
    // 4. Dashboard Summary (`GET /api/v1/dashboard/summary`) Scoped to User A
    // =========================================================================
    const dashARes = await fetch(`${apiUrl}/dashboard/summary`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(dashARes.status, 200);
    const dashA = (await dashARes.json()).data;
    assert.equal(dashA.totalInvoiced, 1000, 'User A totalInvoiced must be 1000');
    assert.equal(dashA.totalPaid, 400, 'User A totalPaid must be 400');
    assert.equal(dashA.pendingBalance, 600, 'User A pendingBalance must be 600');
    assert.equal(dashA.overdueCount, 1, 'User A overdueCount must be 1');
    assert.equal(dashA.activeQuotationsCount, 1, 'User A activeQuotationsCount must be 1');
    assert.equal(dashA.recentDocuments.length, 2, 'User A recentDocuments must have 2 items');
    console.log('✓ 3. User-scoped Dashboard Summary KPIs verified');

    // =========================================================================
    // 5. SECURITY CHECK 2: Standard User A calling Admin endpoints receives 403 Forbidden
    // =========================================================================
    const userAAdminHistoryRes = await fetch(`${apiUrl}/admin/history`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(
      userAAdminHistoryRes.status,
      403,
      'Standard User A calling GET /api/v1/admin/history must receive 403 Forbidden'
    );

    const userAAdminUsersRes = await fetch(`${apiUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(
      userAAdminUsersRes.status,
      403,
      'Standard User A calling GET /api/v1/admin/users must receive 403 Forbidden'
    );

    const userAAdminLogsRes = await fetch(`${apiUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(
      userAAdminLogsRes.status,
      403,
      'Standard User A calling GET /api/v1/admin/audit-logs must receive 403 Forbidden'
    );
    console.log(
      '✓ 4. Security Check 2 Passed: Standard User A received 403 Forbidden on all /api/v1/admin/* endpoints'
    );

    // =========================================================================
    // 6. SECURITY CHECK 3: Admin calling GET /api/v1/admin/history receives
    //    both User A and User B records and writes VIEW_GLOBAL_HISTORY to admin_audit_logs
    // =========================================================================
    const adminHistoryRes = await fetch(`${apiUrl}/admin/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminHistoryRes.status, 200);
    const adminHistoryBody = await adminHistoryRes.json();

    assert.equal(
      adminHistoryBody.data.length,
      4,
      'Admin global history must return all 4 documents across User A and User B'
    );

    const ownerEmails = new Set(
      adminHistoryBody.data.map((d) => d.owner?.email)
    );
    assert.ok(
      ownerEmails.has('alice@smarttools.dev') &&
        ownerEmails.has('bob@smarttools.dev'),
      'Admin global history must populate owner.email for both User A and User B'
    );

    // Filter Admin history by ownerEmail=bob@smarttools.dev
    const bobOnlyAdminRes = await fetch(
      `${apiUrl}/admin/history?ownerEmail=bob@smarttools.dev`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.equal(bobOnlyAdminRes.status, 200);
    const bobOnlyAdminBody = await bobOnlyAdminRes.json();
    assert.equal(bobOnlyAdminBody.data.length, 2);
    assert.ok(
      bobOnlyAdminBody.data.every((d) => d.owner.email === 'bob@smarttools.dev')
    );

    // Inspect User B's Quotation details as Admin (`GET /api/v1/admin/history/:type/:id`)
    const inspectQuoBRes = await fetch(
      `${apiUrl}/admin/history/quotation/${quotationB._id}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.equal(inspectQuoBRes.status, 200);
    const inspectQuoBBody = await inspectQuoBRes.json();
    assert.equal(inspectQuoBBody.data.toolType, 'quotation');
    assert.equal(inspectQuoBBody.data.owner.email, 'bob@smarttools.dev');
    assert.equal(inspectQuoBBody.data.document.items.length, 1);

    // Verify VIEW_GLOBAL_HISTORY and VIEW_USER_DOCUMENT audit logs were created
    const globalHistoryLogs = await AdminAuditLog.find({
      action: 'VIEW_GLOBAL_HISTORY',
    }).lean();
    assert.ok(
      globalHistoryLogs.length >= 2,
      'admin_audit_logs must record VIEW_GLOBAL_HISTORY entries'
    );

    const viewDocLog = await AdminAuditLog.findOne({
      action: 'VIEW_USER_DOCUMENT',
      resourceId: String(quotationB._id),
    }).lean();
    assert.ok(viewDocLog, 'admin_audit_logs must record VIEW_USER_DOCUMENT');
    assert.equal(String(viewDocLog.targetUserId), userBId);
    console.log(
      '✓ 5. Security Check 3 Passed: Admin received cross-user history & document inspection with immutable audit logs'
    );

    // =========================================================================
    // 7. Unified Document PDF Export (`GET /api/v1/documents/:type/:id/pdf`) & Audit Log
    // =========================================================================
    // User A cannot export User B's invoice PDF -> 404
    const userAExportUserBRes = await fetch(
      `${apiUrl}/documents/invoice/${invoiceB._id}/pdf`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.equal(
      userAExportUserBRes.status,
      404,
      'User A requesting User B PDF via /documents/:type/:id/pdf must receive 404'
    );

    // Admin exports User B's invoice PDF -> 200 + EXPORT_USER_DOCUMENT_PDF audit log
    const adminExportUserBRes = await fetch(
      `${apiUrl}/documents/invoice/${invoiceB._id}/pdf?size=A5`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );
    assert.equal(adminExportUserBRes.status, 200);
    assert.equal(adminExportUserBRes.headers.get('content-type'), 'application/pdf');
    const pdfBytes = Buffer.from(await adminExportUserBRes.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 5).toString('ascii'), '%PDF-');

    const exportAuditLog = await AdminAuditLog.findOne({
      action: 'EXPORT_USER_DOCUMENT_PDF',
      resourceId: String(invoiceB._id),
    }).lean();
    assert.ok(
      exportAuditLog,
      'Admin exporting another user PDF must write EXPORT_USER_DOCUMENT_PDF to admin_audit_logs'
    );
    assert.equal(String(exportAuditLog.targetUserId), userBId);
    console.log(
      '✓ 6. Unified PDF export (/api/v1/documents/:type/:id/pdf) and EXPORT_USER_DOCUMENT_PDF audit log verified'
    );

    // =========================================================================
    // 8. Admin User Management & Safeguards (`/api/v1/admin/users`, role, status, audit-logs)
    // =========================================================================
    const usersListRes = await fetch(`${apiUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(usersListRes.status, 200);
    const usersListBody = await usersListRes.json();
    assert.equal(usersListBody.data.length, 3, 'Should list Admin, User A, and User B');
    const userAEntry = usersListBody.data.find((u) => u.id === userAId);
    assert.equal(userAEntry.invoiceCount, 1);
    assert.equal(userAEntry.quotationCount, 1);

    // Prevent last active admin from demoting themselves
    const selfDemoteRes = await fetch(`${apiUrl}/admin/users/${adminId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'user' }),
    });
    assert.equal(
      selfDemoteRes.status,
      400,
      'Last active admin must be prevented from demoting themselves'
    );

    // Prevent admin from suspending themselves
    const selfSuspendRes = await fetch(`${apiUrl}/admin/users/${adminId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(
      selfSuspendRes.status,
      400,
      'Admin must be prevented from suspending their own account'
    );

    // Promote User B to admin, then demote back to user
    const promoteBRes = await fetch(`${apiUrl}/admin/users/${userBId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    assert.equal(promoteBRes.status, 200);
    assert.equal((await promoteBRes.json()).data.role, 'admin');

    const demoteBRes = await fetch(`${apiUrl}/admin/users/${userBId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ role: 'user' }),
    });
    assert.equal(demoteBRes.status, 200);
    assert.equal((await demoteBRes.json()).data.role, 'user');

    // Suspend User B and verify User B is blocked on subsequent requests
    const suspendBRes = await fetch(`${apiUrl}/admin/users/${userBId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(suspendBRes.status, 200);
    assert.equal((await suspendBRes.json()).data.isActive, false);

    const suspendedUserBTry = await fetch(`${apiUrl}/history`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(
      suspendedUserBTry.status,
      403,
      'Suspended user must be rejected with 403 on requireAuth endpoints'
    );

    // Query paginated audit logs via GET /api/v1/admin/audit-logs
    const auditLogsRes = await fetch(`${apiUrl}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(auditLogsRes.status, 200);
    const auditLogsBody = await auditLogsRes.json();
    const loggedActions = new Set(auditLogsBody.data.map((l) => l.action));
    assert.ok(loggedActions.has('VIEW_GLOBAL_HISTORY'));
    assert.ok(loggedActions.has('VIEW_USER_DOCUMENT'));
    assert.ok(loggedActions.has('EXPORT_USER_DOCUMENT_PDF'));
    assert.ok(loggedActions.has('UPDATE_USER_ROLE'));
    assert.ok(loggedActions.has('TOGGLE_USER_STATUS'));
    console.log(
      '✓ 7. Admin User Management, self-demotion/self-suspension guards, and GET /api/v1/admin/audit-logs verified'
    );

    console.log('\nALL PLATFORM TASK 2 SECURITY & GOVERNANCE CHECKS PASSED SUCCESSFULLY!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await shutdownPuppeteerPool();
    await disconnectDatabase();
  }
}

runTests().catch((err) => {
  console.error('Platform Task 2 Verification FAILED:', err);
  process.exit(1);
});
