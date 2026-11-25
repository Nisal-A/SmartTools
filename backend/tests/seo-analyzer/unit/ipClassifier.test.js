import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, assertPublicIp } from '../../../src/modules/seo-analyzer/utils/ipClassifier.js';

describe('ipClassifier', () => {
  it('allows public IPv4 and IPv6 addresses', () => {
    const publicIps = [
      '93.184.216.34', // example.com
      '8.8.8.8', // Google DNS
      '1.1.1.1', // Cloudflare DNS
      '151.101.1.69',
      '172.15.255.255', // just below 172.16.0.0/12
      '172.32.0.1', // just above 172.16.0.0/12
      '100.63.255.255', // just below 100.64.0.0/10
      '100.128.0.1', // just above 100.64.0.0/10
      '192.0.1.1', // just above 192.0.0.0/24
      '198.17.255.255', // just below 198.18.0.0/15
      '198.20.0.1', // just above 198.18.0.0/15
      '2606:2800:220:1:248:1893:25c8:1946', // example.com IPv6
      '2001:4860:4860::8888', // Google public IPv6
      '::ffff:93.184.216.34', // IPv4-mapped public IPv4
      '::ffff:5db8:d822', // hex form of ::ffff:93.184.216.34
    ];

    for (const ip of publicIps) {
      assert.equal(isBlockedIp(ip), false, `Expected public IP ${ip} to be allowed`);
      assert.doesNotThrow(() => assertPublicIp(ip));
    }
  });

  it('blocks every ADR-006 IPv4 special, private, loopback, link-local, CGNAT, multicast, and reserved range', () => {
    const blockedIpv4 = [
      // 0.0.0.0/8
      '0.0.0.0',
      '0.255.255.255',
      // 10.0.0.0/8
      '10.0.0.0',
      '10.0.0.1',
      '10.255.255.255',
      // 100.64.0.0/10 (CGNAT)
      '100.64.0.0',
      '100.100.100.200',
      '100.127.255.255',
      // 127.0.0.0/8 (Loopback)
      '127.0.0.1',
      '127.0.0.53',
      '127.255.255.254',
      // 169.254.0.0/16 (Link-local & cloud metadata)
      '169.254.0.1',
      '169.254.169.254',
      '169.254.255.255',
      // 172.16.0.0/12 (Private)
      '172.16.0.1',
      '172.24.10.5',
      '172.31.255.255',
      // 192.0.0.0/24 (IETF Protocol Assignments)
      '192.0.0.1',
      '192.0.0.255',
      // 192.168.0.0/16 (Private)
      '192.168.0.1',
      '192.168.1.254',
      '192.168.255.255',
      // 198.18.0.0/15 (Benchmarking)
      '198.18.0.1',
      '198.19.255.255',
      // 224.0.0.0/4 (Multicast)
      '224.0.0.1',
      '239.255.255.250',
      // 240.0.0.0/4 (Reserved + Broadcast)
      '240.0.0.1',
      '255.255.255.255',
    ];

    for (const ip of blockedIpv4) {
      assert.equal(isBlockedIp(ip), true, `Expected IPv4 ${ip} to be blocked`);
      assert.throws(() => assertPublicIp(ip), (err) => {
        assert.equal(err.code, 'BLOCKED_URL');
        assert.equal(err.statusCode, 400);
        assert.ok(!err.message.includes(ip), 'Error message must never leak the blocked IP');
        return true;
      });
    }
  });

  it('blocks IPv6 unspecified, loopback, unique-local (fc00::/7), link-local (fe80::/10), and multicast (ff00::/8)', () => {
    const blockedIpv6 = [
      '::',
      '0:0:0:0:0:0:0:0',
      '::1',
      '0:0:0:0:0:0:0:1',
      '[::1]',
      'fc00::1',
      'fd00::1',
      'fd12:3456:789a::1',
      'fe80::1',
      'fe80::1%eth0',
      'febf:ffff::1',
      'ff00::1',
      'ff02::1',
    ];

    for (const ip of blockedIpv6) {
      assert.equal(isBlockedIp(ip), true, `Expected IPv6 ${ip} to be blocked`);
    }
  });

  it('unwraps and blocks IPv4-mapped and IPv4-compatible IPv6 addresses in dotted and hex forms', () => {
    const mappedAddresses = [
      '::ffff:127.0.0.1',
      '::FFFF:127.0.0.1',
      '0:0:0:0:0:ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:7f00:0001',
      '0:0:0:0:0:ffff:7f00:0001',
      '::ffff:169.254.169.254',
      '::ffff:a9fe:a9fe',
      '::ffff:10.0.0.1',
      '::ffff:a00:1',
      '::ffff:192.168.1.1',
      '::ffff:c0a8:101',
      '::ffff:172.16.0.1',
      '::ffff:ac10:1',
      '::ffff:100.64.0.1',
      '::ffff:6440:1',
      '::ffff:0.0.0.0',
      '::ffff:0:0',
      '::127.0.0.1',
    ];

    for (const ip of mappedAddresses) {
      assert.equal(isBlockedIp(ip), true, `Expected IPv4-mapped IPv6 ${ip} to be blocked`);
    }
  });

  it('fails closed on non-IP strings or invalid values', () => {
    for (const invalid of ['', 'example.com', '999.999.999.999', null, undefined, 42]) {
      assert.equal(isBlockedIp(invalid), true);
    }
  });
});

