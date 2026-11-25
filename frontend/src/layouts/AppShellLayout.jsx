import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopNavbar } from '../components/navigation/TopNavbar.jsx';
import { SidebarNav } from '../components/navigation/SidebarNav.jsx';

const SIDEBAR_COLLAPSED_KEY = 'smarttools_sidebar_collapsed';

function readCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Authenticated App Shell — Top Navbar + collapsible grouped Sidebar + workspace.
 */
export function AppShellLayout({ children }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-layout="app-shell">
      <TopNavbar variant="app" onToggleMobileNav={() => setMobileOpen((open) => !open)} />
      <div className="flex">
        <SidebarNav
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShellLayout;
