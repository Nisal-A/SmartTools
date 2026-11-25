import {
  CATEGORIES,
  CHECK_WEIGHTS,
  STATUS_MULTIPLIERS,
  TOTAL_POSSIBLE_POINTS,
  getScoreBand,
} from './scoringConfig.js';

/**
 * Enriches raw SEO checks with `maxPoints` and `earnedPoints`, calculates
 * per-category scores, overall score (0–100), score coverage %, and status counts.
 * `not_tested` checks are excluded from both earned and possible points (ADR-009).
 *
 * @param {Array<{
 *   id: string,
 *   category: string,
 *   label: string,
 *   status: 'passed' | 'warning' | 'failed' | 'not_tested',
 *   value: unknown,
 *   message: string,
 *   reason: string | null
 * }>} rawChecks
 */
export const calculateScores = (rawChecks = []) => {
  const summary = {
    passed: 0,
    warning: 0,
    failed: 0,
    notTested: 0,
  };

  const categoryTotals = Object.fromEntries(
    CATEGORIES.map(({ category }) => [category, { earned: 0, possible: 0 }]),
  );

  let totalEarned = 0;
  let totalPossible = 0;

  const seoChecks = rawChecks.map((check) => {
    const config = CHECK_WEIGHTS[check.id];
    const maxPoints = config ? config.maxPoints : 0;
    const categoryKey = config ? config.category : check.category;

    if (check.status === 'passed') summary.passed += 1;
    else if (check.status === 'warning') summary.warning += 1;
    else if (check.status === 'failed') summary.failed += 1;
    else summary.notTested += 1;

    if (check.status === 'not_tested') {
      return {
        ...check,
        maxPoints,
        earnedPoints: 0,
      };
    }

    const multiplier = STATUS_MULTIPLIERS[check.status] ?? 0;
    const earnedPoints = Number((maxPoints * multiplier).toFixed(2));

    if (categoryTotals[categoryKey]) {
      categoryTotals[categoryKey].earned = Number(
        (categoryTotals[categoryKey].earned + earnedPoints).toFixed(2),
      );
      categoryTotals[categoryKey].possible += maxPoints;
    }

    totalEarned = Number((totalEarned + earnedPoints).toFixed(2));
    totalPossible += maxPoints;

    return {
      ...check,
      maxPoints,
      earnedPoints,
    };
  });

  const categoryScores = CATEGORIES.map(({ category, label, weight }) => {
    const { earned, possible } = categoryTotals[category];
    const score = possible > 0 ? Math.round((earned / possible) * 100) : null;

    return {
      category,
      label,
      weight,
      earned,
      possible,
      score,
    };
  });

  const overallScore = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  const scoreCoverage = Math.round((totalPossible / TOTAL_POSSIBLE_POINTS) * 100);
  const scoreBand = getScoreBand(overallScore);

  return {
    overallScore,
    scoreCoverage,
    scoreBand,
    categoryScores,
    summary,
    seoChecks,
  };
};

export const scoreAudit = calculateScores;
export default calculateScores;
