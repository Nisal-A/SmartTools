import safeFetch from '../../fetch/safeFetch.js';

const SITEMAP_DIRECTIVE_REGEX = /^\s*sitemap:\s*(\S+)\s*$/im;
const SITEMAP_XML_TAG_REGEX = /<(?:[a-z0-9_-]+:)?(urlset|sitemapindex)\b/i;

const mapProbeErrorToReason = (err) => {
  if (err?.code === 'BLOCKED_URL' || err?.code === 'INVALID_URL') {
    return 'BLOCKED_URL';
  }
  if (err?.code === 'TARGET_TIMEOUT') {
    return 'TARGET_TIMEOUT';
  }
  return 'NETWORK_ERROR';
};

const extractSitemapUrlFromRobots = (robotsBody) => {
  if (typeof robotsBody !== 'string') return null;
  const match = robotsBody.match(SITEMAP_DIRECTIVE_REGEX);
  return match ? match[1].trim() : null;
};

const looksLikeSitemapXml = (body) => {
  if (typeof body !== 'string') return false;
  return SITEMAP_XML_TAG_REGEX.test(body);
};

/**
 * Safely probes /robots.txt and the site's XML sitemap using `safeFetch`
 * (`requireHtml: false`, `throwOnHttpError: false`).
 * Per ADR-014 Option B, robots.txt never blocks the main audit; any network or
 * SSRF block on a probe is caught and recorded as `not_tested` with a clear reason.
 *
 * @param {string} targetUrl
 * @param {{
 *   fetcher?: typeof safeFetch,
 *   fetchOptions?: object
 * }} [options]
 */
export const runProbeChecks = async (targetUrl, options = {}) => {
  const fetcher = options.fetcher ?? safeFetch;
  const fetchOptions = options.fetchOptions ?? {};

  const origin = new URL(targetUrl).origin;
  const robotsUrl = `${origin}/robots.txt`;
  let sitemapUrl = `${origin}/sitemap.xml`;

  let robotsCheck;
  let robotsDetails;

  try {
    const robotsRes = await fetcher(robotsUrl, {
      ...fetchOptions,
      requireHtml: false,
      throwOnHttpError: false,
    });

    if (robotsRes.status === 200) {
      const declaredSitemap = extractSitemapUrlFromRobots(robotsRes.body);
      if (declaredSitemap) {
        sitemapUrl = declaredSitemap;
      }

      robotsDetails = { status: 'found', httpStatus: 200, url: robotsRes.finalUrl || robotsUrl };
      robotsCheck = {
        id: 'tech.robotsTxt',
        category: 'technical',
        label: 'robots.txt availability',
        status: 'passed',
        value: { status: 200, url: robotsDetails.url },
        message: 'robots.txt is reachable and returned HTTP 200.',
        reason: null,
      };
    } else {
      robotsDetails = { status: 'missing', httpStatus: robotsRes.status, url: robotsRes.finalUrl || robotsUrl };
      robotsCheck = {
        id: 'tech.robotsTxt',
        category: 'technical',
        label: 'robots.txt availability',
        status: 'warning',
        value: { status: robotsRes.status, url: robotsDetails.url },
        message: `robots.txt returned HTTP ${robotsRes.status}.`,
        reason: null,
      };
    }
  } catch (err) {
    const reason = mapProbeErrorToReason(err);
    robotsDetails = { status: 'not_tested', reason, url: robotsUrl };
    robotsCheck = {
      id: 'tech.robotsTxt',
      category: 'technical',
      label: 'robots.txt availability',
      status: 'not_tested',
      value: { url: robotsUrl },
      message: 'robots.txt could not be verified.',
      reason,
    };
  }

  let sitemapCheck;
  let sitemapDetails;

  try {
    const sitemapRes = await fetcher(sitemapUrl, {
      ...fetchOptions,
      requireHtml: false,
      throwOnHttpError: false,
    });

    const finalSitemapUrl = sitemapRes.finalUrl || sitemapUrl;

    if (sitemapRes.status === 200 && looksLikeSitemapXml(sitemapRes.body)) {
      sitemapDetails = { status: 'found', httpStatus: 200, url: finalSitemapUrl };
      sitemapCheck = {
        id: 'tech.sitemap',
        category: 'technical',
        label: 'XML sitemap availability',
        status: 'passed',
        value: { status: 200, url: finalSitemapUrl },
        message: 'A valid XML sitemap is reachable and returned HTTP 200.',
        reason: null,
      };
    } else if (sitemapRes.status === 200) {
      sitemapDetails = { status: 'invalid_xml', httpStatus: 200, url: finalSitemapUrl };
      sitemapCheck = {
        id: 'tech.sitemap',
        category: 'technical',
        label: 'XML sitemap availability',
        status: 'warning',
        value: { status: 200, url: finalSitemapUrl },
        message: 'The sitemap URL returned HTTP 200, but the response does not appear to be a valid XML sitemap.',
        reason: null,
      };
    } else {
      sitemapDetails = { status: 'missing', httpStatus: sitemapRes.status, url: finalSitemapUrl };
      sitemapCheck = {
        id: 'tech.sitemap',
        category: 'technical',
        label: 'XML sitemap availability',
        status: 'warning',
        value: { status: sitemapRes.status, url: finalSitemapUrl },
        message: `The XML sitemap returned HTTP ${sitemapRes.status}.`,
        reason: null,
      };
    }
  } catch (err) {
    const reason = mapProbeErrorToReason(err);
    sitemapDetails = { status: 'not_tested', reason, url: sitemapUrl };
    sitemapCheck = {
      id: 'tech.sitemap',
      category: 'technical',
      label: 'XML sitemap availability',
      status: 'not_tested',
      value: { url: sitemapUrl },
      message: 'The XML sitemap could not be verified.',
      reason,
    };
  }

  return {
    checks: [robotsCheck, sitemapCheck],
    robotsTxt: robotsDetails,
    sitemap: sitemapDetails,
  };
};

export default runProbeChecks;
