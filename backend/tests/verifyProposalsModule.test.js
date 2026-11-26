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
  parseAndValidateProposalJson,
  setGeminiFetchForTests,
} from '../src/utils/geminiProposalGenerator.js';

console.log('--- Running AI Proposal Writer & Draft CRUD API Integration Tests ---');

const VALID_AI_JSON = {
  sections: {
    executiveSummary: 'Modernize Lanka Retail Group online storefront with a high-speed MERN commerce platform.',
    problemStatement: 'Current legacy site suffers from slow checkout speed and manual inventory updates.',
    proposedSolution: 'Deploy a React SPA storefront backed by Node.js microservices and automated stock sync.',
    deliverables: [
      'Responsive Storefront UI & Product Catalog',
      'Cart, Checkout & Payment Gateway Integration',
      'Admin Inventory & Order Management Dashboard',
    ],
    timeline: [
      {
        phase: 'Discovery & UX Architecture',
        duration: '2 Weeks',
        summary: 'Requirements workshops, wireframes, and data model sign-off.',
      },
      {
        phase: 'Core Engineering & QA',
        duration: '4 Weeks',
        summary: 'API development, frontend build, payment tests, and UAT launch.',
      },
    ],
    termsAndNextSteps: '50% mobilization upon sign-off, 50% upon production UAT approval. Valid for 14 days.',
  },
  suggestedLineItems: [
    { description: 'UX Architecture & Storefront UI', quantity: 1, unitPrice: 185000 },
    { description: 'Backend Commerce API & Payment Integration', quantity: 1, unitPrice: 240000 },
  ],
};

async function runProposalTests() {
  enableInMemoryMongooseEngine();
  clearInMemoryDatabase();

  process.env.ADMIN_EMAIL = 'admin@smarttools.dev';
  process.env.ADMIN_PASSWORD = 'AdminPassword@123';
  await seedAdmin({ allowInMemoryFallback: true });

  // 1. Direct JSON parser unit checks (fenced markdown + malformed JSON -> 502)
  const fencedResult = parseAndValidateProposalJson(
    `\`\`\`json\n${JSON.stringify(VALID_AI_JSON)}\n\`\`\``
  );
  assert.equal(fencedResult.sections.deliverables.length, 3);
  assert.equal(fencedResult.suggestedLineItems[0].unitPrice, 185000);

  assert.throws(
    () => parseAndValidateProposalJson('Here is your proposal: {not valid json at all'),
    (err) => err.statusCode === 502 && err.code === 'AI_MALFORMED_JSON'
  );
  assert.throws(
    () => parseAndValidateProposalJson(JSON.stringify({ sections: {}, suggestedLineItems: [] })),
    (err) => err.statusCode === 502 && err.code === 'AI_INVALID_SCHEMA'
  );
  assert.throws(
    () => parseAndValidateProposalJson('   '),
    (err) => err.statusCode === 502 && err.code === 'AI_EMPTY_RESPONSE'
  );
  console.log('✓ 1. JSON parser strict validation & 502 malformed/schema error fallbacks verified');

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const proposalsUrl = `${baseUrl}/api/proposals`;
  const v1Url = `${baseUrl}/api/v1`;

  const savedGeminiKey = process.env.GEMINI_API_KEY;
  const savedRateLimit = process.env.RATE_LIMIT_PROPOSAL_GEN_PER_15MIN;

  try {
    // 2. Authenticate Admin, User A, and User B
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
          fullName: 'Consultant A',
          email: 'proposal.usera@smarttools.dev',
          password: 'PasswordA@123',
        }),
      })
    ).json();
    const tokenA = regABody.accessToken;
    const userAId = regABody.user.id;

    const regBBody = await (
      await fetch(`${v1Url}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Consultant B',
          email: 'proposal.userb@smarttools.dev',
          password: 'PasswordB@123',
        }),
      })
    ).json();
    const tokenB = regBBody.accessToken;

    // 3. Reject unauthenticated calls with 401
    for (const [method, url] of [
      ['POST', `${proposalsUrl}/generate`],
      ['POST', proposalsUrl],
      ['GET', `${proposalsUrl}/my`],
      ['GET', `${proposalsUrl}/admin`],
    ]) {
      const r = await fetch(url, { method });
      assert.equal(r.status, 401, `Expected 401 on unauthenticated ${method} ${url}`);
    }

    // 4. Missing GEMINI_API_KEY -> clean 503 error; invalid payload -> 400
    delete process.env.GEMINI_API_KEY;
    const missingKeyRes = await fetch(`${proposalsUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientName: 'Ruwan Silva',
        projectTitle: 'Commerce Replatform',
        brief: 'Build a modern online store with local payments and inventory alerts.',
      }),
    });
    assert.equal(missingKeyRes.status, 503);
    assert.match((await missingKeyRes.json()).message, /GEMINI_API_KEY/i);

    process.env.GEMINI_API_KEY = 'test-fake-gemini-key-only';

    const shortBriefRes = await fetch(`${proposalsUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientName: 'Ruwan Silva',
        projectTitle: 'Commerce Replatform',
        brief: 'Too short',
      }),
    });
    assert.equal(shortBriefRes.status, 400);

    // 5. Mock Gemini API responses: Malformed -> 502, Upstream 429 -> 429, Valid JSON -> 200
    setGeminiFetchForTests(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: 'Sorry I cannot output JSON { broken markdown' }],
              },
            },
          ],
        };
      },
    }));

    const malformedRes = await fetch(`${proposalsUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientName: 'Ruwan Silva',
        projectTitle: 'Commerce Replatform',
        brief: 'Build a modern online store with local payments and inventory alerts.',
      }),
    });
    assert.equal(malformedRes.status, 502);
    assert.match((await malformedRes.json()).message, /malformed/i);

    setGeminiFetchForTests(async () => ({
      ok: false,
      status: 429,
      async json() {
        return { error: { message: 'Resource exhausted' } };
      },
    }));

    const upstream429Res = await fetch(`${proposalsUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientName: 'Ruwan Silva',
        projectTitle: 'Commerce Replatform',
        brief: 'Build a modern online store with local payments and inventory alerts.',
      }),
    });
    assert.equal(upstream429Res.status, 429);

    setGeminiFetchForTests(async (_url, init) => {
      assert.equal(init.headers['x-goog-api-key'], 'test-fake-gemini-key-only');
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(VALID_AI_JSON) }],
                },
              },
            ],
          };
        },
      };
    });

    const genRes = await fetch(`${proposalsUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientName: 'Ruwan Silva',
        clientCompany: 'Lanka Retail Group',
        projectTitle: 'Commerce Replatform',
        brief: 'Build a modern online store with local payments and inventory alerts.',
        budgetHint: 'LKR 450,000',
        timelineHint: '6 Weeks',
        currency: 'LKR',
        tone: 'Executive',
      }),
    });
    assert.equal(genRes.status, 200);
    const genBody = await genRes.json();
    assert.equal(genBody.data.sections.deliverables.length, 3);
    assert.equal(genBody.data.suggestedLineItems.length, 2);
    console.log('✓ 2. /api/proposals/generate validation, 503/502/429 handling & structured JSON verified');

    // 6. Verify Express per-user route rate limiter on User B
    process.env.RATE_LIMIT_PROPOSAL_GEN_PER_15MIN = '2';
    for (let i = 0; i < 2; i += 1) {
      const okAttempt = await fetch(`${proposalsUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`,
        },
        body: JSON.stringify({
          clientName: 'Client B',
          projectTitle: 'Audit Portal',
          brief: 'Develop an internal compliance tracking dashboard for 20 auditors.',
        }),
      });
      assert.equal(okAttempt.status, 200);
    }
    const rateLimitedRes = await fetch(`${proposalsUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        clientName: 'Client B',
        projectTitle: 'Audit Portal',
        brief: 'Develop an internal compliance tracking dashboard for 20 auditors.',
      }),
    });
    assert.equal(rateLimitedRes.status, 429);

    // 7. Persist Proposals (POST /api/proposals), list (/my), update (:id), and isolate User A vs B
    const createRes = await fetch(proposalsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientName: 'Ruwan Silva',
        clientCompany: 'Lanka Retail Group',
        clientEmail: 'ruwan@lankaretail.lk',
        projectTitle: 'Commerce Replatform',
        brief: 'Build a modern online store with local payments and inventory alerts.',
        tone: 'Executive',
        currency: 'LKR',
        sections: genBody.data.sections,
        suggestedLineItems: genBody.data.suggestedLineItems,
      }),
    });
    assert.equal(createRes.status, 201);
    const createdProposal = (await createRes.json()).data;
    assert.match(createdProposal.proposalNumber, /^PRP-\d{4}-0001$/);
    assert.equal(createdProposal.userId, userAId);
    assert.equal(createdProposal.status, 'Draft');

    const myARes = await fetch(`${proposalsUrl}/my`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(myARes.status, 200);
    assert.equal((await myARes.json()).count, 1);

    const myBRes = await fetch(`${proposalsUrl}/my`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(myBRes.status, 200);
    assert.equal((await myBRes.json()).count, 0, 'User B must see zero of User A proposals');

    // User B cannot update or delete User A proposal
    const foreignPut = await fetch(`${proposalsUrl}/${createdProposal._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ status: 'Handed Off' }),
    });
    assert.equal(foreignPut.status, 404);

    const ownerUpdateRes = await fetch(`${proposalsUrl}/${createdProposal._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        status: 'Handed Off',
        sections: {
          ...createdProposal.sections,
          executiveSummary: 'Updated executive summary prior to quotation handoff.',
        },
        suggestedLineItems: [
          ...createdProposal.suggestedLineItems,
          { description: '3 Months Post-Launch Support', quantity: 3, unitPrice: 35000 },
        ],
      }),
    });
    assert.equal(ownerUpdateRes.status, 200);
    const updatedProposal = (await ownerUpdateRes.json()).data;
    assert.equal(updatedProposal.status, 'Handed Off');
    assert.equal(updatedProposal.suggestedLineItems.length, 3);
    console.log('✓ 3. Proposal CRUD (PRP-YYYY-XXXX), /my, Handed Off update & isolation verified');

    // 8. Admin overview & Delete RBAC (403 non-owner, 200 owner/admin)
    const userAdminRes = await fetch(`${proposalsUrl}/admin`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(userAdminRes.status, 403);

    const adminRes = await fetch(`${proposalsUrl}/admin?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.pagination.total, 1);
    assert.equal(adminBody.data[0].owner.email, 'proposal.usera@smarttools.dev');

    const foreignDel = await fetch(`${proposalsUrl}/${createdProposal._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(foreignDel.status, 403);

    const ownerDel = await fetch(`${proposalsUrl}/${createdProposal._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(ownerDel.status, 200);
    console.log('✓ 4. /api/proposals/admin RBAC & DELETE authorization verified');

    console.log('\nALL AI PROPOSAL WRITER BACKEND TESTS PASSED SUCCESSFULLY!');
  } finally {
    setGeminiFetchForTests(null);
    if (savedGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedGeminiKey;
    if (savedRateLimit === undefined) delete process.env.RATE_LIMIT_PROPOSAL_GEN_PER_15MIN;
    else process.env.RATE_LIMIT_PROPOSAL_GEN_PER_15MIN = savedRateLimit;

    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
}

runProposalTests().catch((err) => {
  console.error('AI Proposal Writer integration test FAILED:', err);
  process.exit(1);
});
