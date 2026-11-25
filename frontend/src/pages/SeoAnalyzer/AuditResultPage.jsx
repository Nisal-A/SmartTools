import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  FileWarning,
  Printer,
  Search,
} from 'lucide-react';
import CategoryChart from '../../components/seo/audit/CategoryChart.jsx';
import ChecksList from '../../components/seo/audit/ChecksList.jsx';
import HeadingTree from '../../components/seo/audit/HeadingTree.jsx';
import ImageReport from '../../components/seo/audit/ImageReport.jsx';
import LinkReport from '../../components/seo/audit/LinkReport.jsx';
import RecommendationList from '../../components/seo/audit/RecommendationList.jsx';
import ScoreGauge from '../../components/seo/audit/ScoreGauge.jsx';
import StatusSummary from '../../components/seo/audit/StatusSummary.jsx';
import TechnicalReport from '../../components/seo/audit/TechnicalReport.jsx';
import Alert from '../../components/seo/ui/Alert.jsx';
import Button from '../../components/seo/ui/Button.jsx';
import Card from '../../components/seo/ui/Card.jsx';
import EmptyState from '../../components/seo/ui/EmptyState.jsx';
import Spinner from '../../components/seo/ui/Spinner.jsx';
import useAuditDetail from './hooks/useAuditDetail.js';
import { downloadAuditCsv } from './utils/csvExport.js';
import { formatDateTime } from './utils/formatters.js';

const DETAIL_TABS = [
  { key: 'all', label: 'All Details' },
  { key: 'headings', label: 'Headings' },
  { key: 'images', label: 'Images' },
  { key: 'links', label: 'Links' },
  { key: 'technical', label: 'Technical' },
];

export default function AuditResultPage() {
  const { id } = useParams();
  const { audit, loading, error, refetch } = useAuditDetail(id);
  const [detailTab, setDetailTab] = useState('all');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" label="Loading SEO audit report…" />
        <p className="mt-3 text-sm font-medium text-slate-600">Loading SEO audit report…</p>
      </div>
    );
  }

  if (error?.code === 'NOT_FOUND' || (!error && !audit)) {
    return (
      <div className="py-10">
        <EmptyState
          icon={FileWarning}
          title="Audit Report Not Found"
          description="This audit report may have been removed or was created in a different browser session."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/tools/seo-analyzer/analyze"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Run New Audit</span>
              </Link>
              <Link
                to="/tools/seo-analyzer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span>Back to Overview</span>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          to="/tools/seo-analyzer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Overview</span>
        </Link>

        <Alert
          variant="error"
          title="Could not load audit report"
          action={
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          }
        >
          {error.message}
        </Alert>
      </div>
    );
  }

  const submittedUrl = audit.url || '';
  const finalUrl = audit.finalUrl || submittedUrl;
  const wasRedirected = Boolean(submittedUrl && finalUrl && submittedUrl !== finalUrl);
  const lowCoverage = Number(audit.scoreCoverage ?? 0) < 50;

  return (
    <div className="space-y-6">
      {/* Print-only executive header with educational disclaimer */}
      <div className="hidden border-b border-slate-300 pb-3 print:block">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-slate-900">SEOCheck – Audit Report</span>
          <span className="text-xs text-slate-600">Printed {formatDateTime(new Date().toISOString())}</span>
        </div>
        <p className="mt-1 text-xs text-slate-700">
          SEOCheck provides an educational audit score — not an official Google ranking score.
        </p>
      </div>

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to="/tools/seo-analyzer"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Overview</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadAuditCsv(audit)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Download CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Print / Save as PDF</span>
          </Button>
          <Link
            to="/tools/seo-analyzer/analyze"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Run Another Audit</span>
          </Link>
        </div>
      </div>

      {/* Report Header */}
      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-blue-600">
              Single-Page SEO Audit Report
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Analyzed {formatDateTime(audit.analyzedAt)}</span>
            </span>
          </div>

          <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
            {audit.pageTitle || 'Untitled Web Page'}
          </h1>

          {audit.metaDescription ? (
            <p className="text-sm leading-relaxed text-slate-600">{audit.metaDescription}</p>
          ) : (
            <p className="text-xs italic text-slate-500">No meta description found on this page.</p>
          )}

          <div className="space-y-1 border-t border-slate-100 pt-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-700">
                {wasRedirected ? 'Final URL:' : 'Audited URL:'}
              </span>
              <a
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span>{finalUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            </div>

            {wasRedirected ? (
              <p className="break-all text-slate-500">
                <strong className="font-medium text-slate-600">Submitted URL:</strong> {submittedUrl}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Low Coverage Transparency Notice */}
      {lowCoverage ? (
        <Alert variant="warning" title="Limited Score Coverage">
          Only <strong>{audit.scoreCoverage}%</strong> of scoring checks could be verified for this
          page (below 50%). Because untestable checks are excluded from the denominator, treat this
          score as a partial snapshot and inspect the <strong>Could Not Verify</strong> section below.
        </Alert>
      ) : null}

      {/* Top Metrics Row: Score Gauge + Status Summary + Category Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ScoreGauge overallScore={audit.overallScore} scoreCoverage={audit.scoreCoverage} />

        <div className="space-y-6 lg:col-span-2">
          <StatusSummary summary={audit.summary} />
          <CategoryChart categoryScores={audit.categoryScores} />
        </div>
      </div>

      {/* Prioritized Recommendations & Could Not Verify */}
      <RecommendationList
        recommendations={audit.recommendations}
        seoChecks={audit.seoChecks}
      />

      {/* Full Filterable Check List */}
      <ChecksList seoChecks={audit.seoChecks} />

      {/* Structured Detail Panels */}
      <section aria-label="Extracted page details" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Extracted Page Details</h2>
            <p className="text-xs text-slate-600">
              Capped inventory of headings, images, links, and technical headers parsed from the page
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter extracted detail panels"
            className="flex flex-wrap gap-1.5 print:hidden"
          >
            {DETAIL_TABS.map(({ key, label }) => {
              const isSelected = detailTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setDetailTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {detailTab === 'all' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <HeadingTree headings={audit.details?.headings} />
            <ImageReport images={audit.details?.images} />
            <LinkReport links={audit.details?.links} />
            <TechnicalReport audit={audit} />
          </div>
        ) : detailTab === 'headings' ? (
          <HeadingTree headings={audit.details?.headings} />
        ) : detailTab === 'images' ? (
          <ImageReport images={audit.details?.images} />
        ) : detailTab === 'links' ? (
          <LinkReport links={audit.details?.links} />
        ) : (
          <TechnicalReport audit={audit} />
        )}
      </section>

      {/* Print-only footer disclaimer */}
      <div className="hidden border-t border-slate-300 pt-3 text-center text-xs text-slate-600 print:block">
        SEOCheck provides an educational audit score — not an official Google ranking score.
      </div>
    </div>
  );
}
