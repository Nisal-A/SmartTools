import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, LayoutGrid } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside.js';
import { TOOLS_REGISTRY, getToolsByCategory } from '../../config/toolsRegistry.js';
import { ToolIcon, ToolStatusPill, getAccentStyles } from './toolVisuals.jsx';

const MAX_TOOLS_PER_CATEGORY = 5;

/**
 * Registry-driven list of tools grouped by category. Each category shows up to
 * 5 tools plus a "+N more" link into the filtered Tools Hub, so the menu stays
 * compact no matter how many tools are registered.
 */
export function ToolsMegaMenuPanel({ onNavigate, compact = false }) {
  const groups = getToolsByCategory(TOOLS_REGISTRY);

  return (
    <div data-testid="tools-mega-menu-panel">
      <div className={`grid gap-x-6 gap-y-5 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {groups.map(({ category, tools }) => {
          const visible = tools.slice(0, MAX_TOOLS_PER_CATEGORY);
          const remaining = tools.length - visible.length;

          return (
            <div key={category.id} data-testid={`mega-menu-category-${category.id}`}>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <ToolIcon name={category.iconName} className="h-3 w-3" />
                {category.label}
              </div>
              <ul className="space-y-0.5">
                {visible.map((tool) => {
                  const accent = getAccentStyles(tool.accentColor);
                  const muted = tool.status === 'coming_soon';
                  return (
                    <li key={tool.id}>
                      <Link
                        to={tool.route}
                        onClick={onNavigate}
                        data-testid={`mega-menu-tool-${tool.id}`}
                        className={`group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-50 ${
                          muted ? 'opacity-70' : ''
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${accent.iconWrap}`}
                        >
                          <ToolIcon name={tool.iconName} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-slate-900">
                              {tool.name}
                            </span>
                            {Boolean(tool.guestReadyBadge) && (
                              <span className="inline-flex items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                                Guest Ready
                              </span>
                            )}
                            {tool.status !== 'active' && <ToolStatusPill status={tool.status} />}
                          </span>
                          <span className="block truncate text-[11px] text-slate-500">{tool.tagline}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {remaining > 0 && (
                <Link
                  to={`/tools?category=${encodeURIComponent(category.id)}`}
                  onClick={onNavigate}
                  className="mt-1 inline-block px-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  +{remaining} more in {category.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[11px] text-slate-500">{TOOLS_REGISTRY.length} tools in the SmartTools catalog</span>
        <Link
          to="/tools"
          onClick={onNavigate}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Browse all tools <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/**
 * "Tools" dropdown trigger used in the guest Top Navbar.
 */
export function ToolsMegaMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, isOpen, close);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        data-testid="tools-mega-menu-trigger"
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          isOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Tools
        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,760px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
          <ToolsMegaMenuPanel onNavigate={close} />
        </div>
      )}
    </div>
  );
}

export default ToolsMegaMenu;
