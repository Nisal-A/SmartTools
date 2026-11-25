import React from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Activity, Clock, Globe, Info, Search } from 'lucide-react';
import OverviewPage from './OverviewPage.jsx';
import AnalyzePage from './AnalyzePage.jsx';
import AuditResultPage from './AuditResultPage.jsx';
import AuditHistoryPage from './AuditHistoryPage.jsx';
import AboutPage from './AboutPage.jsx';

const SUB_NAV_ITEMS = [
  { to: '/tools/seo-analyzer', label: 'Overview', icon: Activity, end: true },
  { to: '/tools/seo-analyzer/analyze', label: 'Analyze URL', icon: Search },
  { to: '/tools/seo-analyzer/history', label: 'My Audits', icon: Clock },
  { to: '/tools/seo-analyzer/about', label: 'About', icon: Info },
];

/**
 * SEO Analyzer Tool Shell (`SeoToolShell.jsx`)
 *
 * Renders a clean top sub-navigation bar inside SmartTools' `GuestShellLayout`
 * (for guests) or `AppShellLayout` (for authenticated users) and hosts all
 * SEO Analyzer views under `/tools/seo-analyzer/*`.
 */
export function SeoToolShell() {
  return (
    <div className="space-y-6" data-testid="seo-tool-shell">
      {/* Tool Sub-Navigation Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900">
              SEO Analyzer
            </h2>
            <p className="text-[11px] text-slate-500">
              18-point technical &amp; on-page auditor with SSRF protection
            </p>
          </div>
        </div>

        <nav
          aria-label="SEO Analyzer navigation"
          className="flex flex-wrap items-center gap-1"
          data-testid="seo-subnav"
        >
          {SUB_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`seo-subnav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Nested SEO Tool Routes */}
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="history" element={<AuditHistoryPage />} />
        <Route path="audits/:id" element={<AuditResultPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/tools/seo-analyzer" replace />} />
      </Routes>
    </div>
  );
}

export default SeoToolShell;
