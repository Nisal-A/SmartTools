import AppError from './AppError.js';

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

const isLocalhostStyleHost = (hostname) => {
  const cleanHost = hostname.toLowerCase().replace(/\.+$/, '');
  return (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal')
  );
};

/**
 * Validates and normalises a user-supplied or redirect target URL (ADR-006).
 * - Requires http: or https:
 * - Caps length at 2048 characters
 * - Rejects embedded credentials (user:pass@)
 * - Rejects non-standard ports (allows only default/empty, 80 for http, 443 for https)
 * - Rejects localhost-style hostnames (localhost, *.localhost, *.local, *.internal)
 * - Strips hash fragments
 *
 * @param {unknown} rawInput
 * @param {{ allowedPorts?: number[] }} [options]
 */
export const validateAndNormalizeUrl = (rawInput, options = {}) => {
  if (typeof rawInput !== 'string') {
    throw new AppError('INVALID_URL');
  }

  const trimmed = rawInput.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH || CONTROL_CHAR_REGEX.test(trimmed)) {
    throw new AppError('INVALID_URL');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError('INVALID_URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new AppError('INVALID_URL');
  }

  if (parsed.username !== '' || parsed.password !== '') {
    throw new AppError('INVALID_URL');
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname =
    rawHostname.startsWith('[') && rawHostname.endsWith(']') ? rawHostname.slice(1, -1) : rawHostname;

  if (!hostname || hostname.replace(/\.+$/, '') === '') {
    throw new AppError('INVALID_URL');
  }

  if (isLocalhostStyleHost(hostname)) {
    throw new AppError('BLOCKED_URL');
  }

  const extraPorts = Array.isArray(options.allowedPorts) ? options.allowedPorts.map(String) : [];
  const isAllowedPort =
    parsed.port === '' ||
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    extraPorts.includes(parsed.port);

  if (!isAllowedPort) {
    throw new AppError('BLOCKED_URL');
  }

  parsed.hash = '';
  const normalizedUrl = parsed.toString();
  const effectivePort = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;

  return {
    url: normalizedUrl,
    normalizedUrl,
    href: normalizedUrl,
    protocol: parsed.protocol,
    hostname,
    host: parsed.host,
    origin: parsed.origin,
    port: parsed.port,
    effectivePort,
    pathname: parsed.pathname,
    search: parsed.search,
    parsed,
  };
};

export default validateAndNormalizeUrl;

