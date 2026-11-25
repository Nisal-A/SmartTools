import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  FileSpreadsheet,
  FileText,
  Layers,
  LogOut,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext.jsx';

export function AppShellLayout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-layout="app-shell">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link to="/tools" className="flex items-center gap-2 font-extrabold tracking-tight text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-base">SmartTools</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Cloud
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <NavLink
                to="/tools"
                end
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Layers className="h-3.5 w-3.5" />
                Tools Hub
              </NavLink>
              <NavLink
                to="/tools/invoice-generator"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <FileText className="h-3.5 w-3.5" />
                Invoice Generator
              </NavLink>
              <NavLink
                to="/tools/quotation-generator"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Quotation Generator
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 sm:flex">
              <UserCircle2 className="h-4 w-4 text-indigo-600" />
              <span>{user?.fullName || user?.email || 'Account'}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}

export default AppShellLayout;
