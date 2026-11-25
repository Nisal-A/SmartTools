// Single source of truth for SEO audit categories, point weights, status multipliers,
// and display score bands (PROJECT_MASTER_PLAN.md §8, ADR-009).

export const TOTAL_POSSIBLE_POINTS = 100;

export const STATUS_MULTIPLIERS = Object.freeze({
  passed: 1,
  warning: 0.5,
  failed: 0,
});

export const CATEGORIES = Object.freeze([
  Object.freeze({ category: 'title', label: 'Title', weight: 15 }),
  Object.freeze({ category: 'meta', label: 'Meta description', weight: 15 }),
  Object.freeze({ category: 'headings', label: 'Headings', weight: 15 }),
  Object.freeze({ category: 'images', label: 'Images', weight: 15 }),
  Object.freeze({ category: 'links', label: 'Links', weight: 10 }),
  Object.freeze({ category: 'technical', label: 'Technical', weight: 30 }),
]);

export const CHECK_WEIGHTS = Object.freeze({
  // Title (15)
  'title.exists': Object.freeze({ category: 'title', maxPoints: 8 }),
  'title.length': Object.freeze({ category: 'title', maxPoints: 7 }),

  // Meta description (15)
  'meta.exists': Object.freeze({ category: 'meta', maxPoints: 8 }),
  'meta.length': Object.freeze({ category: 'meta', maxPoints: 7 }),

  // Headings (15)
  'headings.h1Exists': Object.freeze({ category: 'headings', maxPoints: 8 }),
  'headings.h1Single': Object.freeze({ category: 'headings', maxPoints: 4 }),
  'headings.hierarchy': Object.freeze({ category: 'headings', maxPoints: 3 }),

  // Images (15)
  'images.altCoverage': Object.freeze({ category: 'images', maxPoints: 15 }),

  // Links (10)
  'links.internalPresent': Object.freeze({ category: 'links', maxPoints: 4 }),
  'links.validHref': Object.freeze({ category: 'links', maxPoints: 6 }),

  // Technical (30)
  'tech.https': Object.freeze({ category: 'technical', maxPoints: 6 }),
  'tech.statusRedirects': Object.freeze({ category: 'technical', maxPoints: 5 }),
  'tech.canonical': Object.freeze({ category: 'technical', maxPoints: 4 }),
  'tech.viewport': Object.freeze({ category: 'technical', maxPoints: 4 }),
  'tech.metaRobots': Object.freeze({ category: 'technical', maxPoints: 4 }),
  'tech.lang': Object.freeze({ category: 'technical', maxPoints: 3 }),
  'tech.robotsTxt': Object.freeze({ category: 'technical', maxPoints: 2 }),
  'tech.sitemap': Object.freeze({ category: 'technical', maxPoints: 2 }),
});

export const SCORE_BANDS = Object.freeze([
  Object.freeze({ min: 90, max: 100, label: 'Excellent' }),
  Object.freeze({ min: 75, max: 89, label: 'Good' }),
  Object.freeze({ min: 50, max: 74, label: 'Needs work' }),
  Object.freeze({ min: 0, max: 49, label: 'Poor' }),
]);

export const getScoreBand = (score) => {
  const numeric = Number(score);
  if ( Number.isNaN(numeric) || numeric < 0 ) return 'Poor';
  const clamped = Math.min(100, Math.max(0, Math.round(numeric)));
  const band = SCORE_BANDS.find((entry) => clamped >= entry.min && clamped <= entry.max);
  return band ? band.label : 'Poor';
};

export default {
  TOTAL_POSSIBLE_POINTS,
  STATUS_MULTIPLIERS,
  CATEGORIES,
  CHECK_WEIGHTS,
  SCORE_BANDS,
  getScoreBand,
};
