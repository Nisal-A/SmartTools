import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { isBlockedIp } from '../../../src/modules/seo-analyzer/utils/ipClassifier.js';
import { resolveAndValidateHost } from '../../../src/modules/seo-analyzer/services/fetch/safeLookup.js';
import { safeFetch } from '../../../src/modules/seo-analyzer/services/fetch/safeFetch.js';

let server;
let serverPort;

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://allowed.example.com');

    switch (url.pathname) {
      case '/ok': {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><html><head><title>Safe Page</title></head><body><h1>Hello</h1></body></html>');
        break;
      }

      case '/redirect-once': {
        res.writeHead(302, { Location: '/ok' });
        res.end();
        break;
      }

      case '/redirect-to-loopback': {
        res.writeHead(302, { Location: 'http://127.0.0.1/admin' });
        res.end();
        break;
      }

      case '/redirect-to-metadata': {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
        break;
      }

      case '/redirect-to-private-host': {
        res.writeHead(302, { Location: 'http://internal-service.example.com/secret' });
        res.end();
        break;
      }

      case '/redirect-loop': {
        const step = Number(url.searchParams.get('step') ?? '0') + 1;
        res.writeHead(302, { Location: `/redirect-loop?step=${step}` });
        res.end();
        break;
      }

      case '/oversize': {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        // Stream 64KB chunks up to >2.2MB unless the client destroys the socket early.
        const chunk = Buffer.alloc(64 * 1024, 'a');
        let sent = 0;
        const total = 36 * 64 * 1024;
        const sendNext = () => {
          while (sent < total && !res.destroyed) {
            sent += chunk.byteLength;
            if (!res.write(chunk)) {
              res.once('drain', sendNext);
              return;
            }
          }
          if (!res.destroyed) res.end();
        };
        sendNext();
        break;
      }

      case '/slow': {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.write('<html><head><title>Slow</title></head><body>');
        const timer = setTimeout(() => {
          if (!res.destroyed) res.end('</body></html>');
        }, 2000);
        res.on('close', () => clearTimeout(timer));
        break;
      }

      case '/json': {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'not html' }));
        break;
      }

      case '/not-found': {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body>Not Found</body></html>');
        break;
      }

      case '/robots.txt': {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('User-agent: *\nAllow: /\n');
        break;
      }

      default: {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('unknown test route');
      }
    }
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

// Test DNS resolver + IP checker that maps ONLY 'allowed.example.com' to the local
// 127.0.0.1 test server while keeping full real isBlockedIp enforcement for every other host/IP.
const testDnsResolver = async (hostname) => {
  if (hostname === 'allowed.example.com') {
    return [{ address: '127.0.0.1', family: 4 }];
  }
  if (hostname === 'internal-service.example.com') {
    return [{ address: '127.0.0.1', family: 4 }];
  }
  if (hostname === 'multi-record.example.com') {
    return [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ];
  }
  if (hostname === 'empty-dns.example.com') {
    return [];
  }
  const err = new Error(`getaddrinfo ENOTFOUND ${hostname}`);
  err.code = 'ENOTFOUND';
  throw err;
};

const testIpChecker = (ip, hostname) => {
  if (hostname === 'allowed.example.com' && ip === '127.0.0.1') {
    return false;
  }
  return isBlockedIp(ip);
};

describe('safeLookup – DNS validation and IP pinning', () => {
  it('rejects empty DNS responses with 502 DNS_FAILED', async () => {
    await assert.rejects(
      () => resolveAndValidateHost('empty-dns.example.com', { dnsResolver: testDnsResolver }),
      (err) => err.code === 'DNS_FAILED' && err.statusCode === 502,
    );
  });

  it('rejects multi-record DNS responses if ANY address is private/blocked with 400 BLOCKED_URL', async () => {
    await assert.rejects(
      () => resolveAndValidateHost('multi-record.example.com', { dnsResolver: testDnsResolver }),
      (err) => err.code === 'BLOCKED_URL' && err.statusCode === 400,
    );
  });

  it('returns a pinned lookup function that always yields the validated IP without re-querying DNS', async () => {
    let lookupCalls = 0;
    const countingResolver = async () => {
      lookupCalls += 1;
      return [{ address: '93.184.216.34', family: 4 }];
    };

    const resolved = await resolveAndValidateHost('example.com', { dnsResolver: countingResolver });
    assert.equal(lookupCalls, 1);
    assert.equal(resolved.address, '93.184.216.34');

    // Single-address callback signature
    resolved.lookup('example.com', {}, (err, address, family) => {
      assert.equal(err, null);
      assert.equal(address, '93.184.216.34');
      assert.equal(family, 4);
    });

    // Node 22 { all: true } callback signature
    resolved.lookup('example.com', { all: true }, (err, addresses) => {
      assert.equal(err, null);
      assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);
    });

    assert.equal(lookupCalls, 1, 'Pinned lookup must never trigger another DNS resolution');
  });

  it('orders dual-stack DNS records IPv4-first and preserves all validated addresses for { all: true }', async () => {
    let lookupCalls = 0;
    const dualStackResolver = async () => {
      lookupCalls += 1;
      return [
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        { address: '93.184.216.34', family: 4 },
        { address: '93.184.216.35', family: 4 },
      ];
    };

    const resolved = await resolveAndValidateHost('dualstack.example.com', { dnsResolver: dualStackResolver });
    assert.equal(lookupCalls, 1);
    assert.equal(resolved.address, '93.184.216.34');
    assert.equal(resolved.family, 4);

    resolved.lookup('dualstack.example.com', {}, (err, address, family) => {
      assert.equal(err, null);
      assert.equal(address, '93.184.216.34');
      assert.equal(family, 4);
    });

    resolved.lookup('dualstack.example.com', { all: true }, (err, addresses) => {
      assert.equal(err, null);
      assert.deepEqual(addresses, [
        { address: '93.184.216.34', family: 4 },
        { address: '93.184.216.35', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ]);
    });

    resolved.lookup('dualstack.example.com', { family: 6 }, (err, address, family) => {
      assert.equal(err, null);
      assert.equal(address, '2606:2800:220:1:248:1893:25c8:1946');
      assert.equal(family, 6);
    });

    assert.equal(lookupCalls, 1);
  });

  it('rejects dual-stack DNS responses if the IPv6 record is private/loopback even when IPv4 is public', async () => {
    const mixedResolver = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '::1', family: 6 },
    ];

    await assert.rejects(
      () => resolveAndValidateHost('mixed.example.com', { dnsResolver: mixedResolver }),
      (err) => err.code === 'BLOCKED_URL' && err.statusCode === 400,
    );
  });
});

describe('safeFetch – SSRF and resource limit test suite', () => {
  it('(a) blocks direct requests to localhost, loopback, private IPs, and cloud metadata 169.254.169.254', async () => {
    const blockedTargets = [
      'http://localhost/admin',
      'http://sub.localhost/',
      'http://service.local/',
      'http://metadata.internal/',
      'http://127.0.0.1/',
      'http://127.0.0.53/',
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://0.0.0.0/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:169.254.169.254]/',
      'http://2130706433/', // decimal 127.0.0.1
      'http://0x7f000001/', // hex 127.0.0.1
      'http://0177.0.0.1/', // octal 127.0.0.1
    ];

    for (const target of blockedTargets) {
      await assert.rejects(
        () =>
          safeFetch(target, {
            dnsResolver: testDnsResolver,
            ipChecker: testIpChecker,
            connectPort: serverPort,
          }),
        (err) => {
          assert.equal(err.code, 'BLOCKED_URL', `Expected ${target} to be rejected with BLOCKED_URL`);
          assert.equal(err.statusCode, 400);
          assert.ok(!/127\.0\.0\.1|169\.254|10\.0\.0/.test(err.message), 'Error message must not leak IP');
          return true;
        },
      );
    }
  });

  it('(b) blocks redirects from an allowed host to 127.0.0.1, 169.254.169.254, or a host resolving to a private IP', async () => {
    for (const path of ['/redirect-to-loopback', '/redirect-to-metadata', '/redirect-to-private-host']) {
      await assert.rejects(
        () =>
          safeFetch(`http://allowed.example.com${path}`, {
            dnsResolver: testDnsResolver,
            ipChecker: testIpChecker,
            connectPort: serverPort,
          }),
        (err) => {
          assert.equal(err.code, 'BLOCKED_URL');
          assert.equal(err.statusCode, 400);
          return true;
        },
      );
    }
  });

  it('(c) rejects redirect chains exceeding maxRedirects (>5 hops) with 422 TOO_MANY_REDIRECTS', async () => {
    await assert.rejects(
      () =>
        safeFetch('http://allowed.example.com/redirect-loop', {
          dnsResolver: testDnsResolver,
          ipChecker: testIpChecker,
          connectPort: serverPort,
          maxRedirects: 5,
        }),
      (err) => err.code === 'TOO_MANY_REDIRECTS' && err.statusCode === 422,
    );
  });

  it('(d) aborts responses exceeding maxBytes (2MB) with 422 RESPONSE_TOO_LARGE', async () => {
    await assert.rejects(
      () =>
        safeFetch('http://allowed.example.com/oversize', {
          dnsResolver: testDnsResolver,
          ipChecker: testIpChecker,
          connectPort: serverPort,
          maxBytes: 2 * 1024 * 1024,
        }),
      (err) => err.code === 'RESPONSE_TOO_LARGE' && err.statusCode === 422,
    );
  });

  it('(e) aborts slow streaming responses past the deadline with 504 TARGET_TIMEOUT', async () => {
    await assert.rejects(
      () =>
        safeFetch('http://allowed.example.com/slow', {
          dnsResolver: testDnsResolver,
          ipChecker: testIpChecker,
          connectPort: serverPort,
          timeoutMs: 150,
        }),
      (err) => err.code === 'TARGET_TIMEOUT' && err.statusCode === 504,
    );
  });

  it('(f) rejects non-HTML Content-Type (application/json) with 422 NOT_HTML when requireHtml is true', async () => {
    await assert.rejects(
      () =>
        safeFetch('http://allowed.example.com/json', {
          dnsResolver: testDnsResolver,
          ipChecker: testIpChecker,
          connectPort: serverPort,
        }),
      (err) => err.code === 'NOT_HTML' && err.statusCode === 422,
    );
  });

  it('(g) succeeds on valid HTML with 1 redirect and records the redirectChain', async () => {
    const result = await safeFetch('http://allowed.example.com/redirect-once#ignored', {
      dnsResolver: testDnsResolver,
      ipChecker: testIpChecker,
      connectPort: serverPort,
    });

    assert.equal(result.url, 'http://allowed.example.com/redirect-once');
    assert.equal(result.finalUrl, 'http://allowed.example.com/ok');
    assert.equal(result.status, 200);
    assert.match(result.contentType, /text\/html/i);
    assert.match(result.body, /<title>Safe Page<\/title>/);
    assert.deepEqual(result.redirectChain, [
      { url: 'http://allowed.example.com/redirect-once', status: 302 },
    ]);
  });

  it('throws 422 TARGET_HTTP_ERROR on 404 by default, or returns status/body when throwOnHttpError is false', async () => {
    await assert.rejects(
      () =>
        safeFetch('http://allowed.example.com/not-found', {
          dnsResolver: testDnsResolver,
          ipChecker: testIpChecker,
          connectPort: serverPort,
        }),
      (err) => err.code === 'TARGET_HTTP_ERROR' && err.statusCode === 422,
    );

    const probeResult = await safeFetch('http://allowed.example.com/robots.txt', {
      requireHtml: false,
      throwOnHttpError: false,
      dnsResolver: testDnsResolver,
      ipChecker: testIpChecker,
      connectPort: serverPort,
    });

    assert.equal(probeResult.status, 200);
    assert.match(probeResult.body, /User-agent: \*/);
  });
});

