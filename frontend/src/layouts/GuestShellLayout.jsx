import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../app/AuthContext.jsx';
import { TopNavbar } from '../components/navigation/TopNavbar.jsx';
import { ToolsMegaMenuPanel } from '../components/navigation/ToolsMegaMenu.jsx';

/**
 * Guest Shell — Top Navbar + full-width workspace (no auth sidebar), giving guests
 * maximum room for the Invoice & Quotation split-screen editors.
 */
export function GuestShellLayout({ children }) {
  const location = useLocation();
  const { openAuthModal } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-layout="guest-shell">
      <TopNavbar variant="guest" onToggleMobileNav={() => setMobileOpen((open) => !open)} />

      {/* Mobile tools drawer (guest) */}
      <div
        className={`no-print fixed inset-0 top-14 z-30 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-900/30 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          data-testid="guest-mobile-drawer"
          className={`absolute inset-x-0 top-0 max-h-[80vh] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-xl transition-transform duration-200 ${
            mobileOpen ? 'translate-y-0' : '-translate-y-[110%]'
          }`}
        >
          <ToolsMegaMenuPanel compact onNavigate={() => setMobileOpen(false)} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openAuthModal({ mode: 'login' });
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                openAuthModal({ mode: 'register' });
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <UserPlus className="h-4 w-4" /> Create Account
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}

export default GuestShellLayout;
