import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import axios from 'axios';
import AppError from '../../utils/AppError.js';
import { validateAndNormalizeUrl } from '../../utils/urlValidator.js';
import { resolveAndValidateHost } from './safeLookup.js';

const USER_AGENT = 'SEOCheckBot/1.0';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 2097152;
const DEFAULT_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECT_CHAIN_ENTRIES = 10;
const ALLOWED_HTML_TYPES = ['text/html', 'application/xhtml+xml'];

const getEnvNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const isHtmlContentType = (contentTypeHeader) => {
  if (typeof contentTypeHeader !== 'string') return false;
  const lower = contentTypeHeader.toLowerCase();
  return ALLOWED_HTML_TYPES.some((type) => lower.includes(type));
};

const mapFetchError = (err, signal) => {
  if (err instanceof AppError) return err;

  if (
    signal?.aborted ||
    err?.name === 'AbortError' ||
    err?.code === 'ERR_CANCELED' ||
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ETIMEDOUT'
  ) {
    return new AppError('TARGET_TIMEOUT');
  }

  if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') {
    return new AppError('DNS_FAILED');
  }

  return new AppError('TARGET_UNREACHABLE');
};

const createPinnedAgents = (lookup, connectPortOverride) => {
  const withPinnedLookup = ( connector ) => (options, oncreate) =>
    connector(
      {
        ...options,
        port: connectPortOverride ?? options.port,
        lookup,
      },
      oncreate,
    );

  const httpAgent = new http.Agent({
    keepAlive: false,
    lookup,
  });
  httpAgent.createConnection = withPinnedLookup(net.createConnection);

  const httpsAgent = new https.Agent({
    keepAlive: false,
    lookup,
  });
  httpsAgent.createConnection = withPinnedLookup(tls.connect);

  return { httpAgent, httpsAgent };
};

/**
 * SSRF-hardened single-resource HTTP fetcher (ADR-006, ADR-007).
 * - Validates URL on initial request and every redirect hop
 * - Resolves DNS once per hop, rejects if any IP is private/reserved, pins the socket IP
 * - Follows at most `maxRedirects` hops manually (`maxRedirects: 0` in Axios)
 * - Ignores proxy environment variables (`proxy: false`)
 * - Enforces a single overall AbortController deadline across all hops and body streaming
 * - Counts decompressed bytes while streaming and aborts immediately past `maxBytes`
 *
 * @param {string} rawUrl
 * @param {{
 *   requireHtml?: boolean,
 *   throwOnHttpError?: boolean,
 *   maxBytes?: number,
 *   timeoutMs?: number,
 *   maxRedirects?: number,
 *   dnsResolver?: (hostname: string) => Promise<Array<{ address: string, family?: number }>>,
 *   ipChecker?: (ip: string, hostname: string) => boolean,
 *   connectPort?: number,
 *   allowedPorts?: number[]
 * }} [options]
 */
export const safeFetch = async (rawUrl, options = {}) => {
  const requireHtml = options.requireHtml ?? true;
  const throwOnHttpError = options.throwOnHttpError ?? true;
  const maxBytes = options.maxBytes ?? getEnvNumber('FETCH_MAX_BYTES', DEFAULT_MAX_BYTES);
  const timeoutMs = options.timeoutMs ?? getEnvNumber('FETCH_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const maxRedirects = options.maxRedirects ?? getEnvNumber('FETCH_MAX_REDIRECTS', DEFAULT_MAX_REDIRECTS);
  const { dnsResolver, ipChecker, connectPort, allowedPorts } = options;

  const initialTarget = validateAndNormalizeUrl(rawUrl, { allowedPorts });
  let currentTarget = initialTarget;
  const redirectChain = [];
  let redirectCount = 0;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new AppError('TARGET_TIMEOUT'));
  }, timeoutMs);

  try {
    while (true) {
      if (controller.signal.aborted) {
        throw new AppError('TARGET_TIMEOUT');
      }

      const { lookup } = await resolveAndValidateHost(currentTarget.hostname, {
        dnsResolver,
        ipChecker,
      });

      const { httpAgent, httpsAgent } = createPinnedAgents(lookup, connectPort);

      let response;
      try {
        response = await axios.get(currentTarget.url, {
          maxRedirects: 0,
          proxy: false,
          responseType: 'stream',
          decompress: true,
          signal: controller.signal,
          timeout: timeoutMs,
          httpAgent,
          httpsAgent,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: requireHtml
              ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              : '*/*',
          },
          validateStatus: () => true,
        });
      } catch (err) {
        throw mapFetchError(err, controller.signal);
      }

      const status = response.status;
      const stream = response.data;

      if (REDIRECT_STATUSES.has(status)) {
        stream?.destroy();

        if (redirectChain.length < MAX_REDIRECT_CHAIN_ENTRIES) {
          redirectChain.push({ url: currentTarget.url, status });
        }

        redirectCount += 1;
        if (redirectCount > maxRedirects) {
          throw new AppError('TOO_MANY_REDIRECTS');
        }

        const locationHeader = response.headers?.location;
        if (typeof locationHeader !== 'string' || locationHeader.trim() === '') {
          throw new AppError('TARGET_HTTP_ERROR');
        }

        let resolvedRedirectUrl;
        try {
          resolvedRedirectUrl = new URL(locationHeader.trim(), currentTarget.url).toString();
        } catch {
          throw new AppError('INVALID_URL');
        }

        currentTarget = validateAndNormalizeUrl(resolvedRedirectUrl, { allowedPorts });
        continue;
      }

      if (throwOnHttpError && (status < 200 || status >= 300)) {
        stream?.destroy();
        throw new AppError('TARGET_HTTP_ERROR');
      }

      const contentType = String(response.headers?.['content-type'] ?? '');
      if (requireHtml && !isHtmlContentType(contentType)) {
        stream?.destroy();
        throw new AppError('NOT_HTML');
      }

      const chunks = [];
      let totalBytes = 0;

      const onAbort = () => {
        stream?.destroy(new AppError('TARGET_TIMEOUT'));
      };
      controller.signal.addEventListener('abort', onAbort, { once: true });

      try {
        for await (const chunk of stream) {
          if (controller.signal.aborted) {
            throw new AppError('TARGET_TIMEOUT');
          }

          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.byteLength;

          if (totalBytes > maxBytes) {
            stream.destroy();
            throw new AppError('RESPONSE_TOO_LARGE');
          }

          chunks.push(buffer);
        }
      } catch (err) {
        stream?.destroy();
        throw mapFetchError(err, controller.signal);
      } finally {
        controller.signal.removeEventListener('abort', onAbort);
      }

      const body = Buffer.concat(chunks, totalBytes).toString('utf8');

      return {
        url: initialTarget.url,
        finalUrl: currentTarget.url,
        status,
        headers: response.headers,
        contentType,
        body,
        redirectChain,
      };
    }
  } finally {
    clearTimeout(timeoutId);
  }
};

export default safeFetch;
