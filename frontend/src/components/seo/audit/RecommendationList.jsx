import { CheckCircle2, HelpCircle } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const PRIORITY_BADGE = {
  high: { variant: 'failed', label: 'High Priority' },
  medium: { variant: 'warning', label: 'Medium Priority' },
  low: { variant: 'info', label: 'Low Priority' },
};

export default function RecommendationList({ recommendations = [], seoChecks = [] }) {
  const sortedRecommendations = [...recommendations].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3),
  );

  const notTestedChecks = seoChecks.filter((check) => check.status === 'not_tested');

  return (
    <div className="space-y-6">
      <Card
        title="Prioritized Recommendations"
        subtitle="Actionable improvements generated directly from this page's measured findings"
      >
        {sortedRecommendations.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
            <span>
              All evaluated checks passed! No corrective recommendations were needed for this page.
            </span>
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedRecommendations.map((rec, index) => {
              const badge = PRIORITY_BADGE[rec.priority] ?? PRIORITY_BADGE.low;
              return (
                <li
                  key={`${rec.checkId}-${index}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{rec.title}</h3>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{rec.description}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {notTestedChecks.length > 0 ? (
        <Card
          title="Could Not Verify"
          subtitle="Checks excluded from your score so unverifiable or non-applicable items never skew results"
        >
          <ul className="space-y-3">
            {notTestedChecks.map((check) => (
              <li
                key={check.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start"
              >
                <div className="flex items-start gap-2.5">
                  <HelpCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{check.label}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{check.message}</p>
                  </div>
                </div>

                <span className="shrink-0 self-start rounded bg-white px-2 py-1 font-mono text-[11px] font-medium text-slate-700 ring-1 ring-inset ring-slate-300">
                  {check.reason || 'NOT_TESTED'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
