import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Printer,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { TOOLS_REGISTRY, getActiveTools, getComingSoonTools } from '../../config/toolsRegistry.js';
import { ToolIcon, ToolStatusPill, getAccentStyles } from '../../components/navigation/toolVisuals.jsx';

const VALUE_PROPS = [
  {
    icon: UserCheck,
    title: 'No signup required',
    body: 'Open any guest-ready tool instantly. Drafts auto-save in your browser.',
  },
  {
    icon: Printer,
    title: 'Print-perfect PDFs',
    body: 'A4, A5, Letter, Legal, B5 and 80mm thermal layouts that adapt — not just shrink.',
  },
  {
    icon: CloudUpload,
    title: 'Cloud sync when ready',
    body: 'Create a free account to save documents, customers, payments and history.',
  },
];

/**
 * Public Landing Page (`/`) — explains the multi-tool platform with zero-signup CTAs.
 */
export function LandingPage() {
  const featuredTools = getActiveTools().filter((tool) => tool.featured);
  const roadmapTools = getComingSoonTools();

  return (
    <div className="space-y-12 pb-10" data-testid="landing-page">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-12 shadow-sm sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" /> {TOOLS_REGISTRY.length} business tools · one workspace
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Every business document tool you need, <span className="text-indigo-600">in one place.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
            SmartTools brings independent tools — starting with the Invoice Generator and Quotation Generator — under one
            account, one customer directory and one document history. Start instantly as a guest; sync to the cloud when
            you're ready.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/tools/invoice-generator"
              data-testid="landing-cta-invoice"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto"
            >
              <FileText className="h-4 w-4" /> Create Free Invoice
            </Link>
            <Link
              to="/tools/quotation-generator"
              data-testid="landing-cta-quotation"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
            >
              <FileSpreadsheet className="h-4 w-4" /> Create Free Quotation
            </Link>
            <Link
              to="/tools"
              data-testid="landing-cta-explore"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              <LayoutGrid className="h-4 w-4" /> Explore All Tools
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-400">No credit card. No account needed to create and download PDFs.</p>
        </div>
      </section>

      {/* Value props */}
      <section className="grid gap-4 md:grid-cols-3">
        {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{body}</p>
          </div>
        ))}
      </section>

      {/* Featured tools (registry-driven) */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Featured tools</h2>
            <p className="text-sm text-slate-500">Ready to launch — guest-ready document generators plus cloud finance &amp; AI workflows.</p>
          </div>
          <Link to="/tools" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {featuredTools.map((tool) => {
            const accent = getAccentStyles(tool.accentColor);
            return (
              <Link
                key={tool.id}
                to={tool.route}
                className={`group flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent.hoverBorder}`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.iconWrap}`}>
                  <ToolIcon name={tool.iconName} className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{tool.name}</span>
                    <ToolStatusPill status={tool.status} />
                    {Boolean(tool.guestReadyBadge) && (
                      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                        Guest Ready
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">{tool.description}</span>
                  <span className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold ${accent.text}`}>
                    Start now <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Roadmap teaser */}
      {roadmapTools.length > 0 && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Coming to SmartTools</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {roadmapTools.map((tool) => (
              <Link
                key={tool.id}
                to={tool.route}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <ToolIcon name={tool.iconName} className="h-3.5 w-3.5" /> {tool.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default LandingPage;
