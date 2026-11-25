import { Activity, BarChart3, FileSearch, Gauge, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import UrlForm from '../../components/seo/audit/UrlForm.jsx';
import Alert from '../../components/seo/ui/Alert.jsx';
import Badge from '../../components/seo/ui/Badge.jsx';
import Button from '../../components/seo/ui/Button.jsx';
import Card from '../../components/seo/ui/Card.jsx';
import EmptyState from '../../components/seo/ui/EmptyState.jsx';
import Spinner from '../../components/seo/ui/Spinner.jsx';
import useGlobalStats from './hooks/useGlobalStats.js';
import { getScoreBand } from './utils/formatters.js';

const formatCount = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);

function StatTile({ icon: Icon, label, children, footnote }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
        <Icon className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
        <span>{label}</span>
      </p>
      <div className="mt-2">{children}</div>
      {footnote ? <p className="mt-2 text-xs text-slate-600">{footnote}</p> : null}
    </div>
  );
}

function PlatformMetrics({ stats }) {
  const { totalAudits, averageScore, averageCoverage, totals } = stats;
  const band = averageScore === null ? null : getScoreBand(averageScore);

  const outcomeRows = [
    { variant: 'passed', label: 'Passed', value: totals.passed },
    { variant: 'warning', label: 'Warning', value: totals.warning },
    { variant: 'failed', label: 'Failed', value: totals.failed },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Activity} label="Total Audits Run" footnote="Completed single-page audits">
          <span className="text-3xl font-bold text-slate-900">{formatCount(totalAudits)}</span>
        </StatTile>

        <StatTile icon={Gauge} label="Average Educational Score" footnote="Mean overall score">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {averageScore ?? '—'}
              <span className="text-base font-normal text-slate-500">/100</span>
            </span>
            {band ? <Badge variant={band.variant}>{band.label}</Badge> : null}
          </div>
        </StatTile>

        <StatTile icon={BarChart3} label="Average Check Coverage" footnote="Share of checks that could be scored">
          <span className="text-3xl font-bold text-slate-900">
            {averageCoverage ?? '—'}
            <span className="text-base font-normal text-slate-500">%</span>
          </span>
        </StatTile>

        <StatTile
          icon={ShieldCheck}
          label="Check Outcomes"
          footnote={`${formatCount(totals.notTested)} not tested`}
        >
          <ul className="space-y-1.5" aria-label="Aggregate check outcomes">
            {outcomeRows.map((row) => (
              <li key={row.variant} className="flex items-center justify-between gap-2">
                <Badge variant={row.variant}>{row.label}</Badge>
                <span className="text-sm font-semibold text-slate-900">{formatCount(row.value)}</span>
              </li>
            ))}
          </ul>
        </StatTile>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>
          These figures are anonymized aggregate educational audit metrics across all pages analyzed with
          SEOCheck. Individual URLs, page titles, and reports are never shown.
        </span>
      </p>
    </div>
  );
}

export default function OverviewPage() {
  const { stats, loading, error, refetch } = useGlobalStats();
  const hasAudits = (stats?.totalAudits ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Hero + URL submission */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Single-Page Technical &amp; On-Page SEO Auditor</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Audit any public web page with transparent, rule-based SEO checks
          </h1>

          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Enter a full <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">https://</code> or{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">http://</code> URL below.
            SEOCheck safely fetches the page, evaluates 18 on-page and technical signals, and calculates an
            educational score out of 100.
          </p>

          <div className="pt-2">
            <UrlForm />
          </div>
        </div>
      </section>

      {/* Anonymized platform-wide aggregates (live from GET /api/audits/stats — zero fake stats) */}
      <Card
        title="Platform Audit Metrics"
        subtitle="Anonymized aggregate educational audit metrics across all analyzed pages"
        action={
          <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </Button>
        }
        aria-label="Platform audit metrics"
      >
        {loading && !stats ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" label="Loading platform metrics…" />
            <span className="ml-2 text-sm text-slate-600">Loading platform metrics…</span>
          </div>
        ) : error ? (
          <Alert
            variant="error"
            title="Could not load platform metrics"
            action={
              <Button variant="outline" size="sm" onClick={refetch}>
                Try again
              </Button>
            }
          >
            {error.message}
          </Alert>
        ) : !hasAudits ? (
          <EmptyState
            icon={FileSearch}
            title="No audit metrics yet"
            description="Platform averages will appear here once the first page audit has been completed. Submit a public URL above to get started."
          />
        ) : (
          <PlatformMetrics stats={stats} />
        )}
      </Card>
    </div>
  );
}
