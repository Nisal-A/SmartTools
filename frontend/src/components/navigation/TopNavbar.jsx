import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Search,
  Shield,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { recordRecentTool } from '../../hooks/useRecentTools.js';
import { getBreadcrumbs } from '../../config/navigation.js';
import { getQuickCreateTools, getToolByRoute } from '../../config/toolsRegistry.js';
import { CommandToolSwitcher, OPEN_COMMAND_SWITCHER_EVENT } from './CommandToolSwitcher.jsx';
import { ToolsMegaMenu } from './ToolsMegaMenu.jsx';
import { ShortcutHint, ToolIcon, getAccentStyles } from './toolVisuals.jsx';

function Breadcrumbs({ pathname }) {
  const crumbs = getBreadcrumbs(pathname);
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-xs md:flex" data-testid="navbar-breadcrumb">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <React.Fragment key={`${crumb.to}-${idx}`}>
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />}
            {isLast ? (
              <span className="truncate font-semibold text-slate-800">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="truncate font-medium text-slate-500 hover:text-slate-800">
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function Dropdown({ trigger, children, align = 'right', widthClass = 'w-56', testId }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(ref, isOpen, close);

  return (
    <div className="relative" ref={ref}>
      {trigger({ isOpen, toggle: () => setIsOpen((open) => !open) })}
      {isOpen && (
        <div
          data-testid={testId}
          className={`absolute top-full z-50 mt-2 ${widthClass} ${
            align === 'right' ? 'right-0' : 'left-0'
          } overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl`}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

function getInitials(user) {
  const source = (user?.fullName || user?.email || 'U').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * Top Navbar shared by Guest and Authenticated shells.
 *
 * Left: mobile menu toggle, brand, dynamic breadcrumb.
 * Center: Ctrl/Cmd+K quick tool switcher trigger.
 * Right: guest (Tools mega-menu, Guest Mode pill, Sign In, Create Free Account)
 *        or authenticated (Quick-Create +, notifications, avatar menu).
 */
export function TopNavbar({ variant = 'guest', onToggleMobileNav }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const isApp = variant === 'app' && isAuthenticated;

  // Global Ctrl+K / Cmd+K shortcut + programmatic open event
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        setIsSwitcherOpen((open) => !open);
      }
    };
    const handleOpen = () => setIsSwitcherOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(OPEN_COMMAND_SWITCHER_EVENT, handleOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_SWITCHER_EVENT, handleOpen);
    };
  }, []);

  // Track recently opened tools for the switcher
  useEffect(() => {
    const tool = getToolByRoute(location.pathname);
    if (tool) recordRecentTool(tool.id);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await logout();
    navigate('/tools');
  };

  return (
    <>
      <header
        className="no-print sticky top-0 z-40 h-14 border-b border-slate-200 bg-white/95 backdrop-blur"
        data-testid="top-navbar"
      >
        <div className="flex h-full items-center gap-3 px-3 sm:px-4">
          {/* Left: menu toggle, brand, breadcrumb */}
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none lg:basis-[30%]">
            <button
              type="button"
              onClick={onToggleMobileNav}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
              aria-label="Toggle navigation menu"
              data-testid="mobile-nav-toggle"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link
              to={isApp ? '/dashboard' : '/'}
              className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight text-slate-900"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="hidden text-base sm:inline">SmartTools</span>
            </Link>

            <span className="mx-1 hidden h-5 w-px bg-slate-200 md:block" />
            <Breadcrumbs pathname={location.pathname} />
          </div>

          {/* Center: Quick tool switcher trigger */}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setIsSwitcherOpen(true)}
              data-testid="command-switcher-trigger"
              className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white"
              aria-label="Open quick tool switcher"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="hidden flex-1 truncate sm:inline">Search tools or jump to…</span>
              <ShortcutHint className="ml-auto hidden sm:inline-flex" />
            </button>
          </div>

          {/* Right */}
          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 lg:flex-none lg:basis-[30%]">
            {!isApp ? (
              <>
                <div className="hidden md:block">
                  <ToolsMegaMenu />
                </div>
                <span
                  className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 xl:inline-flex"
                  data-testid="guest-mode-pill"
                >
                  Guest Mode
                </span>
                <button
                  type="button"
                  onClick={() => openAuthModal({ mode: 'login' })}
                  className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal({ mode: 'register' })}
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <span className="hidden sm:inline">Create Free Account</span>
                  <span className="sm:hidden">Sign Up</span>
                </button>
              </>
            ) : (
              <>
                <Dropdown
                  testId="quick-create-menu"
                  trigger={({ isOpen, toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={isOpen}
                      aria-label="Quick create"
                      data-testid="quick-create-trigger"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      <div className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Quick Create
                      </div>
                      {getQuickCreateTools().map((tool) => {
                        const accent = getAccentStyles(tool.accentColor);
                        return (
                          <Link
                            key={tool.id}
                            to={tool.route}
                            onClick={close}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <span className={`flex h-7 w-7 items-center justify-center rounded-md ${accent.iconWrap}`}>
                              <ToolIcon name={tool.iconName} className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-medium">{tool.quickCreateLabel}</span>
                          </Link>
                        );
                      })}
                    </>
                  )}
                </Dropdown>

                <Dropdown
                  widthClass="w-72"
                  testId="notifications-menu"
                  trigger={({ isOpen, toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={isOpen}
                      aria-label="Notifications"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                  )}
                >
                  <div className="px-4 py-6 text-center">
                    <Bell className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">You're all caught up</p>
                    <p className="mt-0.5 text-xs text-slate-500">Payment and quotation alerts will appear here.</p>
                  </div>
                </Dropdown>

                <Dropdown
                  widthClass="w-64"
                  testId="user-avatar-menu"
                  trigger={({ isOpen, toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={isOpen}
                      data-testid="user-avatar-trigger"
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-2 transition hover:bg-slate-50"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                        {getInitials(user)}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      <div className="border-b border-slate-100 px-4 pb-2.5 pt-1.5">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {user?.fullName || 'My Account'}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user?.email}</p>
                        {user?.role === 'admin' && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                            <Shield className="h-3 w-3" /> Administrator
                          </span>
                        )}
                      </div>
                      <Link
                        to="/profile"
                        onClick={close}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <UserCog className="h-4 w-4 text-slate-400" /> Profile Management
                      </Link>
                      <Link
                        to="/profile?tab=security"
                        onClick={close}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <KeyRound className="h-4 w-4 text-slate-400" /> Account Security
                      </Link>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          close();
                          handleSignOut();
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                        data-testid="sign-out-btn"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </>
                  )}
                </Dropdown>
              </>
            )}
          </div>
        </div>
      </header>

      <CommandToolSwitcher isOpen={isSwitcherOpen} onClose={() => setIsSwitcherOpen(false)} />
    </>
  );
}

export default TopNavbar;
