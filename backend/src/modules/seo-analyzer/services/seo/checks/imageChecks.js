// Image checks: images.altCoverage (PROJECT_MASTER_PLAN.md §7, ADR-008).

const PASS_COVERAGE_PERCENT = 90;
const WARN_COVERAGE_PERCENT = 50;

export const runImageChecks = (images) => {
  const total = images?.total ?? 0;
  const withAlt = images?.withAlt ?? 0;
  const missingAlt = images?.missingAlt ?? 0;
  const emptyAlt = images?.emptyAlt ?? 0;
  const altCoverage = images?.altCoverage ?? null;

  const value = {
    total,
    withAlt,
    missingAlt,
    emptyAlt,
    altCoverage,
  };

  if (total === 0) {
    return [
      {
        id: 'images.altCoverage',
        category: 'images',
        label: 'Image ALT attribute coverage',
        status: 'not_tested',
        value,
        message: 'No <img> elements were found on the page.',
        reason: 'NOT_APPLICABLE_NO_IMAGES',
      },
    ];
  }

  let status = 'failed';
  if (altCoverage >= PASS_COVERAGE_PERCENT) {
    status = 'passed';
  } else if (altCoverage >= WARN_COVERAGE_PERCENT) {
    status = 'warning';
  }

  const decorativeNote = emptyAlt > 0 ? ` (${emptyAlt} decorative image${emptyAlt === 1 ? '' : 's'} with empty alt="")` : '';

  return [
    {
      id: 'images.altCoverage',
      category: 'images',
      label: 'Image ALT attribute coverage',
      status,
      value,
      message: `${altCoverage}% of non-decorative images have descriptive ALT text (${withAlt} with ALT, ${missingAlt} missing ALT)${decorativeNote}.`,
      reason: null,
    },
  ];
};

export default runImageChecks;
