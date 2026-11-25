import safeFetch from '../fetch/safeFetch.js';
import { parsePage } from './parsePage.js';
import { runTitleChecks } from './checks/titleChecks.js';
import { runMetaChecks } from './checks/metaChecks.js';
import { runHeadingChecks } from './checks/headingChecks.js';
import { runImageChecks } from './checks/imageChecks.js';
import { runLinkChecks } from './checks/linkChecks.js';
import { runTechnicalChecks } from './checks/technicalChecks.js';
import { runProbeChecks } from './checks/probeChecks.js';

/**
 * Orchestrates HTML parsing, all 16 on-page SEO checks, and the 2 technical probes
 * (`robots.txt` and `sitemap.xml`).
 *
 * Accepts either:
 * 1) `analyzePage(rawUrl, { fetcher, fetchOptions })` – fetches the page + probes via `fetcher` (defaults to `safeFetch`), or
 * 2) `analyzePage({ fetchResult, probes, fetcher, fetchOptions })` – analyzes a pre-fetched HTML result (and runs probes if not pre-supplied).
 *
 * @param {string | {
 *   fetchResult: { url?: string, finalUrl?: string, status?: number, body?: string, html?: string, redirectChain?: Array<{ url: string, status: number }> },
 *   probes?: { checks: object[], robotsTxt: object, sitemap: object },
 *   fetcher?: typeof safeFetch,
 *   fetchOptions?: object
 * }} input
 * @param {{
 *   fetcher?: typeof safeFetch,
 *   fetchOptions?: object,
 *   probes?: { checks: object[], robotsTxt: object, sitemap: object }
 * }} [options]
 */
export const analyzePage = async (input, options = {}) => {
  const isUrlInput = typeof input === 'string';
  const fetcher = (isUrlInput ? options.fetcher : input?.fetcher ?? options.fetcher) ?? safeFetch;
  const fetchOptions = (isUrlInput ? options.fetchOptions : input?.fetchOptions ?? options.fetchOptions) ?? {};

  const fetchResult = isUrlInput
    ? await fetcher(input, { ...fetchOptions, requireHtml: true, throwOnHttpError: true })
    : input?.fetchResult ?? input;

  const finalUrl = fetchResult?.finalUrl ?? fetchResult?.url ?? 'https://example.com/';
  const url = fetchResult?.url ?? finalUrl;
  const responseStatus = fetchResult?.status ?? fetchResult?.responseStatus ?? 200;
  const redirectChain = Array.isArray(fetchResult?.redirectChain) ? fetchResult.redirectChain : [];
  const html = fetchResult?.body ?? fetchResult?.html ?? '';

  const parsed = parsePage(html, finalUrl);

  const probeResult =
    (isUrlInput ? options.probes : input?.probes ?? options.probes) ??
    (await runProbeChecks(finalUrl, { fetcher, fetchOptions }));

  const seoChecks = [
    ...runTitleChecks(parsed),
    ...runMetaChecks(parsed),
    ...runHeadingChecks(parsed.headings),
    ...runImageChecks(parsed.images),
    ...runLinkChecks(parsed.links),
    ...runTechnicalChecks(parsed.technical, { responseStatus, redirectChain }),
    ...(probeResult.checks ?? []),
  ];

  const details = {
    titleLength: parsed.titleLength,
    descriptionLength: parsed.descriptionLength,
    headings: parsed.headings,
    images: parsed.images,
    links: {
      internal: parsed.links.internal,
      external: parsed.links.external,
      invalid: parsed.links.invalid,
      invalidSamples: parsed.links.invalidSamples,
    },
    technical: {
      https: parsed.technical.https,
      canonical: parsed.technical.canonical,
      canonicalValid: parsed.technical.canonicalValid,
      robotsMeta: parsed.technical.robotsMeta,
      viewport: parsed.technical.viewport,
      lang: parsed.technical.lang,
      robotsTxt: probeResult.robotsTxt,
      sitemap: probeResult.sitemap,
    },
  };

  return {
    url,
    finalUrl,
    responseStatus,
    redirectChain,
    pageTitle: parsed.pageTitle,
    metaDescription: parsed.metaDescription,
    seoChecks,
    details,
  };
};

export default analyzePage;
