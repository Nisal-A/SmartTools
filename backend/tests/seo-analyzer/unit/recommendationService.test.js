import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScores } from '../../../src/modules/seo-analyzer/services/scoring/scoreService.js';
import { generateRecommendations } from '../../../src/modules/seo-analyzer/services/recommendationService.js';

describe('recommendationService', () => {
  it('omits passed and not_tested checks, interpolates real measured values, and sorts high -> medium -> low', () => {
    const rawChecks = [
      {
        id: 'title.exists',
        category: 'title',
        label: 'Page title exists',
        status: 'passed',
        value: 'Good Title',
        message: 'ok',
        reason: null,
      },
      {
        id: 'title.length',
        category: 'title',
        label: 'Page title length',
        status: 'warning', // weight 7 -> warning -> 'low'
        value: 72,
        message: 'Title is 72 chars',
        reason: null,
      },
      {
        id: 'tech.viewport',
        category: 'technical',
        label: 'Mobile viewport meta tag',
        status: 'failed', // weight 4 -> failed (<8) -> 'medium'
        value: null,
        message: 'Missing viewport',
        reason: null,
      },
      {
        id: 'images.altCoverage',
        category: 'images',
        label: 'Image ALT attribute coverage',
        status: 'failed', // weight 15 -> failed (>=8) -> 'high'
        value: { total: 5, withAlt: 1, missingAlt: 3, emptyAlt: 1, altCoverage: 25 },
        message: '25% coverage',
        reason: null,
      },
      {
        id: 'tech.sitemap',
        category: 'technical',
        label: 'XML sitemap availability',
        status: 'not_tested',
        value: { url: 'https://example.com/sitemap.xml' },
        message: 'Could not verify',
        reason: 'NETWORK_ERROR',
      },
      {
        id: 'headings.hierarchy',
        category: 'headings',
        label: 'Heading hierarchy order',
        status: 'warning', // weight 3 -> warning -> 'low'
        value: ['H1 -> H3'],
        message: 'Skipped heading levels',
        reason: null,
      },
    ];

    const { seoChecks } = calculateScores(rawChecks);
    const recommendations = generateRecommendations(seoChecks);

    // Only the 4 failed/warning checks should produce recommendations.
    assert.equal(recommendations.length, 4);

    // Priority order must be high -> medium -> low.
    assert.deepEqual(
      recommendations.map((rec) => ({ checkId: rec.checkId, priority: rec.priority })),
      [
        { checkId: 'images.altCoverage', priority: 'high' },
        { checkId: 'tech.viewport', priority: 'medium' },
        { checkId: 'title.length', priority: 'low' },
        { checkId: 'headings.hierarchy', priority: 'low' },
      ],
    );

    // Verify real measured values are interpolated into the generated copy.
    const imageRec = recommendations.find((r) => r.checkId === 'images.altCoverage');
    assert.match(imageRec.title, /3 images/);
    assert.match(imageRec.title, /25%/);
    assert.match(imageRec.description, /3 of 5/);

    const titleRec = recommendations.find((r) => r.checkId === 'title.length');
    assert.match(titleRec.title, /72-character/);
    assert.match(titleRec.description, /72 characters/);
    assert.match(titleRec.description, /12 characters/);

    const hierarchyRec = recommendations.find((r) => r.checkId === 'headings.hierarchy');
    assert.match(hierarchyRec.title, /H1 -> H3/);
    assert.match(hierarchyRec.description, /H1 -> H3/);
  });
});
