import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

let validateEnv;

before(async () => {
  ({ validateEnv } = await import('../../../src/config/env.js'));
});

const VALID_URI = 'mongodb+srv://user:pass@cluster.example.net/smart_tools_db';

describe('validateEnv (SmartTools + SEO Analyzer)', () => {
  it('applies SmartTools and SEO defaults when optional values are missing', () => {
    const { env, errors } = validateEnv({ MONGODB_URI: VALID_URI });

    assert.deepEqual(errors, []);
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.PORT, 5000);
    assert.equal(env.CLIENT_ORIGIN, 'http://localhost:5173');
    assert.equal(env.FETCH_TIMEOUT_MS, 10000);
    assert.equal(env.FETCH_MAX_BYTES, 2097152);
    assert.equal(env.FETCH_MAX_REDIRECTS, 5);
    assert.equal(env.RATE_LIMIT_ANALYZE_PER_15MIN, 10);
    assert.equal(env.RATE_LIMIT_GLOBAL_PER_15MIN, 200);
  });

  it('defaults MONGODB_URI to smart_tools_db or errors when requireMongoUri is true', () => {
    const fallback = validateEnv({});
    assert.equal(fallback.errors.length, 0);
    assert.equal(fallback.env.MONGODB_URI, 'mongodb://127.0.0.1:27017/smart_tools_db');

    const strict = validateEnv({}, { requireMongoUri: true });
    assert.ok(strict.errors.includes('MONGODB_URI is required'));
  });

  it('rejects invalid numbers, NODE_ENV, and CLIENT_ORIGIN', () => {
    const { errors } = validateEnv({
      MONGODB_URI: VALID_URI,
      NODE_ENV: 'staging',
      PORT: 'abc',
      FETCH_MAX_REDIRECTS: '-1',
      CLIENT_ORIGIN: 'not a url',
    });

    assert.equal(errors.length, 4);
  });

  it('normalises CLIENT_ORIGIN / FRONTEND_ORIGIN to an exact origin', () => {
    const { env } = validateEnv({
      MONGODB_URI: VALID_URI,
      FRONTEND_ORIGIN: 'https://smarttools.example.com/path',
    });
    assert.equal(env.CLIENT_ORIGIN, 'https://smarttools.example.com');
    assert.equal(env.FRONTEND_ORIGIN, 'https://smarttools.example.com');
  });
});
