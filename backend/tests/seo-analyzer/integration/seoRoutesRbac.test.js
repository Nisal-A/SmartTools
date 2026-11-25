import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import {
  connectDatabase,
  clearInMemoryDatabase,
  disconnectDatabase,
} from '../../../src/config/db.js';
import { createApp } from '../../../src/app.js';
import { seedAdmin } from '../../../src/scripts/seedAdmin.js';
import {
  setAuditServiceDependencies,
  resetAuditServiceDependencies,
} from '../../../src/modules/seo-analyzer/services/auditService.js';
import { AdminAuditLog } from '../../../src/modules/admin/models/adminAuditLog.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_HTML = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/valid-page.html'),
  'utf8'
);

const createOfflineFetcher = () => async (url, options = {}) => {
  if (url.endsWith('/robots.txt')) {
    return {
      url,
      finalUrl: url,
      status: 200,
      headers: { 'content-type': 'text/plain' },
      body: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
      redirectChain: [],
    };
  }
  if (url.endsWith('.xml')) {
    return {
      url,
      finalUrl: url,
      status: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>',
      redirectChain: [],
    };
  }
  if (options.requireHtml === false) {
    return { url, finalUrl: url, status: 404, headers: {}, body: '', redirectChain: [] };
  }
  return {
    url,
    finalUrl: url,
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: VALID_HTML,
    redirectChain: [],
  };
};

describe('SEO Analyzer API & SmartTools RBAC Isolation (/api/v1/seo)', () => {
  let app;
  let adminToken;
  let tokenA;
  let userAId;
  let tokenB;
  let userBId;

  before(async () => {
    await connectDatabase();
    app = createApp();
  });

  after(async () => {
    resetAuditServiceDependencies();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    clearInMemoryDatabase();
    setAuditServiceDependencies({ fetcher: createOfflineFetcher() });

    process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
    process.env.ADMIN_PASSWORD = 'AdminPassword@123';
    await seedAdmin();

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@smarttools.dev', password: 'AdminPassword@123' });
    adminToken = adminLogin.body.accessToken;

    const regA = await request(app).post('/api/v1/auth/register').send({
      email: 'seo.alice@smarttools.dev',
      password: 'PasswordA123!',
      fullName: 'Alice SEO',
    });
    tokenA = regA.body.accessToken;
    userAId = regA.body.user.id;

    const regB = await request(app).post('/api/v1/auth/register').send({
      email: 'seo.bob@smarttools.dev',
      password: 'PasswordB123!',
      fullName: 'Bob SEO',
    });
    tokenB = regB.body.accessToken;
    userBId = regB.body.user.id;
  });

  it('allows Guest analysis + own result view, blocks other guests, and exposes ONLY aggregate stats', async () => {
    const guestClientId = 'guest_browser_alpha_123';

    const analyzeRes = await request(app)
      .post('/api/v1/seo/analyze')
      .set('X-Client-Id', guestClientId)
      .send({ url: 'https://guest-site.example.com/' });

    assert.equal(analyzeRes.status, 201);
    const guestAudit = analyzeRes.body.data;
    assert.equal(guestAudit.isGuestAudit, true);
    assert.equal(guestAudit.userId, null);
    assert.equal(guestAudit.clientId, guestClientId);
    assert.ok(guestAudit.overallScore >= 0 && guestAudit.overallScore <= 100);

    // Same guest session can immediately view their own audit
    const ownViewRes = await request(app)
      .get(`/api/v1/seo/audits/${guestAudit._id}`)
      .set('X-Client-Id', guestClientId);
    assert.equal(ownViewRes.status, 200);
    assert.equal(ownViewRes.body.data._id, guestAudit._id);

    // Different guest session receives 404
    const otherGuestRes = await request(app)
      .get(`/api/v1/seo/audits/${guestAudit._id}`)
      .set('X-Client-Id', 'guest_browser_beta_999');
    assert.equal(otherGuestRes.status, 404);

    // Guest cannot list history (401)
    const guestListRes = await request(app).get('/api/v1/seo/audits');
    assert.equal(guestListRes.status, 401);

    // Public global stats contain ONLY aggregate metrics (zero URLs or PII)
    const statsRes = await request(app).get('/api/v1/seo/stats');
    assert.equal(statsRes.status, 200);
    const stats = statsRes.body.data;
    assert.equal(stats.totalAudits, 1);
    assert.equal(typeof stats.averageScore, 'number');
    assert.ok(Array.isArray(stats.categoryAverages) && stats.categoryAverages.length > 0);
    const serialized = JSON.stringify(stats);
    assert.ok(!serialized.includes('guest-site.example.com'), 'Stats must never leak URLs');
    assert.ok(!serialized.includes(guestClientId), 'Stats must never leak client IDs');
  });

  it('enforces strict User A vs User B isolation across /api/v1/seo/audits, /api/v1/history, and /api/v1/admin/history', async () => {
    const auditARes = await request(app)
      .post('/api/v1/seo/analyze')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ url: 'https://alice-domain.example.com/' });
    assert.equal(auditARes.status, 201);
    const auditA = auditARes.body.data;
    assert.equal(auditA.isGuestAudit, false);
    assert.equal(String(auditA.userId), userAId);

    const auditBRes = await request(app)
      .post('/api/v1/seo/analyze')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ url: 'https://bob-secret-domain.example.com/' });
    assert.equal(auditBRes.status, 201);
    const auditB = auditBRes.body.data;
    assert.equal(String(auditB.userId), userBId);

    // User A listing with spoofed ?userId=<UserB> ONLY receives User A's audit
    const listARes = await request(app)
      .get(`/api/v1/seo/audits?userId=${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(listARes.status, 200);
    assert.equal(listARes.body.data.length, 1);
    assert.equal(listARes.body.data[0]._id, auditA._id);

    // User A requesting or deleting User B's audit receives 404
    const getBAsA = await request(app)
      .get(`/api/v1/seo/audits/${auditB._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(getBAsA.status, 404);

    const delBAsA = await request(app)
      .delete(`/api/v1/seo/audits/${auditB._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(delBAsA.status, 404);

    // Unified User History adapter (`GET /api/v1/history?toolType=seo`) returns strictly User A's SEO audit
    const unifiedARes = await request(app)
      .get(`/api/v1/history?toolType=seo&userId=${userBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(unifiedARes.status, 200);
    assert.equal(unifiedARes.body.data.length, 1);
    assert.equal(unifiedARes.body.data[0].toolType, 'seo');
    assert.equal(unifiedARes.body.data[0].id, auditA._id);

    // Standard User A receives 403 on Admin Global History
    const adminTryA = await request(app)
      .get('/api/v1/admin/history?toolType=seo')
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(adminTryA.status, 403);

    // Admin sees BOTH User A and User B SEO audits and logs VIEW_GLOBAL_HISTORY + VIEW_USER_DOCUMENT
    const adminHistoryRes = await request(app)
      .get('/api/v1/admin/history?toolType=seo')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminHistoryRes.status, 200);
    assert.equal(adminHistoryRes.body.data.length, 2);

    const adminInspectB = await request(app)
      .get(`/api/v1/admin/history/seo/${auditB._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminInspectB.status, 200);
    assert.equal(adminInspectB.body.data.owner.email, 'seo.bob@smarttools.dev');
    assert.ok(Array.isArray(adminInspectB.body.data.document.seoChecks));

    const auditLogs = await AdminAuditLog.find({
      action: { $in: ['VIEW_GLOBAL_HISTORY', 'VIEW_USER_DOCUMENT'] },
    }).lean();
    assert.ok(auditLogs.length >= 2, 'Admin inspections must write to admin_audit_logs');

    // Admin can delete any audit
    const adminDeleteB = await request(app)
      .delete(`/api/v1/seo/audits/${auditB._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminDeleteB.status, 204);
  });

  it('blocks SSRF targets (localhost & cloud metadata IP) when using real safeFetch', async () => {
    resetAuditServiceDependencies();

    const localhostRes = await request(app)
      .post('/api/v1/seo/analyze')
      .send({ url: 'http://127.0.0.1/secret' });
    assert.equal(localhostRes.status, 400);
    assert.equal(localhostRes.body.error.code, 'BLOCKED_URL');

    const metadataRes = await request(app)
      .post('/api/v1/seo/analyze')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });
    assert.equal(metadataRes.status, 400);
    assert.equal(metadataRes.body.error.code, 'BLOCKED_URL');
  });
});
