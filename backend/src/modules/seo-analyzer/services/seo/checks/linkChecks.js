// Link checks: links.internalPresent, links.validHref (PROJECT_MASTER_PLAN.md §7).

const MAX_WARNING_INVALID_LINKS = 3;

export const runLinkChecks = (links) => {
  const internal = links?.internal ?? 0;
  const external = links?.external ?? 0;
  const invalid = links?.invalid ?? 0;
  const total = links?.total ?? internal + external + invalid;

  const internalPresentCheck = {
    id: 'links.internalPresent',
    category: 'links',
    label: 'Internal links present',
    status: internal >= 1 ? 'passed' : 'failed',
    value: internal,
    message:
      internal >= 1
        ? `Found ${internal} internal link${internal === 1 ? '' : 's'} on the page.`
        : 'No internal links were found on the page.',
    reason: null,
  };

  let validHrefCheck;
  if (total === 0) {
    validHrefCheck = {
      id: 'links.validHref',
      category: 'links',
      label: 'Valid link href attributes',
      status: 'not_tested',
      value: 0,
      message: 'Link href validity was not evaluated because the page contains no links.',
      reason: 'NOT_APPLICABLE_NO_LINKS',
    };
  } else if (invalid === 0) {
    validHrefCheck = {
      id: 'links.validHref',
      category: 'links',
      label: 'Valid link href attributes',
      status: 'passed',
      value: 0,
      message: 'All links on the page have valid href attributes.',
      reason: null,
    };
  } else if (invalid <= MAX_WARNING_INVALID_LINKS) {
    validHrefCheck = {
      id: 'links.validHref',
      category: 'links',
      label: 'Valid link href attributes',
      status: 'warning',
      value: invalid,
      message: `Found ${invalid} link${invalid === 1 ? '' : 's'} with empty, "#"-only, or javascript: href attributes.`,
      reason: null,
    };
  } else {
    validHrefCheck = {
      id: 'links.validHref',
      category: 'links',
      label: 'Valid link href attributes',
      status: 'failed',
      value: invalid,
      message: `Found ${invalid} links with empty, "#"-only, or javascript: href attributes.`,
      reason: null,
    };
  }

  return [internalPresentCheck, validHrefCheck];
};

export default runLinkChecks;
