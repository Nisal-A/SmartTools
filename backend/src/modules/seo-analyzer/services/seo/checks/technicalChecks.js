// On-page technical checks: tech.https, tech.statusRedirects, tech.canonical,
// tech.viewport, tech.lang, tech.metaRobots (PROJECT_MASTER_PLAN.md §7).

const MAX_PASS_REDIRECTS = 2;

export const runTechnicalChecks = (technical, { responseStatus = 200, redirectChain = [] } = {}) => {
  const isHttps = Boolean(technical?.https);
  const redirectCount = Array.isArray(redirectChain) ? redirectChain.length : 0;
  const canonical = technical?.canonical ?? null;
  const canonicalValid = Boolean(technical?.canonicalValid);
  const viewport = technical?.viewport ?? null;
  const lang = technical?.lang ?? null;
  const robotsMeta = technical?.robotsMeta ?? null;

  const httpsCheck = {
    id: 'tech.https',
    category: 'technical',
    label: 'HTTPS encryption',
    status: isHttps ? 'passed' : 'failed',
    value: isHttps,
    message: isHttps ? 'The final page URL is served over HTTPS.' : 'The final page URL is served over unencrypted HTTP.',
    reason: null,
  };

  let statusRedirectsStatus = 'failed';
  let statusRedirectsMessage = `Final response returned HTTP ${responseStatus} after ${redirectCount} redirect${redirectCount === 1 ? '' : 's'}.`;
  if (responseStatus === 200 && redirectCount <= MAX_PASS_REDIRECTS) {
    statusRedirectsStatus = 'passed';
    statusRedirectsMessage =
      redirectCount === 0
        ? 'Page responded with HTTP 200 directly without redirects.'
        : `Page responded with HTTP 200 after ${redirectCount} redirect${redirectCount === 1 ? '' : 's'}.`;
  } else if (responseStatus === 200 && redirectCount > MAX_PASS_REDIRECTS) {
    statusRedirectsStatus = 'warning';
    statusRedirectsMessage = `Page responded with HTTP 200 but required ${redirectCount} redirects (recommended: ${MAX_PASS_REDIRECTS} or fewer).`;
  }

  const statusRedirectsCheck = {
    id: 'tech.statusRedirects',
    category: 'technical',
    label: 'HTTP status and redirect chain',
    status: statusRedirectsStatus,
    value: { status: responseStatus, redirects: redirectCount },
    message: statusRedirectsMessage,
    reason: null,
  };

  let canonicalStatus = 'warning';
  let canonicalMessage = 'No <link rel="canonical"> tag was found on the page.';
  if (canonical && canonicalValid) {
    canonicalStatus = 'passed';
    canonicalMessage = `Valid absolute canonical URL found: ${canonical}.`;
  } else if (canonical && !canonicalValid) {
    canonicalStatus = 'failed';
    canonicalMessage = `Canonical tag "${canonical}" is not a valid absolute http/https URL.`;
  }

  const canonicalCheck = {
    id: 'tech.canonical',
    category: 'technical',
    label: 'Canonical URL tag',
    status: canonicalStatus,
    value: canonical,
    message: canonicalMessage,
    reason: null,
  };

  const viewportCheck = {
    id: 'tech.viewport',
    category: 'technical',
    label: 'Mobile viewport meta tag',
    status: viewport ? 'passed' : 'failed',
    value: viewport,
    message: viewport
      ? 'A <meta name="viewport"> tag is configured.'
      : 'The page is missing a <meta name="viewport"> tag for mobile responsiveness.',
    reason: null,
  };

  const langCheck = {
    id: 'tech.lang',
    category: 'technical',
    label: 'HTML lang attribute',
    status: lang ? 'passed' : 'failed',
    value: lang,
    message: lang
      ? `The <html> element declares lang="${lang}".`
      : 'The <html> element is missing a non-empty lang attribute.',
    reason: null,
  };

  const hasNoindex = typeof robotsMeta === 'string' && /\bnoindex\b/i.test(robotsMeta);
  const metaRobotsCheck = {
    id: 'tech.metaRobots',
    category: 'technical',
    label: 'Meta robots indexing directive',
    status: hasNoindex ? 'failed' : 'passed',
    value: robotsMeta,
    message: hasNoindex
      ? `The page blocks indexing with meta robots "${robotsMeta}".`
      : robotsMeta
        ? `Meta robots "${robotsMeta}" permits indexing.`
        : 'No restrictive meta robots tag is present; indexing is permitted.',
    reason: null,
  };

  return [httpsCheck, statusRedirectsCheck, canonicalCheck, viewportCheck, langCheck, metaRobotsCheck];
};

export default runTechnicalChecks;
