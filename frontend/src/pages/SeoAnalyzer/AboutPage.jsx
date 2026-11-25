import { Globe, Lock, Scale, ShieldCheck } from 'lucide-react';
import Alert from '../../components/seo/ui/Alert.jsx';
import Card from '../../components/seo/ui/Card.jsx';

const SCORING_BREAKDOWN = [
  {
    category: 'Title',
    weight: 15,
    checks: 'Title exists (8 pts) · Title length 30–60 chars (7 pts)',
  },
  {
    category: 'Meta Description',
    weight: 15,
    checks: 'Meta description exists (8 pts) · Length 70–160 chars (7 pts)',
  },
  {
    category: 'Headings',
    weight: 15,
    checks: 'H1 exists (8 pts) · Single H1 (4 pts) · Sequential H1–H6 hierarchy (3 pts)',
  },
  {
    category: 'Images',
    weight: 15,
    checks: 'Non-decorative image ALT coverage >= 90% (15 pts; decorative alt="" tracked separately)',
  },
  {
    category: 'Links',
    weight: 10,
    checks: 'Internal links present (4 pts) · Valid href attributes (6 pts)',
  },
  {
    category: 'Technical',
    weight: 30,
    checks:
      'HTTPS (6 pts) · HTTP 200 & <=2 redirects (5 pts) · Canonical URL (4 pts) · Viewport (4 pts) · Meta robots indexable (4 pts) · HTML lang (3 pts) · robots.txt (2 pts) · XML sitemap (2 pts)',
  },
];

const SCORE_BANDS = [
  { range: '90 – 100', label: 'Excellent', classes: 'bg-green-50 text-green-800 border-green-200' },
  { range: '75 – 89', label: 'Good', classes: 'bg-green-50 text-green-800 border-green-200' },
  { range: '50 – 74', label: 'Needs work', classes: 'bg-amber-50 text-amber-800 border-amber-200' },
  { range: '0 – 49', label: 'Poor', classes: 'bg-red-50 text-red-800 border-red-200' },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          About SEOCheck
        </h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Methodology, transparent 100-point scoring weights, and SSRF security architecture.
        </p>
      </div>

      <Alert variant="info" title="Educational Score Disclaimer — Not an Official Google Score">
        SEOCheck produces a transparent, rule-based <strong>educational audit score</strong> out of
        100 based on 18 documented on-page and technical checks. It is not an official Google
        ranking formula and does not predict search engine rankings.
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Single-Page Audit Scope" subtitle="Focused, predictable analysis">
          <div className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
            <Globe className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="space-y-2">
              <p>
                Each audit evaluates the single submitted public URL along with its origin&apos;s{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">/robots.txt</code> and XML
                sitemap. SEOCheck never crawls an entire domain or bypasses authentication, CAPTCHAs,
                or paywalls.
              </p>
              <p className="text-xs text-slate-600">
                Only derived metrics, scores, and capped samples are saved in MongoDB — raw page HTML
                is never stored.
              </p>
            </div>
          </div>
        </Card>

        <Card title="SSRF Security-by-Design" subtitle="Safe server-side fetching">
          <div className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="space-y-2">
              <p>
                Outbound fetches enforce strict SSRF defenses: only <code className="rounded bg-slate-100 px-1 text-xs">http:</code> and{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">https:</code> on ports 80/443 are permitted;
                every resolved DNS IP is checked against Node&apos;s <code className="rounded bg-slate-100 px-1 text-xs">net.BlockList</code>{' '}
                (blocking loopback, private RFC 1918, CGNAT, link-local / cloud metadata{' '}
                <code className="rounded bg-slate-100 px-1 text-xs">169.254.169.254</code>, IPv6 ULA, and
                IPv4-mapped IPv6); and connections are pinned to the validated IP to stop DNS rebinding.
              </p>
              <p className="text-xs text-slate-600">
                Redirects are validated manually on every hop (max 5), with a 10-second overall
                deadline and a 2 MB streaming decompressed byte cap.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Transparent 100-Point Scoring Model"
        subtitle="Every weight is stored centrally in scoringConfig.js and sums to exactly 100 points"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th scope="col" className="py-2.5 pr-4">
                  Category
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Weight
                </th>
                <th scope="col" className="py-2.5 pl-4">
                  Checks Included
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {SCORING_BREAKDOWN.map((row) => (
                <tr key={row.category}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{row.category}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-bold text-blue-700">
                    {row.weight} pts
                  </td>
                  <td className="py-3 pl-4 text-xs leading-relaxed text-slate-700">{row.checks}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold text-slate-900">
                <td className="py-3 pr-4">Total</td>
                <td className="px-4 py-3 text-blue-700">100 pts</td>
                <td className="py-3 pl-4 text-xs font-medium text-slate-600">18 checks across 6 categories</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 md:grid-cols-2">
          <div className="space-y-2 text-xs leading-relaxed text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Scale className="h-4 w-4 text-blue-600" aria-hidden="true" />
              <span>How Partial Credit &amp; Coverage Work</span>
            </div>
            <p>
              <strong>Passed</strong> checks earn 100% of their points, <strong>Warning</strong>{' '}
              checks earn 50%, and <strong>Failed</strong> checks earn 0%.
            </p>
            <p>
              Checks marked <strong>Not tested</strong> (such as image ALT coverage on a page with
              zero images, or an unreachable <code className="rounded bg-slate-100 px-1">robots.txt</code>)
              are excluded from both earned and possible points. Your report always shows{' '}
              <strong>Score Coverage</strong> (the percentage of the 100 points that were testable) so
              no score is ever presented as more complete than it is.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-900">Display Score Bands</p>
            <div className="grid grid-cols-2 gap-2">
              {SCORE_BANDS.map((band) => (
                <div
                  key={band.label}
                  className={`rounded-lg border px-3 py-2 text-xs ${band.classes}`}
                >
                  <p className="font-bold">{band.label}</p>
                  <p className="mt-0.5 opacity-90">{band.range} / 100</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Audit Privacy" subtitle="No public audit history (v1)">
        <div className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <div className="space-y-2">
            <p>
              Past audits are never listed publicly. After you run an audit, its report opens at a private
              link scoped to your browser through a random anonymous ID stored in{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">localStorage</code> and sent via the{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">X-Client-Id</code> header.
            </p>
            <p>
              The Overview page shows only anonymized aggregate metrics (totals and averages) across all
              analyzed pages — never individual URLs, page titles, or reports.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
