import { CheckCircle2, Globe, Lock, Server } from 'lucide-react';
import UrlForm from '../../components/seo/audit/UrlForm.jsx';
import Card from '../../components/seo/ui/Card.jsx';
import { AUDIT_CATEGORIES } from './utils/constants.js';

export default function AnalyzePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:p-8">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Analyze a Website Page
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Submit any publicly accessible URL using <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">http://</code> or{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">https://</code>. Once the audit completes,
            you will be redirected straight to the full interactive report.
          </p>

          <div className="pt-2">
            <UrlForm />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="What SEOCheck Evaluates (100 Points Total)"
            subtitle="18 deterministic checks across 6 weighted categories"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {AUDIT_CATEGORIES.map((category) => (
                <div
                  key={category.key}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{category.label}</h3>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {category.weight} pts
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{category.summary}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Audit Scope & Safety" subtitle="How the single-page fetcher works">
            <ul className="space-y-3.5 text-xs leading-relaxed text-slate-600">
              <li className="flex items-start gap-2.5">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Single-page audit:</strong> Inspects only the
                  submitted URL plus <code className="rounded bg-slate-100 px-1">/robots.txt</code> and the origin XML
                  sitemap. It never crawls your entire site.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">SSRF protection:</strong> Localhost, private IPs,
                  link-local metadata addresses, and non-80/443 ports are blocked before connection and on every
                  redirect hop.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Server className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Resource caps:</strong> Enforces a 10-second overall
                  timeout, maximum 5 redirects, and a 2 MB decompressed HTML size limit.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-slate-900">Honest coverage:</strong> Checks that do not apply
                  (such as 0 images on a page) are marked <em>Not tested</em> and excluded from the denominator rather
                  than counted as fake passes.
                </span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
