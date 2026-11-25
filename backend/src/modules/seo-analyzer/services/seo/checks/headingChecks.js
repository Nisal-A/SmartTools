// Heading checks: headings.h1Exists, headings.h1Single, headings.hierarchy (PROJECT_MASTER_PLAN.md §7).

const findHierarchySkips = (levelsPresent) => {
  const skips = [];
  for (let i = 1; i < levelsPresent.length; i += 1) {
    const prev = levelsPresent[i - 1];
    const current = levelsPresent[i];
    if (current > prev + 1) {
      skips.push(`H${prev} -> H${current}`);
    }
  }
  return skips;
};

export const runHeadingChecks = (headings) => {
  const h1Count = headings?.counts?.h1 ?? 0;
  const levelsPresent = headings?.levelsPresent ?? [];

  const h1ExistsCheck = {
    id: 'headings.h1Exists',
    category: 'headings',
    label: 'H1 heading exists',
    status: h1Count >= 1 ? 'passed' : 'failed',
    value: h1Count,
    message:
      h1Count >= 1
        ? `Found ${h1Count} H1 heading${h1Count === 1 ? '' : 's'} on the page.`
        : 'No non-empty H1 heading was found on the page.',
    reason: null,
  };

  let h1SingleCheck;
  if (h1Count === 0) {
    h1SingleCheck = {
      id: 'headings.h1Single',
      category: 'headings',
      label: 'Single H1 heading',
      status: 'not_tested',
      value: 0,
      message: 'Single-H1 check was not evaluated because the page has no H1 heading.',
      reason: 'NO_H1_FOUND',
    };
  } else if (h1Count === 1) {
    h1SingleCheck = {
      id: 'headings.h1Single',
      category: 'headings',
      label: 'Single H1 heading',
      status: 'passed',
      value: 1,
      message: 'The page has exactly one H1 heading.',
      reason: null,
    };
  } else {
    h1SingleCheck = {
      id: 'headings.h1Single',
      category: 'headings',
      label: 'Single H1 heading',
      status: 'warning',
      value: h1Count,
      message: `The page has ${h1Count} H1 headings; using a single primary H1 is recommended.`,
      reason: null,
    };
  }

  let hierarchyCheck;
  if (levelsPresent.length === 0) {
    hierarchyCheck = {
      id: 'headings.hierarchy',
      category: 'headings',
      label: 'Heading hierarchy order',
      status: 'not_tested',
      value: [],
      message: 'Heading hierarchy could not be evaluated because no headings were found.',
      reason: 'NO_HEADINGS_FOUND',
    };
  } else {
    const skips = findHierarchySkips(levelsPresent);
    hierarchyCheck = {
      id: 'headings.hierarchy',
      category: 'headings',
      label: 'Heading hierarchy order',
      status: skips.length === 0 ? 'passed' : 'warning',
      value: skips,
      message:
        skips.length === 0
          ? 'Heading levels follow a sequential hierarchy without skipped levels.'
          : `Skipped heading levels detected in DOM order: ${skips.join(', ')}.`,
      reason: null,
    };
  }

  return [h1ExistsCheck, h1SingleCheck, hierarchyCheck];
};

export default runHeadingChecks;
