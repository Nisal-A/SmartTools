import * as cheerio from 'cheerio';

const MAX_STRING_LENGTH = 200;
const MAX_HEADINGS_PER_LEVEL = 50;
const MAX_SAMPLES = 20;
const MAX_HEADING_SEQUENCE = 500;

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const truncate = (value, maxLength = MAX_STRING_LENGTH) => {
  const clean = normalizeWhitespace(value);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength);
};

const getMetaContent = ($, targetName) => {
  const lowerTarget = targetName.toLowerCase();
  let content = null;

  $('meta').each((_, el) => {
    const nameAttr = normalizeWhitespace($(el).attr('name')).toLowerCase();
    if (nameAttr === lowerTarget) {
      const rawContent = $(el).attr('content');
      if (typeof rawContent === 'string') {
        content = rawContent;
        return false;
      }
    }
    return undefined;
  });

  return content;
};

const extractCanonical = ($) => {
  let canonicalHref = null;

  $('link').each((_, el) => {
    const relTokens = normalizeWhitespace($(el).attr('rel'))
      .toLowerCase()
      .split(' ')
      .filter(Boolean);
    if (relTokens.includes('canonical')) {
      const href = $(el).attr('href');
      if (typeof href === 'string') {
        canonicalHref = href;
        return false;
      }
    }
    return undefined;
  });

  if (canonicalHref === null) {
    return { canonical: null, canonicalValid: false };
  }

  const trimmed = normalizeWhitespace(canonicalHref);
  if (trimmed === '') {
    return { canonical: null, canonicalValid: false };
  }

  let canonicalValid = false;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      canonicalValid = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      canonicalValid = false;
    }
  }

  return {
    canonical: truncate(trimmed),
    canonicalValid,
  };
};

const extractHeadings = ($) => {
  const h1 = [];
  const h2 = [];
  const h3 = [];
  const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  const levelsPresent = [];

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tagName = String(el.tagName || el.name || '').toLowerCase();
    const level = Number(tagName.slice(1));
    if (!Number.isInteger(level) || level < 1 || level > 6) return;

    const text = normalizeWhitespace($(el).text());
    if (text === '') return;

    counts[tagName] += 1;
    if (levelsPresent.length < MAX_HEADING_SEQUENCE) {
      levelsPresent.push(level);
    }

    const truncated = truncate(text);
    if (level === 1 && h1.length < MAX_HEADINGS_PER_LEVEL) h1.push(truncated);
    if (level === 2 && h2.length < MAX_HEADINGS_PER_LEVEL) h2.push(truncated);
    if (level === 3 && h3.length < MAX_HEADINGS_PER_LEVEL) h3.push(truncated);
  });

  return { h1, h2, h3, counts, levelsPresent };
};

const extractImages = ($) => {
  let total = 0;
  let withAlt = 0;
  let missingAlt = 0;
  let emptyAlt = 0;
  const missingAltSamples = [];

  $('img').each((_, el) => {
    total += 1;
    const rawAlt = $(el).attr('alt');

    if (rawAlt === undefined) {
      missingAlt += 1;
      if (missingAltSamples.length < MAX_SAMPLES) {
        const rawSrc = normalizeWhitespace($(el).attr('src'));
        missingAltSamples.push(rawSrc ? truncate(rawSrc) : '(missing src)');
      }
      return;
    }

    const cleanedAlt = normalizeWhitespace(rawAlt);
    if (cleanedAlt === '') {
      emptyAlt += 1;
      return;
    }

    withAlt += 1;
  });

  // Coverage is calculated over non-decorative images (withAlt + missingAlt) so decorative
  // alt="" images are reported separately rather than penalized as missing (Master Plan §7).
  const nonDecorativeTotal = withAlt + missingAlt;
  const altCoverage =
    total === 0
      ? null
      : nonDecorativeTotal === 0
        ? 100
        : Math.round((withAlt / nonDecorativeTotal) * 100);

  return {
    total,
    withAlt,
    missingAlt,
    emptyAlt,
    altCoverage,
    missingAltSamples,
  };
};

const extractLinks = ($, pageOrigin, pageUrl) => {
  let internal = 0;
  let external = 0;
  let invalid = 0;
  const invalidSamples = [];

  const recordInvalid = (sample) => {
    invalid += 1;
    if (invalidSamples.length < MAX_SAMPLES) {
      invalidSamples.push(truncate(sample));
    }
  };

  $('a').each((_, el) => {
    const rawHref = $(el).attr('href');
    if (rawHref === undefined) {
      recordInvalid('(missing href)');
      return;
    }

    const href = normalizeWhitespace(rawHref);
    if (href === '' || href === '#' || /^javascript:/i.test(href)) {
      recordInvalid(href || '(empty href)');
      return;
    }

    // Fragment links to an actual anchor ID on the current page count as internal.
    if (href.startsWith('#')) {
      internal += 1;
      return;
    }

    // Ignore non-document schemes like mailto: and tel:.
    if (/^(mailto|tel):/i.test(href)) {
      return;
    }

    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        recordInvalid(href);
        return;
      }

      if (resolved.origin === pageOrigin) {
        internal += 1;
      } else {
        external += 1;
      }
    } catch {
      recordInvalid(href);
    }
  });

  return {
    internal,
    external,
    invalid,
    invalidSamples,
    total: internal + external + invalid,
  };
};

/**
 * Parses an HTML document with Cheerio and extracts capped, sanitized SEO signals.
 * Accepts either `(html, finalUrl)` or `({ body, html, finalUrl, url })`.
 *
 * @param {string | { body?: string, html?: string, finalUrl?: string, url?: string }} htmlOrInput
 * @param {string} [finalUrlArg]
 */
export const parsePage = (htmlOrInput, finalUrlArg = 'https://example.com/') => {
  const isObjectInput = typeof htmlOrInput === 'object' && htmlOrInput !== null;
  const rawHtml = isObjectInput ? String(htmlOrInput.html ?? htmlOrInput.body ?? '') : String(htmlOrInput ?? '');
  const rawUrl = isObjectInput
    ? String(htmlOrInput.finalUrl ?? htmlOrInput.url ?? finalUrlArg)
    : String(finalUrlArg || 'https://example.com/');

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    parsedUrl = new URL('https://example.com/');
  }

  const $ = cheerio.load(rawHtml);

  const rawTitle = normalizeWhitespace($('head > title').first().text() || $('title').first().text());
  const titleLength = rawTitle.length;
  const pageTitle = titleLength > 0 ? truncate(rawTitle) : null;

  const rawDescription = normalizeWhitespace(getMetaContent($, 'description'));
  const descriptionLength = rawDescription.length;
  const metaDescription = descriptionLength > 0 ? truncate(rawDescription) : null;

  const headings = extractHeadings($);
  const images = extractImages($);
  const links = extractLinks($, parsedUrl.origin, parsedUrl.toString());

  const { canonical, canonicalValid } = extractCanonical($);
  const rawRobotsMeta = normalizeWhitespace(getMetaContent($, 'robots'));
  const rawViewport = normalizeWhitespace(getMetaContent($, 'viewport'));
  const rawLang = normalizeWhitespace($('html').first().attr('lang'));

  const technical = {
    https: parsedUrl.protocol === 'https:',
    canonical,
    canonicalValid,
    robotsMeta: rawRobotsMeta ? truncate(rawRobotsMeta) : null,
    viewport: rawViewport ? truncate(rawViewport) : null,
    lang: rawLang ? truncate(rawLang) : null,
  };

  return {
    pageTitle,
    titleLength,
    metaDescription,
    descriptionLength,
    headings,
    images,
    links,
    technical,
  };
};

export default parsePage;
