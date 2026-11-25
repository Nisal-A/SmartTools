import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppError from '../../../src/modules/seo-analyzer/utils/AppError.js';
import { parsePage } from '../../../src/modules/seo-analyzer/services/seo/parsePage.js';
import { analyzePage } from '../../../src/modules/seo-analyzer/services/seo/analyzePage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

const EXPECTED_CHECK_IDS = [
  'title.exists',
  'title.length',
  'meta.exists',
  'meta.length',
  'headings.h1Exists',
  'headings.h1Single',
  'headings.hierarchy',
  'images.altCoverage',
  'links.internalPresent',
  'links.validHref',
  'tech.https',
  'tech.statusRedirects',
  'tech.canonical',
  'tech.viewport',
  'tech.lang',
  'tech.metaRobots',
  'tech.robotsTxt',
  'tech.sitemap',
];

const VALID_STATUSES = new Set(['passed', 'warning', 'failed', 'not_tested']);

const fixtures = {};

before(async () => {
  const names = [
    'valid-page.html',
    'missing-meta-title.html',
    'multiple-h1-skipped.html',
    'images-missing-alt.html',
    'noindex-no-viewport.html',
  ];

  for (const name of names) {
    fixtures[name] = await fs.readFile(path.join(FIXTURES_DIR, name), 'utf8');
  }
});

const createMockFetcher = (routes) => async (url) => {
  if (Object.hasOwn(routes, url)) {
    const handler = routes[url];
    if (typeof handler === 'function') {
      return handler(url);
    }
    return handler;
  }
  return { status: 404, finalUrl: url, body: 'Not Found', headers: {}, redirectChain: [] };
};

const assertCheckContract = (seoChecks) => {
  assert.equal(seoChecks.length, 18, 'Expected exactly 18 SEO checks');
  assert.deepEqual(
    seoChecks.map((check) => check.id),
    EXPECTED_CHECK_IDS,
  );

  for (const check of seoChecks) {
    assert.equal(typeof check.id, 'string');
    assert.equal(typeof check.category, 'string');
    assert.equal(typeof check.label, 'string');
    assert.ok(VALID_STATUSES.has(check.status), `Invalid status "${check.status}" on ${check.id}`);
    assert.equal(typeof check.message, 'string');
    assert.ok(check.message.length > 0);
    assert.ok(Object.hasOwn(check, 'value'));
    assert.ok(Object.hasOwn(check, 'reason'));

    // Ensure no point weights are hardcoded in check outputs (belongs to Sprint 4 scoringConfig.js).
    assert.equal(check.maxPoints, undefined);
    assert.equal(check.earnedPoints, undefined);

    if (check.status === 'not_tested') {
      assert.equal(typeof check.reason, 'string', `${check.id} is not_tested and must carry a reason`);
      assert.ok(check.reason.length > 0);
    } else {
      assert.equal(check.reason, null, `${check.id} is ${check.status} and should have reason: null`);
    }
  }
};

const getCheckMap = (seoChecks) => Object.fromEntries(seoChecks.map((check) => [check.id, check]));

describe('SEO Engine – HTML Fixture & Probe Tests', () => {
  it('1. valid-page.html passes all 18 checks when robots.txt and XML sitemap return 200', async () => {
    const fetcher = createMockFetcher({
      'https://example.com/robots.txt': {
        status: 200,
        finalUrl: 'https://example.com/robots.txt',
        body: 'User-agent: *\nAllow: /\nSitemap: https://example.com/custom-sitemap.xml\n',
      },
      'https://example.com/custom-sitemap.xml': {
        status: 200,
        finalUrl: 'https://example.com/custom-sitemap.xml',
        body: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>',
      },
    });

    const report = await analyzePage({
      fetchResult: {
        url: 'https://example.com/guides/on-page-seo',
        finalUrl: 'https://example.com/guides/on-page-seo',
        status: 200,
        body: fixtures['valid-page.html'],
        redirectChain: [],
      },
      fetcher,
    });

    assertCheckContract(report.seoChecks);
    const checks = getCheckMap(report.seoChecks);

    for (const id of EXPECTED_CHECK_IDS) {
      assert.equal(checks[id].status, 'passed', `Expected ${id} to pass on valid-page.html`);
    }

    assert.equal(report.details.images.total, 2);
    assert.equal(report.details.images.withAlt, 1);
    assert.equal(report.details.images.emptyAlt, 1);
    assert.equal(report.details.images.missingAlt, 0);
    assert.equal(report.details.images.altCoverage, 100);
    assert.equal(report.details.links.internal, 2);
    assert.equal(report.details.links.external, 1);
    assert.equal(report.details.technical.sitemap.url, 'https://example.com/custom-sitemap.xml');
  });

  it('2. missing-meta-title.html fails title/meta checks and marks 0-image and 0-link checks as not_tested', async () => {
    const fetcher = createMockFetcher({
      'https://example.com/robots.txt': { status: 404, finalUrl: 'https://example.com/robots.txt', body: '' },
      'https://example.com/sitemap.xml': { status: 404, finalUrl: 'https://example.com/sitemap.xml', body: '' },
    });

    const report = await analyzePage({
      fetchResult: {
        url: 'https://example.com/no-meta-title',
        finalUrl: 'https://example.com/no-meta-title',
        status: 200,
        body: fixtures['missing-meta-title.html'],
        redirectChain: [],
      },
      fetcher,
    });

    assertCheckContract(report.seoChecks);
    const checks = getCheckMap(report.seoChecks);

    assert.equal(report.pageTitle, null);
    assert.equal(report.metaDescription, null);
    assert.equal(checks['title.exists'].status, 'failed');
    assert.equal(checks['title.length'].status, 'failed');
    assert.equal(checks['meta.exists'].status, 'failed');
    assert.equal(checks['meta.length'].status, 'failed');

    // Zero images -> not_tested (never a fake pass)
    assert.equal(checks['images.altCoverage'].status, 'not_tested');
    assert.equal(checks['images.altCoverage'].reason, 'NOT_APPLICABLE_NO_IMAGES');

    // Zero links -> internalPresent fails, validHref is not_tested
    assert.equal(checks['links.internalPresent'].status, 'failed');
    assert.equal(checks['links.validHref'].status, 'not_tested');
    assert.equal(checks['links.validHref'].reason, 'NOT_APPLICABLE_NO_LINKS');

    // 404 probes -> warning
    assert.equal(checks['tech.robotsTxt'].status, 'warning');
    assert.equal(checks['tech.sitemap'].status, 'warning');
  });

  it('3. multiple-h1-skipped.html flags multiple H1s, skipped heading levels, short title, and 1–3 invalid links as warnings', async () => {
    const fetcher = createMockFetcher({});

    const report = await analyzePage({
      fetchResult: {
        url: 'https://example.com/headings',
        finalUrl: 'https://example.com/headings',
        status: 200,
        body: fixtures['multiple-h1-skipped.html'],
        redirectChain: [
          { url: 'https://example.com/h1', status: 301 },
          { url: 'https://example.com/h2', status: 301 },
          { url: 'https://example.com/h3', status: 302 },
        ],
      },
      fetcher,
    });

    assertCheckContract(report.seoChecks);
    const checks = getCheckMap(report.seoChecks);

    assert.equal(checks['title.exists'].status, 'passed');
    assert.equal(checks['title.length'].status, 'warning');
    assert.equal(checks[' headings.h1Exists'?.trim() ?? 'headings.h1Exists'].status, 'passed');
    assert.equal(checks['headings.h1Single'].status, 'warning');
    assert.equal(checks['headings.h1Single'].value, 2);
    assert.equal(checks['headings.hierarchy'].status, 'warning');
    assert.deepEqual(checks['headings.hierarchy'].value, ['H1 -> H3', 'H1 -> H4']);
    assert.equal(checks['links.validHref'].status, 'warning');
    assert.equal(checks['links.validHref'].value, 2);
    assert.equal(checks['tech.statusRedirects'].status, 'warning');
  });

  it('4. images-missing-alt.html fails altCoverage (<50%) while reporting decorative emptyAlt separately', async () => {
    const fetcher = createMockFetcher({});

    const report = await analyzePage({
      fetchResult: {
        url: 'https://example.com/gallery',
        finalUrl: 'https://example.com/gallery',
        status: 200,
        body: fixtures['images-missing-alt.html'],
        redirectChain: [],
      },
      fetcher,
    });

    assertCheckContract(report.seoChecks);
    const checks = getCheckMap(report.seoChecks);

    const imgCheck = checks['images.altCoverage'];
    assert.equal(imgCheck.status, 'failed');
    assert.deepEqual(imgCheck.value, {
      total: 5,
      withAlt: 1,
      missingAlt: 3,
      emptyAlt: 1,
      altCoverage: 25,
    });
    assert.equal(report.details.images.emptyAlt, 1);
    assert.deepEqual(report.details.images.missingAltSamples, [
      '/img/photo-2.jpg',
      '/img/photo-3.jpg',
      '/img/photo-4.jpg',
    ]);
  });

  it('5. noindex-no-viewport.html detects noindex, missing viewport, missing lang, invalid canonical, HTTP, and 0 H1 (not_tested h1Single)', async () => {
    const fetcher = createMockFetcher({});

    const report = await analyzePage({
      fetchResult: {
        url: 'http://example.com/private',
        finalUrl: 'http://example.com/private',
        status: 200,
        body: fixtures['noindex-no-viewport.html'],
        redirectChain: [],
      },
      fetcher,
    });

    assertCheckContract(report.seoChecks);
    const checks = getCheckMap(report.seoChecks);

    assert.equal(checks['headings.h1Exists'].status, 'failed');
    assert.equal(checks['headings.h1Single'].status, 'not_tested');
    assert.equal(checks['headings.h1Single'].reason, 'NO_H1_FOUND');
    assert.equal(checks['links.validHref'].status, 'failed');
    assert.equal(checks['links.validHref'].value, 4);
    assert.equal(checks['tech.https'].status, 'failed');
    assert.equal(checks['tech.canonical'].status, 'failed');
    assert.equal(checks['tech.viewport'].status, 'failed');
    assert.equal(checks['tech.lang'].status, 'failed');
    assert.equal(checks['tech.metaRobots'].status, 'failed');
  });

  it('6. blocks SSRF via malicious Sitemap: directive in robots.txt and records tech.sitemap as not_tested (BLOCKED_URL)', async () => {
    const fetcher = createMockFetcher({
      'https://example.com/robots.txt': {
        status: 200,
        finalUrl: 'https://example.com/robots.txt',
        body: 'User-agent: *\nDisallow: /admin\nSitemap: http://169.254.169.254/latest/meta-data/\n',
      },
      'http://169.254.169.254/latest/meta-data/': () => {
        throw new AppError('BLOCKED_URL');
      },
    });

    const report = await analyzePage({
      fetchResult: {
        url: 'https://example.com/',
        finalUrl: 'https://example.com/',
        status: 200,
        body: fixtures['valid-page.html'],
        redirectChain: [],
      },
      fetcher,
    });

    assertCheckContract(report.seoChecks);
    const checks = getCheckMap(report.seoChecks);

    assert.equal(checks['tech.robotsTxt'].status, 'passed');
    assert.equal(checks['tech.sitemap'].status, 'not_tested');
    assert.equal(checks['tech.sitemap'].reason, 'BLOCKED_URL');
    assert.equal(report.details.technical.sitemap.status, 'not_tested');
    assert.equal(report.details.technical.sitemap.reason, 'BLOCKED_URL');
  });

  it('7. truncates long strings to 200 chars, caps heading arrays at 50, and never throws on malformed HTML', () => {
    const longText = 'x'.repeat(260);
    const manyH1s = Array.from({ length: 65 }, (_, i) => `<h1>Heading ${i + 1} ${longText}</h1>`).join('');
    const manyImages = Array.from({ length: 30 }, (_, i) => `<img src="/img/${i}.png">`).join('');
    const malformedHtml = `<html><head><title>${longText}</title></head><body>${manyH1s}${manyImages}<div><p>Unclosed`;

    const parsed = parsePage(malformedHtml, 'https://example.com/');

    assert.equal(parsed.titleLength, 260);
    assert.equal(parsed.pageTitle.length, 200);
    assert.equal(parsed.headings.counts.h1, 65);
    assert.equal(parsed.headings.h1.length, 50);
    assert.equal(parsed.headings.h1[0].length, 200);
    assert.equal(parsed.images.missingAlt, 30);
    assert.equal(parsed.images.missingAltSamples.length, 20);
  });
});
