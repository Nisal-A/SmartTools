import net from 'node:net';
import AppError from './AppError.js';

// Blocked IPv4 and IPv6 ranges from ADR-006 / PROJECT_MASTER_PLAN.md §10.
const blockList = new net.BlockList();

const BLOCKED_IPV4_SUBNETS = [
  ['0.0.0.0', 8], // "This" network (RFC 1122)
  ['10.0.0.0', 8], // Private-use (RFC 1918)
  ['100.64.0.0', 10], // Shared Address Space / CGNAT (RFC 6598)
  ['127.0.0.0', 8], // Loopback (RFC 1122)
  ['169.254.0.0', 16], // Link-local & cloud metadata 169.254.169.254 (RFC 3927)
  ['172.16.0.0', 12], // Private-use (RFC 1918)
  ['192.0.0.0', 24], // IETF Protocol Assignments (RFC 6890)
  ['192.168.0.0', 16], // Private-use (RFC 1918)
  ['198.18.0.0', 15], // Benchmarking (RFC 2544)
  ['224.0.0.0', 4], // Multicast (RFC 5771)
  ['240.0.0.0', 4], // Reserved for future use & broadcast 255.255.255.255 (RFC 1112)
];

const BLOCKED_IPV6_SUBNETS = [
  ['::', 128], // Unspecified address
  ['::1', 128], // Loopback address
  ['fc00::', 7], // Unique Local Addresses (fc00::/8 and fd00::/8, RFC 4193)
  ['fe80::', 10], // Link-local unicast (RFC 4291)
  ['ff00::', 8], // Multicast (RFC 4291)
];

for (const [prefix, size] of BLOCKED_IPV4_SUBNETS) {
  blockList.addSubnet(prefix, size, 'ipv4');
}

for (const [prefix, size] of BLOCKED_IPV6_SUBNETS) {
  blockList.addSubnet(prefix, size, 'ipv6');
}

/**
 * Parses a validated IPv6 literal into eight 16-bit words so IPv4-mapped
 * addresses in any notation (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1) can be unwrapped.
 * @param {string} ipv6
 * @returns {number[] | null}
 */
const parseIpv6Words = (ipv6) => {
  let normalized = ipv6.toLowerCase();

  // If the address ends with an embedded IPv4 dotted-quad (e.g. ::ffff:127.0.0.1),
  // convert the 4 octets into two 16-bit hex groups first.
  const lastColon = normalized.lastIndexOf(':');
  if (lastColon !== -1 && normalized.includes('.', lastColon)) {
    const ipv4Part = normalized.slice(lastColon + 1);
    if (net.isIP(ipv4Part) !== 4) return null;
    const octets = ipv4Part.split('.').map(Number);
    const highHex = ((octets[0] << 8) | octets[1]).toString(16);
    const lowHex = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${highHex}:${lowHex}`;
  }

  const doubleColonParts = normalized.split('::');
  if (doubleColonParts.length > 2) return null;

  let groups;
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = normalized.split(':');
  }

  if (groups.length !== 8) return null;

  const words = groups.map((group) => Number.parseInt(group, 16));
  if (words.some((word) => Number.isNaN(word) || word < 0 || word > 0xffff)) {
    return null;
  }

  return words;
};

/**
 * Extracts the embedded IPv4 dotted-quad from an IPv4-mapped (::ffff:0:0/96)
 * or IPv4-compatible (::/96, excluding :: and ::1) IPv6 address.
 * @param {string} ipv6
 * @returns {string | null}
 */
export const unwrapIpv4FromIpv6 = (ipv6) => {
  const words = parseIpv6Words(ipv6);
  if (!words) return null;

  const isZeroPrefix = words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0 && words[4] === 0;
  if (!isZeroPrefix) return null;

  const isMapped = words[5] === 0xffff;
  const isCompatible = words[5] === 0 && (words[6] !== 0 || words[7] > 1);
  if (!isMapped && !isCompatible) return null;

  const a = (words[6] >> 8) & 0xff;
  const b = words[6] & 0xff;
  const c = (words[7] >> 8) & 0xff;
  const d = words[7] & 0xff;
  return `${a}.${b}.${c}.${d}`;
};

/**
 * Returns true if the candidate string is not a valid public IPv4/IPv6 address.
 * Fails closed on malformed input or IPv6 zone indices.
 * @param {unknown} rawIp
 * @returns {boolean}
 */
export const isBlockedIp = (rawIp) => {
  if (typeof rawIp !== 'string') return true;

  const trimmed = rawIp.trim();
  const cleanIp = trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;

  // Reject any IPv6 scoped zone index (e.g. fe80::1%eth0).
  if (cleanIp.includes('%')) return true;

  const family = net.isIP(cleanIp);
  if (family === 4) {
    return blockList.check(cleanIp, 'ipv4');
  }

  if (family === 6) {
    if (blockList.check(cleanIp, 'ipv6')) {
      return true;
    }

    const mappedIpv4 = unwrapIpv4FromIpv6(cleanIp);
    if (mappedIpv4 !== null) {
      return blockList.check(mappedIpv4, 'ipv4');
    }

    return false;
  }

  // Fail closed on anything that is not a valid IP literal.
  return true;
};

/**
 * Throws AppError('BLOCKED_URL') without leaking the IP address if the IP is blocked.
 * @param {unknown} ip
 */
export const assertPublicIp = (ip) => {
  if (isBlockedIp(ip)) {
    throw new AppError('BLOCKED_URL');
  }
};

export default { isBlockedIp, assertPublicIp, unwrapIpv4FromIpv6 };

