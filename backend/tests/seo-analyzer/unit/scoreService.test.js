import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  CHECK_WEIGHTS,
  TOTAL_POSSIBLE_POINTS,
  getScoreBand,
} from '../../../src/modules/seo-analyzer/services/scoring/scoringConfig.js';
import { calculateScores } from '../../../src/modules/seo-analyzer/services/scoring/scoreService.js';

const buildAllChecksWithStatus = (statusByCheckId) =>
  Object.entries(CHECK_WEIGHTS).map(([id, { category }]) => {
    const status = statusByCheckId[id] ?? 'passed';
    return {
      id,
      category,
      label: id,
      status,
      value: null,
      message: `${id} is ${status}`,
      reason: status === 'not_tested' ? 'TEST_REASON' : null,
    };
  });

describe('scoringConfig & scoreService', () => {
  it('verifies category weights and individual check maxPoints both sum to exactly 100', () => {
    const categoryWeightSum = CATEGORIES.reduce((sum, cat) => sum + cat.weight, 0);
    assert.equal(categoryWeightSum, TOTAL_POSSIBLE_POINTS);

    const checkPointSum = Object.values(CHECK_WEIGHTS).reduce((sum, cfg) => sum + cfg.maxPoints, 0);
    assert.equal(checkPointSum, TOTAL_POSSIBLE_POINTS);
    assert.equal(Object.keys(CHECK_WEIGHTS).length, 18);

    // Every category's checks must sum to that category's weight.
    for (const { category, weight } of CATEGORIES) {
      const sumForCategory = Object.values(CHECK_WEIGHTS)
        .filter((cfg) => cfg.category === category)
        .reduce((sum, cfg) => sum + cfg.maxPoints, 0);
      assert.equal(sumForCategory, weight, `Category "${category}" checks should sum to ${weight}`);
    }
  });

  it('scores 100 with 100% coverage when all 18 checks pass', () => {
    const checks = buildAllChecksWithStatus({});
    const result = calculateScores(checks);

    assert.equal(result.overallScore, 100);
    assert.equal(result.scoreCoverage, 100);
    assert.equal(result.scoreBand, 'Excellent');
    assert.deepEqual(result.summary, { passed: 18, warning: 0, failed: 0, notTested: 0 });

    for (const cat of result.categoryScores) {
      assert.equal(cat.score, 100);
      assert.equal(cat.earned, cat.weight);
      assert.equal(cat.possible, cat.weight);
    }
  });

  it('excludes not_tested checks from earned and possible points and updates scoreCoverage accurately', () => {
    // Exclude images.altCoverage (15 pts), tech.robotsTxt (2 pts), tech.sitemap (2 pts) -> 19 pts excluded -> 81% coverage.
    // All remaining 15 checks pass -> overallScore should still be 100 with scoreCoverage = 81.
    const checks = buildAllChecksWithStatus({
      'images.altCoverage': 'not_tested',
      'tech.robotsTxt': 'not_tested',
      'tech.sitemap': 'not_tested',
    });

    const result = calculateScores(checks);

    assert.equal(result.overallScore, 100);
    assert.equal(result.scoreCoverage, 81);
    assert.deepEqual(result.summary, { passed: 15, warning: 0, failed: 0, notTested: 3 });

    const imagesCategory = result.categoryScores.find((c) => c.category === 'images');
    assert.equal(imagesCategory.earned, 0);
    assert.equal(imagesCategory.possible, 0);
    assert.equal(imagesCategory.score, null);

    const techCategory = result.categoryScores.find((c) => c.category === 'technical');
    assert.equal(techCategory.earned, 26);
    assert.equal(techCategory.possible, 26);
    assert.equal(techCategory.score, 100);
  });

  it('applies 100% for passed, 50% for warning, and 0% for failed checks', () => {
    // Title (15): exists passed (8), length warning (7 * 0.5 = 3.5) -> 11.5 / 15 = 77%
    // Meta (15): exists failed (0), length failed (0) -> 0 / 15 = 0%
    // All others pass (70 / 70) -> total earned = 81.5 / 100 -> overallScore = 82 ('Good')
    const checks = buildAllChecksWithStatus({
      'title.length': 'warning',
      'meta.exists': 'failed',
      'meta.length': 'failed',
    });

    const result = calculateScores(checks);

    assert.equal(result.overallScore, 82);
    assert.equal(result.scoreCoverage, 100);
    assert.equal(result.scoreBand, 'Good');
    assert.deepEqual(result.summary, { passed: 15, warning: 1, failed: 2, notTested: 0 });

    const titleCat = result.categoryScores.find((c) => c.category === 'title');
    assert.equal(titleCat.earned, 11.5);
    assert.equal(titleCat.possible, 15);
    assert.equal(titleCat.score, 77);

    const metaCat = result.categoryScores.find((c) => c.category === 'meta');
    assert.equal(metaCat.earned, 0);
    assert.equal(metaCat.possible, 15);
    assert.equal(metaCat.score, 0);

    assert.equal(getScoreBand(95), 'Excellent');
    assert.equal(getScoreBand(80), 'Good');
    assert.equal(getScoreBand(60), 'Needs work');
    assert.equal(getScoreBand(40), 'Poor');
  });
});
