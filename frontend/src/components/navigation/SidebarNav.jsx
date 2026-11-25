import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Pin, Plus, X } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { usePinnedTools } from '../../hooks/usePinnedTools.js';
import {
  ADMIN_NAV_ITEMS,
  CORE_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
} from '../../config/navigation.js';
import { ToolIcon, getAccentStyles } from './toolVisuals.jsx';

function NavItem({ to, end, label, icon, collapsed, onNavigate, testId, neverActive = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      data-testid={testId}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive && !neverActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {icon}
      {collapsed ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
          {label}
        </span>
      ) : (
        <span className="truncate">{label}</span>
      )}
    </NavLink>
  );
}

function GroupLabel({ collapsed, children, trailing }) {
  if (collapsed) return <div className="mx-3 my-2 border-t border-slate-200" />;
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
      <span>{children}</span>
      {trailing}
    </div>
  );
}

function SidebarContent({ collapsed, onNavigate }) {
  const { user } = useAuth();
  const { pinnedTools, maxPins } = usePinnedTools();

  return (
    <nav className="flex flex-col gap-0.5 px-2 py-3" aria-label="Main navigation">
      <GroupLabel collapsed={collapsed}>Core</GroupLabel>
      {CORE_NAV_ITEMS.map((item) => (
        <NavItem
          key={item.id}
          to={item.to}
          end={item.end}
          label={item.label}
          collapsed={collapsed}
          onNavigate={onNavigate}
          testId={`sidebar-${item.id}`}
          icon={<ToolIcon name={item.iconName} className="h-4 w-4 shrink-0" />}
        />
      ))}

      <GroupLabel
        collapsed={collapsed}
        trailing={
          <span className="font-semibold normal-case tracking-normal text-slate-400">
            {pinnedTools.length}/{maxPins}
          </span>
        }
      >
        Pinned Tools
      </GroupLabel>
      <div data-testid="sidebar-pinned-tools" className="flex flex-col gap-0.5">
        {pinnedTools.map((tool) => {
          const accent = getAccentStyles(tool.accentColor);
          return (
            <NavItem
              key={tool.id}
              to={tool.route}
              label={tool.name}
              collapsed={collapsed}
              onNavigate={onNavigate}
              testId={`sidebar-pinned-${tool.id}`}
              icon={
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accent.iconWrap}`}>
                  <ToolIcon name={tool.iconName} className="h-3.5 w-3.5" />
                </span>
              }
            />
          );
        })}
        {pinnedTools.length === 0 && !collapsed && (
          <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400">
            <Pin className="h-3 w-3" /> No pinned tools yet
          </p>
        )}
        <NavItem
          to="/tools?pinned=1"
          label="Manage Pins"
          collapsed={collapsed}
          onNavigate={onNavigate}
          testId="sidebar-manage-pins"
          neverActive
          icon={<Plus className="h-4 w-4 shrink-0" />}
        />
      </div>

      <GroupLabel collapsed={collapsed}>Workspace</GroupLabel>
      {WORKSPACE_NAV_ITEMS.map((item) => (
        <NavItem
          key={item.id}
          to={item.to}
          label={item.label}
          collapsed={collapsed}
          onNavigate={onNavigate}
          testId={`sidebar-${item.id}`}
          icon={<ToolIcon name={item.iconName} className="h-4 w-4 shrink-0" />}
        />
      ))}

      {user?.role === 'admin' && (
        <div data-testid="sidebar-admin-group" className="flex flex-col gap-0.5">
          <GroupLabel collapsed={collapsed}>Admin</GroupLabel>
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id}
              to={item.to}
              label={item.label}
              collapsed={collapsed}
              onNavigate={onNavigate}
              testId={`sidebar-${item.id}`}
              icon={<ToolIcon name={item.iconName} className="h-4 w-4 shrink-0" />}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

/**
 * Authenticated collapsible sidebar.
 *
 * Groups: Core, Pinned Tools (max 5), Workspace, Admin (admins only).
 * Desktop: full width or collapsed icon-rail with hover tooltips.
 * Mobile: slide-over drawer controlled by the Top Navbar menu toggle.
 */
export function SidebarNav({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        data-testid="sidebar-nav"
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`no-print sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className={`flex-1 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
          <SidebarContent collapsed={collapsed} />
        </div>
        <div className="border-t border-slate-200 p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-testid="sidebar-collapse-toggle"
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${
              collapsed ? 'justify-center' : ''
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile slide-over drawer */}
      <div
        className={`no-print fixed inset-0 z-50 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-slate-900/40 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onCloseMobile}
        />
        <aside
          data-testid="sidebar-mobile-drawer"
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <Link to="/dashboard" onClick={onCloseMobile} className="text-base font-extrabold tracking-tight text-slate-900">
              SmartTools
            </Link>
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarContent collapsed={false} onNavigate={onCloseMobile} />
          </div>
        </aside>
      </div>
    </>
  );
}

export default SidebarNav;
