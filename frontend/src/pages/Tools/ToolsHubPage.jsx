import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  LayoutGrid,
  Pin,
  Rocket,
  Search,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { usePinnedTools } from '../../hooks/usePinnedTools.js';
import {
  TOOLS_REGISTRY,
  getCategoryMeta,
  getToolsByCategory,
  isToolLaunchable,
  searchTools,
} from '../../config/toolsRegistry.js';
import { openCommandSwitcher } from '../../components/navigation/CommandToolSwitcher.jsx';
import {
  ShortcutHint,
  ToolIcon,
  ToolStatusPill,
  getAccentStyles,
} from '../../components/navigation/toolVisuals.jsx';

function FilterPill({ active, onClick, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function ToolCard({ tool, pinned, onTogglePin, pinBusy }) {
  const accent = getAccentStyles(tool.accentColor);
  const launchable = isToolLaunchable(tool);
  const category = getCategoryMeta(tool.category);

  return (
    <article
      data-testid={`tool-card-${tool.id}`}
      data-status={tool.status}
      className={`group relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
        launchable
          ? `border-slate-200 hover:-translate-y-0.5 hover:shadow-md ${accent.hoverBorder}`
          : 'border-dashed border-slate-200 bg-slate-50/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            launchable ? accent.iconWrap : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
          }`}
        >
          <ToolIcon name={tool.iconName} className="h-5 w-5" />
        </span>

        {launchable && (
          <button
            type="button"
            onClick={() => onTogglePin(tool.id)}
            disabled={pinBusy}
            aria-pressed={pinned}
            aria-label={pinned ? `Unpin ${tool.name}` : `Pin ${tool.name}`}
            title={pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
            data-testid={`pin-toggle-${tool.id}`}
            className={`rounded-lg p-1.5 transition ${
              pinned ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
            }`}
          >
            <Star className="h-4.5 w-4.5 h-[18px] w-[18px]" fill={pinned ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{category.label}</span>
        <span className="text-slate-300">·</span>
        <ToolStatusPill status={tool.status} />
        {tool.supportsGuestMode && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
            <UserCheck className="h-3 w-3" /> Guest Ready
          </span>
        )}
      </div>

      <h3 className={`mt-2 text-base font-bold ${launchable ? 'text-slate-900' : 'text-slate-500'}`}>{tool.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{tool.description}</p>

      {Array.isArray(tool.highlights) && tool.highlights.length > 0 && (
        <ul className="mt-3 space-y-1">
          {tool.highlights.slice(0, 3).map((highlight) => (
            <li key={highlight} className="flex items-center gap-1.5 text-xs text-slate-600">
              <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${launchable ? accent.text : 'text-slate-300'}`} />
              {highlight}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-5">
        {launchable ? (
          <Link
            to={tool.route}
            data-testid={`open-tool-${tool.id}`}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${accent.solid}`}
          >
            Open {tool.shortName || tool.name} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            to={tool.route}
            data-testid={`preview-tool-${tool.id}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
          >
            <Eye className="h-4 w-4" /> Coming Soon · Preview
          </Link>
        )}
      </div>
    </article>
  );
}

function ToolGrid({ tools, pinnedIds, onTogglePin, pinBusy }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          pinned={pinnedIds.includes(tool.id)}
          onTogglePin={onTogglePin}
          pinBusy={pinBusy}
        />
      ))}
    </div>
  );
}

/**
 * Tools Hub (`/tools`) — registry-driven catalog with instant search, category tabs,
 * Guest Friendly / Pinned Only filters, pin/unpin, and a separate Upcoming Tools Roadmap.
 */
export function ToolsHubPage() {
  const { isAuthenticated } = useAuth();
  const { pinnedIds, togglePin, isSaving, maxPins, error: pinError } = usePinnedTools();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [guestOnly, setGuestOnly] = useState(searchParams.get('guest') === '1');
  const [pinnedOnly, setPinnedOnly] = useState(searchParams.get('pinned') === '1');
  const [notice, setNotice] = useState('');

  // Keep URL in sync so filtered views are shareable (e.g. `/tools?pinned=1`)
  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query.trim());
    if (category !== 'all') next.set('category', category);
    if (guestOnly) next.set('guest', '1');
    if (pinnedOnly) next.set('pinned', '1');
    setSearchParams(next, { replace: true });
  }, [query, category, guestOnly, pinnedOnly, setSearchParams]);

  // React to external navigation like the sidebar "Manage Pins" link or mega-menu "+N more"
  useEffect(() => {
    setCategory(searchParams.get('category') || 'all');
    setPinnedOnly(searchParams.get('pinned') === '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('category'), searchParams.get('pinned')]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const categoryTabs = useMemo(
    () =>
      getToolsByCategory(TOOLS_REGISTRY).map(({ category: meta, tools }) => ({
        ...meta,
        count: tools.length,
      })),
    []
  );

  const results = useMemo(
    () => searchTools(query, { category, guestOnly, pinnedOnly, pinnedIds }),
    [query, category, guestOnly, pinnedOnly, pinnedIds]
  );

  const availableTools = results.filter(isToolLaunchable);
  const upcomingTools = results.filter((tool) => !isToolLaunchable(tool));
  const hasActiveFilters = Boolean(query.trim()) || category !== 'all' || guestOnly || pinnedOnly;

  const handleTogglePin = async (toolId) => {
    const outcome = await togglePin(toolId);
    if (outcome?.reason === 'limit') {
      setNotice(`You can pin up to ${maxPins} tools. Unpin one to make room.`);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setGuestOnly(false);
    setPinnedOnly(false);
  };

  return (
    <div className="space-y-6" data-testid="tools-hub-page">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <LayoutGrid className="h-4 w-4" /> Tools Hub
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Every SmartTools workflow in one place
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {TOOLS_REGISTRY.filter(isToolLaunchable).length} tools available now ·{' '}
              {TOOLS_REGISTRY.filter((t) => !isToolLaunchable(t)).length} on the roadmap · Pin up to {maxPins}{' '}
              favourites{isAuthenticated ? ' to your sidebar' : ' (saved in this browser)'}.
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tools by name, feature or tag…"
                data-testid="tools-hub-search"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={openCommandSwitcher}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                title="Open quick switcher"
              >
                <ShortcutHint />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Tip: press <span className="font-semibold">Ctrl/⌘ + K</span> anywhere to jump between tools.
            </p>
          </div>
        </div>

        {/* Category tabs + filter pills */}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tool categories" data-testid="tools-hub-category-tabs">
            <FilterPill active={category === 'all'} onClick={() => setCategory('all')} testId="category-tab-all">
              All <span className="opacity-70">{TOOLS_REGISTRY.length}</span>
            </FilterPill>
            {categoryTabs.map((tab) => (
              <FilterPill
                key={tab.id}
                active={category === tab.id}
                onClick={() => setCategory(tab.id)}
                testId={`category-tab-${tab.id}`}
              >
                <ToolIcon name={tab.iconName} className="h-3.5 w-3.5" />
                {tab.label} <span className="opacity-70">{tab.count}</span>
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={guestOnly} onClick={() => setGuestOnly((v) => !v)} testId="filter-guest-friendly">
              <UserCheck className="h-3.5 w-3.5" /> Guest Friendly
            </FilterPill>
            <FilterPill active={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)} testId="filter-pinned-only">
              <Pin className="h-3.5 w-3.5" /> Pinned Only
            </FilterPill>
          </div>
        </div>
      </section>

      {(notice || pinError) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>{notice || pinError}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Search className="mx-auto h-6 w-6 text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-800">No tools match these filters</h2>
          <p className="mt-1 text-sm text-slate-500">
            {pinnedOnly ? 'You have no pinned tools in this view yet — star a tool to pin it.' : 'Try a different keyword or category.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear filters
            </button>
          )}
        </section>
      ) : category === 'all' ? (
        <>
          {availableTools.length > 0 && (
            <section data-testid="tools-hub-available-section" className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Available Tools</h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {availableTools.length}
                </span>
              </div>
              <ToolGrid tools={availableTools} pinnedIds={pinnedIds} onTogglePin={handleTogglePin} pinBusy={isSaving} />
            </section>
          )}
          {upcomingTools.length > 0 && (
            <section data-testid="tools-hub-roadmap-section" className="space-y-3">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Upcoming Tools Roadmap</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {upcomingTools.length}
                </span>
              </div>
              <ToolGrid tools={upcomingTools} pinnedIds={pinnedIds} onTogglePin={handleTogglePin} pinBusy={isSaving} />
            </section>
          )}
        </>
      ) : (
        <section data-testid="tools-hub-category-section" className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">{getCategoryMeta(category).label}</h2>
          <ToolGrid
            tools={[...availableTools, ...upcomingTools]}
            pinnedIds={pinnedIds}
            onTogglePin={handleTogglePin}
            pinBusy={isSaving}
          />
        </section>
      )}
    </div>
  );
}

export default ToolsHubPage;
