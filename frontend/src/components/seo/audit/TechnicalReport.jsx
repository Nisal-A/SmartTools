import { ExternalLink } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';

const renderProbeBadge = (probe) => {
  if (!probe) return <Badge variant="not_tested">Not tested</Badge>;
  if (probe.status === 'found') return <Badge variant="passed">Found (HTTP {probe.httpStatus ?? 200})</Badge>;
  if (probe.status === 'not_tested') {
    return <Badge variant="not_tested">Not tested ({probe.reason || 'UNAVAILABLE'})</Badge>;
  }
  if (probe.status === 'invalid_xml') {
    return <Badge variant="warning">Invalid XML (HTTP {probe.httpStatus ?? 200})</Badge>;
  }
  return <Badge variant="warning">Missing (HTTP {probe.httpStatus ?? 404})</Badge>;
};

export default function TechnicalReport({ audit }) {
  const technical = audit?.details?.technical ?? {};
  const redirectChain = Array.isArray(audit?.redirectChain) ? audit.redirectChain : [];
  const finalUrl = audit?.finalUrl || audit?.url || '';

  return (
    <Card
      title="Technical Signals & Crawlability"
      subtitle="Transport security, redirects, head metadata, and origin crawl probes"
    >
      <dl className="divide-y divide-slate-100 text-sm">
        <div className="flex flex-col justify-between gap-1 py-3 first:pt-0 sm:flex-row sm:items-center">
          <dt className="font-medium text-slate-600">HTTPS</dt>
          <dd>
            <Badge variant={technical.https ? 'passed' : 'failed'}>
              {technical.https ? 'Enabled (HTTPS)' : 'Unencrypted (HTTP)'}
            </Badge>
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
          <dt className="font-medium text-slate-600">Final HTTP Status</dt>
          <dd className="font-mono text-xs font-semibold text-slate-900">
            HTTP {audit?.responseStatus ?? '—'}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-start">
          <dt className="shrink-0 font-medium text-slate-600">Final URL</dt>
          <dd className="min-w-0 sm:text-right">
            {finalUrl ? (
              <a
                href={finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all text-xs font-medium text-blue-600 hover:underline"
              >
                <span>{finalUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-start">
          <dt className="shrink-0 font-medium text-slate-600">Redirect Chain</dt>
          <dd className="min-w-0 sm:text-right">
            {redirectChain.length === 0 ? (
              <span className="text-xs text-slate-700">None (direct response)</span>
            ) : (
              <ol className="space-y-1 text-left sm:text-right">
                {redirectChain.map((hop, index) => (
                  <li key={`${hop.url}-${index}`} className="font-mono text-xs break-all text-slate-700">
                    <span className="font-semibold text-slate-900">
                      #{index + 1} [{hop.status}]
                    </span>{' '}
                    {hop.url}
                  </li>
                ))}
              </ol>
            )}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-start">
          <dt className="shrink-0 font-medium text-slate-600">Canonical URL</dt>
          <dd className="min-w-0 break-all font-mono text-xs text-slate-800 sm:text-right">
            {technical.canonical || <span className="font-sans text-slate-500">Not declared</span>}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-start">
          <dt className="shrink-0 font-medium text-slate-600">Viewport Meta</dt>
          <dd className="min-w-0 break-all font-mono text-xs text-slate-800 sm:text-right">
            {technical.viewport || <span className="font-sans text-red-700">Missing</span>}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
          <dt className="font-medium text-slate-600">HTML lang</dt>
          <dd className="font-mono text-xs text-slate-800">
            {technical.lang || <span className="font-sans text-red-700">Missing</span>}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
          <dt className="font-medium text-slate-600">Meta Robots</dt>
          <dd className="font-mono text-xs text-slate-800">
            {technical.robotsMeta || <span className="font-sans text-slate-500">Not specified (indexable)</span>}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1.5 py-3 sm:flex-row sm:items-center">
          <dt className="font-medium text-slate-600">robots.txt Probe</dt>
          <dd className="flex flex-col items-start gap-1 sm:items-end">
            {renderProbeBadge(technical.robotsTxt)}
            {technical.robotsTxt?.url ? (
              <span className="break-all font-mono text-[11px] text-slate-500">
                {technical.robotsTxt.url}
              </span>
            ) : null}
          </dd>
        </div>

        <div className="flex flex-col justify-between gap-1.5 py-3 last:pb-0 sm:flex-row sm:items-center">
          <dt className="font-medium text-slate-600">XML Sitemap Probe</dt>
          <dd className="flex flex-col items-start gap-1 sm:items-end">
            {renderProbeBadge(technical.sitemap)}
            {technical.sitemap?.url ? (
              <span className="break-all font-mono text-[11px] text-slate-500">
                {technical.sitemap.url}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
