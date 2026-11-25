import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp, getNormalizedAllowedOrigins } from '../src/app.js';
import { getRefreshCookieOptions } from '../src/middleware/auth.middleware.js';
import {
  RENDER_SAFE_CHROMIUM_ARGS,
  getPuppeteerPoolStats,
} from '../src/config/puppeteerPool.js';

console.log('--- Running Render Deployment Readiness Verification ---');

async function verifyRenderReadiness() {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevClientUrl = process.env.CLIENT_URL;
  const prevKeepalive = process.env.KEEPALIVE_SECRET;

  try {
    // 1. Express trust proxy === 1 & CLIENT_URL normalization (trailing slash + comma-separated)
    process.env.CLIENT_URL =
      'https://smarttools-ui.onrender.com/, https://preview.smarttools.dev/';
    assert.deepEqual(getNormalizedAllowedOrigins(), [
      'https://smarttools-ui.onrender.com',
      'https://preview.smarttools.dev',
    ]);

    const app = createApp();
    assert.equal(app.get('trust proxy'), 1, 'app.get("trust proxy") must equal 1');

    // CORS allows configured origin (trimmed) with credentials and blocks unknown origin
    const allowedCors = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://smarttools-ui.onrender.com');
    assert.equal(
      allowedCors.headers['access-control-allow-origin'],
      'https://smarttools-ui.onrender.com'
    );
    assert.equal(allowedCors.headers['access-control-allow-credentials'], 'true');

    const blockedCors = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://evil-attacker.example.com');
    assert.equal(blockedCors.headers['access-control-allow-origin'], undefined);
    console.log('✓ 1. trust proxy=1 & comma-separated CLIENT_URL CORS normalization verified');

    // 2. /api/v1/system/ping keep-alive endpoint (public vs KEEPALIVE_SECRET)
    delete process.env.KEEPALIVE_SECRET;
    const openPing = await request(app).get('/api/v1/system/ping');
    assert.equal(openPing.status, 200);
    assert.equal(openPing.body.pong, true);

    process.env.KEEPALIVE_SECRET = 'render-cron-secret-999';
    const rejectedPing = await request(app).get('/api/v1/system/ping');
    assert.equal(rejectedPing.status, 401);

    const validSecretPing = await request(app)
      .get('/api/v1/system/ping')
      .set('x-keepalive-key', 'render-cron-secret-999');
    assert.equal(validSecretPing.status, 200);
    console.log('✓ 2. /api/v1/system/ping keep-alive endpoint verified (with & without KEEPALIVE_SECRET)');

    // 3. Cross-site production cookie options (`sameSite: 'none', secure: true` vs dev `'lax'`)
    process.env.NODE_ENV = 'development';
    assert.deepEqual(getRefreshCookieOptions(), {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    process.env.NODE_ENV = 'production';
    assert.deepEqual(getRefreshCookieOptions(), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    });
    console.log('✓ 3. Shared cross-site refresh cookie options verified for dev & production');

    // 4. Puppeteer 512MB RAM flags & maxConcurrency=2 in production
    assert.equal(
      getPuppeteerPoolStats().maxConcurrency,
      2,
      'Production Puppeteer concurrency must be capped at 2'
    );
    for (const requiredFlag of [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
    ]) {
      assert.ok(
        RENDER_SAFE_CHROMIUM_ARGS.includes(requiredFlag),
        `Missing Render Chromium flag: ${requiredFlag}`
      );
    }
    console.log('✓ 4. Puppeteer Render 512MB flags & production concurrency cap (2) verified');

    console.log('\nALL RENDER DEPLOYMENT READINESS CHECKS PASSED!');
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;

    if (prevClientUrl === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = prevClientUrl;

    if (prevKeepalive === undefined) delete process.env.KEEPALIVE_SECRET;
    else process.env.KEEPALIVE_SECRET = prevKeepalive;
  }
}

verifyRenderReadiness().catch((err) => {
  console.error('Render Readiness Verification FAILED:', err);
  process.exit(1);
});
