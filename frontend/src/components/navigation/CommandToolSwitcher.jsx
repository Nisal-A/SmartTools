import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, LogIn, Search, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { useRecentTools } from '../../hooks/useRecentTools.js';
import {
  TOOLS_REGISTRY,
  getToolsByCategory,
  isToolLaunchable,
  searchTools,
} from '../../config/toolsRegistry.js';
import {
  ADMIN_NAV_ITEMS,
  CORE_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
} from '../../config/navigation.js';
import { ToolIcon, ToolStatusPill, getAccentStyles } from './toolVisuals.jsx';

export const OPEN_COMMAND_SWITCHER_EVENT = 'smarttools:open-command-switcher';

/** Opens the global Ctrl+K switcher from anywhere (e.g. the Tools Hub search hint). */
export function openCommandSwitcher() {
  window.dispatchEvent(new Event(OPEN_COMMAND_SWITCHER_EVENT));
}

function toolToItem(tool, keyPrefix) {
  return {
    key: `${keyPrefix}-${tool.id}`,
    type: 'tool',
    label: tool.name,
    description: tool.tagline || tool.description,
    iconName: tool.iconName,
    accentColor: tool.accentColor,
    tool,
    to: tool.route,
  };
}

/**
 * Ctrl+K / Cmd+K Command Tool Switcher
 *
 * Instant searchable modal listing every registry tool grouped by category,
 * recent tools and quick navigation actions. Fully keyboard driven and
 * virtualisation-free but scroll-contained, so it scales cleanly past 50 tools.
 */
export function CommandToolSwitcher({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { isAuthenticated, user, openAuthModal } = useAuth();
  const recentTools = useRecentTools();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const actions = useMemo(() => {
    if (!isAuthenticated) {
      return [
        { key: 'nav-all-tools', type: 'action', label: 'Browse All Tools', iconName: 'LayoutGrid', to: '/tools' },
        { key: 'nav-home', type: 'action', label: 'Home', iconName: 'Layers', to: '/' },
        {
          key: 'auth-login',
          type: 'action',
          label: 'Sign In',
          description: 'Sync drafts, customers and history',
          LucideIcon: LogIn,
          run: () => openAuthModal({ mode: 'login' }),
        },
        {
          key: 'auth-register',
          type: 'action',
          label: 'Create Free Account',
          LucideIcon: UserPlus,
          run: () => openAuthModal({ mode: 'register' }),
        },
      ];
    }

    const sections = [...CORE_NAV_ITEMS, ...WORKSPACE_NAV_ITEMS];
    if (user?.role === 'admin') sections.push(...ADMIN_NAV_ITEMS);
    return sections.map((item) => ({
      key: `nav-${item.id}`,
      type: 'action',
      label: item.label,
      iconName: item.iconName,
      to: item.to,
    }));
  }, [isAuthenticated, user?.role, openAuthModal]);

  const sections = useMemo(() => {
    const trimmed = query.trim();
    const result = [];

    if (!trimmed) {
      if (recentTools.length > 0) {
        result.push({
          id: 'recent',
          label: 'Recent Tools',
          items: recentTools.slice(0, 5).map((tool) => toolToItem(tool, 'recent')),
        });
      }
      for (const group of getToolsByCategory(TOOLS_REGISTRY)) {
        result.push({
          id: `cat-${group.category.id}`,
          label: group.category.label,
          items: group.tools.map((tool) => toolToItem(tool, 'tool')),
        });
      }
      result.push({ id: 'actions', label: 'Quick Navigation', items: actions });
      return result;
    }

    for (const group of getToolsByCategory(searchTools(trimmed))) {
      result.push({
        id: `cat-${group.category.id}`,
        label: group.category.label,
        items: group.tools.map((tool) => toolToItem(tool, 'tool')),
      });
    }

    const lowered = trimmed.toLowerCase();
    const matchingActions = actions.filter((action) =>
      `${action.label} ${action.description || ''}`.toLowerCase().includes(lowered)
    );
    if (matchingActions.length > 0) {
      result.push({ id: 'actions', label: 'Quick Navigation', items: matchingActions });
    }
    return result;
  }, [query, recentTools, actions]);

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  const selectItem = (item) => {
    if (!item) return;
    onClose();
    if (item.run) {
      item.run();
      return;
    }
    if (item.to) navigate(item.to);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((idx) => (flatItems.length === 0 ? 0 : (idx + 1) % flatItems.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((idx) =>
        flatItems.length === 0 ? 0 : (idx - 1 + flatItems.length) % flatItems.length
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectItem(flatItems[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  let runningIndex = -1;
  const launchableCount = TOOLS_REGISTRY.filter(isToolLaunchable).length;

  return (
    <div
      className="no-print fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 px-3 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick tool switcher"
        data-testid="command-tool-switcher"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools, categories, or jump to a page…"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            data-testid="command-switcher-input"
            aria-label="Search tools"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close switcher"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2">
          {flatItems.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No tools match <span className="font-semibold text-slate-700">“{query}”</span>.
            </div>
          )}

          {sections.map((section) => (
            <div key={section.id} className="mb-2" data-testid={`command-section-${section.id}`}>
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.label}
              </div>
              {section.items.map((item) => {
                runningIndex += 1;
                const index = runningIndex;
                const isActive = index === activeIndex;
                const accent = getAccentStyles(item.accentColor);
                const comingSoon = item.tool && !isToolLaunchable(item.tool);
                const Icon = item.LucideIcon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    data-index={index}
                    data-testid={`command-item-${item.key}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectItem(item)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                      isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    } ${comingSoon ? 'opacity-70' : ''}`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.type === 'tool' ? accent.iconWrap : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : <ToolIcon name={item.iconName} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">{item.label}</span>
                        {item.tool && item.tool.status !== 'active' && (
                          <ToolStatusPill status={item.tool.status} />
                        )}
                      </span>
                      {item.description && (
                        <span className="block truncate text-xs text-slate-500">{item.description}</span>
                      )}
                    </span>
                    {isActive &&
                      (comingSoon ? (
                        <span className="text-[10px] font-semibold text-slate-400">Preview</span>
                      ) : (
                        <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500" />
                      ))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> open
            </span>
            <span>esc close</span>
          </span>
          <span>
            {launchableCount} available · {TOOLS_REGISTRY.length} total tools
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandToolSwitcher;
