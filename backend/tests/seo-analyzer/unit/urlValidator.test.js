import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalizeUrl } from '../../../src/modules/seo-analyzer/utils/urlValidator.js';

const assertRejectsWithCode = (fn, expectedCode, expectedStatus) => {
  assert.throws(fn, (err) => {
    assert.equal(err.name, 'AppError');
    assert.equal(err.code, expectedCode);
    assert.equal(err.statusCode, expectedStatus);
    return true;
  });
};

describe('validateAndNormalizeUrl', () => {
  it('accepts valid http and https URLs, trims whitespace, and strips hash fragments', () => {
    const httpResult = validateAndNormalizeUrl('  http://Example.com/blog/post?page=1#section-2  ');
    assert.equal(httpResult.url, 'http://example.com/blog/post?page=1');
    assert.equal(httpResult.protocol, 'http:');
    assert.equal(httpResult.hostname, 'example.com');
    assert.equal(httpResult.pathname, '/blog/post');
    assert.equal(httpResult.search, '?page=1');

    const httpsResult = validateAndNormalizeUrl('https://example.com:443/about#top');
    assert.equal(httpsResult.url, 'https://example.com/about');
    assert.equal(httpsResult.protocol, 'https:');

    const explicitPort80 = validateAndNormalizeUrl('http://example.com:80/');
    assert.equal(explicitPort80.url, 'http://example.com/');
  });

  it('rejects missing, non-string, or empty URLs with 400 INVALID_URL', () => {
    for (const badInput of [undefined, null, 123, {}, '', '   ']) {
      assertRejectsWithCode(() => validateAndNormalizeUrl(badInput), 'INVALID_URL', 400);
    }
  });

  it('rejects URLs missing a scheme or using non-http(s) schemes with 400 INVALID_URL', () => {
    const disallowed = [
      'example.com',
      'www.example.com/page',
      'ftp://example.com/file.html',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<h1>Hi</h1>',
      'mailto:user@example.com',
      'ws://example.com/socket',
    ];

    for (const raw of disallowed) {
      assertRejectsWithCode(() => validateAndNormalizeUrl(raw), 'INVALID_URL', 400);
    }
  });

  it('rejects URLs containing embedded credentials (username or password) with 400 INVALID_URL', () => {
    assertRejectsWithCode(() => validateAndNormalizeUrl('http://user:pass@example.com/'), 'INVALID_URL', 400);
    assertRejectsWithCode(() => validateAndNormalizeUrl('https://admin@example.com/'), 'INVALID_URL', 400);
    assertRejectsWithCode(() => validateAndNormalizeUrl('https://:secret@example.com/'), 'INVALID_URL', 400);
  });

  it('rejects disallowed ports with 400 BLOCKED_URL', () => {
    const badPorts = [
      'http://example.com:8080/',
      'https://example.com:8443/',
      'http://example.com:3000/',
      'http://example.com:22/',
      'http://example.com:27017/',
      'http://example.com:443/',
      'https://example.com:80/',
    ];

    for (const raw of badPorts) {
      assertRejectsWithCode(() => validateAndNormalizeUrl(raw), 'BLOCKED_URL', 400);
    }
  });

  it('rejects localhost-style hostnames with 400 BLOCKED_URL', () => {
    const blockedHosts = [
      'http://localhost/',
      'https://LOCALHOST/admin',
      'http://localhost./',
      'http://api.localhost/',
      'http://dev.app.localhost/',
      'http://printer.local/',
      'http://my-nas.local./',
      'http://metadata.internal/',
      'https://db.prod.internal/status',
    ];

    for (const raw of blockedHosts) {
      assertRejectsWithCode(() => validateAndNormalizeUrl(raw), 'BLOCKED_URL', 400);
    }
  });

  it('rejects URLs exceeding 2048 characters with 400 INVALID_URL', () => {
    const atLimitUrl = `https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}`;
    assert.equal(atLimitUrl.length, 2048);
    assert.equal(validateAndNormalizeUrl(atLimitUrl).url, atLimitUrl);

    const overLimitUrl = `${atLimitUrl}a`;
    assertRejectsWithCode(() => validateAndNormalizeUrl(overLimitUrl), 'INVALID_URL', 400);
  });
});

