import { useMemo, useState } from 'react';
import { STATUS_CONFIG } from '../../../pages/SeoAnalyzer/utils/constants.js';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'failed', label: 'Failed' },
  { key: 'warning', label: 'Warning' },
  { key: 'passed', label: 'Passed' },
  { key: 'not_tested', label: 'Not Tested' },
];

const CATEGORY_LABELS = {
  title: 'Title',
  meta: 'Meta',
  headings: 'Headings',
  images: 'Images',
  links: 'Links',
  technical: 'Technical',
};

const formatMeasuredValue = (check) => {
  const { value, id } = check;
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (id === 'title.length' || id === 'meta.length') return `${value} chars`;
    return String(value);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.length === 0 ? 'None' : value.join(', ');
  }
  if (typeof value === 'object') {
    if (id === 'images.altCoverage') {
      const coverage = value.altCoverage === null ? 'N/A' : `${value.altCoverage}%`;
      return `${coverage} (${value.withAlt ?? 0} with ALT, ${value.missingAlt ?? 0} missing, ${value.emptyAlt ?? 0} empty)`;
    }
    if (id === 'tech.statusRedirects') {
      return `HTTP ${value.status ?? '—'} · ${value.redirects ?? 0} redirect${value.redirects === 1 ? '' : 's'}`;
    }
    if (id === 'tech.robotsTxt' || id === 'tech.sitemap') {
      return value.status ? `HTTP ${value.status}` : 'Unverified';
    }
    return JSON.stringify(value);
  }
  return String(value);
};

export default function ChecksList({ seoChecks = [] }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const counts = useMemo(() => {
    const map = { all: seoChecks.length, failed: 0, warning: 0, passed: 0, not_tested: 0 };
    for (const check of seoChecks) {
      if (Object.hasOwn(map, check.status)) {
        map[check.status] += 1;
      }
    }
    return map;
  }, [seoChecks]);

  const filteredChecks = useMemo(() => {
    if (activeFilter === 'all') return seoChecks;
    return seoChecks.filter((check) => check.status === activeFilter);
  }, [seoChecks, activeFilter]);

  return (
    <Card
      title="Detailed SEO Checks"
      subtitle="All 18 rule-based checks with points earned and measured values"
    >
      <div
        role="tablist"
        aria-label="Filter checks by status"
        className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-4 print:hidden"
      >
        {FILTER_TABS.map(({ key, label }) => {
          const isSelected = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveFilter(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isSelected ? 'bg-blue-500 text-white' : 'bg-white text-slate-600'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {filteredChecks.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600">
          No checks match the selected filter.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {filteredChecks.map((check) => {
            const statusMeta = STATUS_CONFIG[check.status] ?? STATUS_CONFIG.not_tested;
            const measuredText = formatMeasuredValue(check);

            return (
              <li key={check.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        {CATEGORY_LABELS[check.category] || check.category}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900">{check.label}</h3>
                    </div>

                    <p className="text-sm text-slate-700">{check.message}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-slate-600">
                      <span className="break-all" title={measuredText}>
                        <strong className="font-medium text-slate-800">Measured:</strong> {measuredText}
                      </span>
                      {check.reason ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                          Reason: {check.reason}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                    <span className="text-xs font-medium text-slate-600">
                      {check.status === 'not_tested'
                        ? 'Excluded from score'
                        : `${check.earnedPoints ?? 0} / ${check.maxPoints ?? 0} pts`}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
