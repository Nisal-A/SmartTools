// Client-side RFC 4180 CSV exporter with spreadsheet formula-injection protection (ADR-012).

const FORMULA_TRIGGER_PREFIX = /^[=+\-@\t\r]/;

/**
 * Safely converts any cell value to an RFC 4180 CSV string while neutralizing
 * spreadsheet formula injection (=, +, -, @, tab, CR) and omitting literal "null"/"undefined".
 */
export const escapeCsvCell = (rawValue) => {
  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  let text;
  if (Array.isArray(rawValue)) {
    text = rawValue.join('; ');
  } else if (typeof rawValue === 'object') {
    text = Object.entries(rawValue)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  } else {
    text = String(rawValue);
  }

  // Neutralize spreadsheet formula execution (CWE-1236) by prefixing with a single quote.
  if (FORMULA_TRIGGER_PREFIX.test(text)) {
    text = `'${text}`;
  }

  const needsQuoting = /[",\r\n]/.test(text) || text.startsWith("'");
  if (!needsQuoting) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

const toCsvRow = (cells) => cells.map(escapeCsvCell).join(',');

const buildFilename = (audit) => {
  const rawUrl = audit?.finalUrl || audit?.url || 'report';
  let hostSlug = 'report';

  try {
    const parsed = new URL(rawUrl);
    hostSlug = parsed.hostname.replace(/[^a-z0-9.-]/gi, '-').replace(/\./g, '-');
  } catch {
    hostSlug = 'report';
  }

  const dateObj = audit?.analyzedAt ? new Date(audit.analyzedAt) : new Date();
  const isoDate = Number.isNaN(dateObj.getTime())
    ? new Date().toISOString().slice(0, 10)
    : dateObj.toISOString().slice(0, 10);

  return `seocheck-${hostSlug}-${isoDate}.csv`;
};

/**
 * Generates the complete CSV text for a saved audit report.
 */
export const buildAuditCsv = (audit) => {
  if (!audit) return '';

  const rows = [
    toCsvRow(['SEOCheck Audit Report', 'Educational audit score — not an official Google ranking score']),
    toCsvRow(['Submitted URL', audit.url ?? '']),
    toCsvRow(['Final URL', audit.finalUrl ?? '']),
    toCsvRow(['Page Title', audit.pageTitle ?? '']),
    toCsvRow(['Meta Description', audit.metaDescription ?? '']),
    toCsvRow(['Analyzed At', audit.analyzedAt ?? '']),
    toCsvRow(['HTTP Status', audit.responseStatus ?? '']),
    toCsvRow(['Educational Score (0-100)', audit.overallScore ?? '']),
    toCsvRow(['Score Coverage (%)', audit.scoreCoverage ?? '']),
    toCsvRow(['Passed Checks', audit.summary?.passed ?? 0]),
    toCsvRow(['Warning Checks', audit.summary?.warning ?? 0]),
    toCsvRow(['Failed Checks', audit.summary?.failed ?? 0]),
    toCsvRow(['Not Tested Checks', audit.summary?.notTested ?? 0]),
    '',
    toCsvRow([
      'Check ID',
      'Category',
      'Label',
      'Status',
      'Earned Points',
      'Max Points',
      'Measured Value',
      'Message',
      'Not Tested Reason',
    ]),
  ];

  const checks = Array.isArray(audit.seoChecks) ? audit.seoChecks : [];
  for (const check of checks) {
    rows.push(
      toCsvRow([
        check.id,
        check.category,
        check.label,
        check.status,
        check.status === 'not_tested' ? '' : check.earnedPoints,
        check.maxPoints,
        check.value,
        check.message,
        check.reason ?? '',
      ]),
    );
  }

  rows.push('');
  rows.push(toCsvRow(['Recommendation Priority', 'Check ID', 'Title', 'Description']));

  const recommendations = Array.isArray(audit.recommendations) ? audit.recommendations : [];
  for (const rec of recommendations) {
    rows.push(toCsvRow([rec.priority, rec.checkId, rec.title, rec.description]));
  }

  return rows.join('\r\n');
};

/**
 * Builds and triggers a client-side CSV download for the loaded audit report.
 */
export const downloadAuditCsv = (audit) => {
  if (!audit) return;

  const csvContent = `\uFEFF${buildAuditCsv(audit)}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = buildFilename(audit);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

export default downloadAuditCsv;
