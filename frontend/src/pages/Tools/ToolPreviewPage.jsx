import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, SearchX } from 'lucide-react';
import { getCategoryMeta, getToolByRoute, isToolLaunchable } from '../../config/toolsRegistry.js';
import { ToolIcon, ToolStatusPill, getAccentStyles } from '../../components/navigation/toolVisuals.jsx';

/**
 * Fallback for `/tools/:toolSlug` routes without a registered page component.
 *
 * - `coming_soon` tools render a clean "Coming Soon" preview (never a broken route).
 * - Launchable tools whose lazy page isn't registered yet show a setup notice.
 * - Unknown slugs show a friendly not-found card.
 */
export function ToolPreviewPage() {
  const { toolSlug } = useParams();
  const tool = getToolByRoute(`/tools/${toolSlug}`);

  if (!tool) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="tool-not-found">
        <SearchX className="mx-auto h-8 w-8 text-slate-300" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">Tool not found</h1>
        <p className="mt-1 text-sm text-slate-500">We couldn't find a tool at this address.</p>
        <Link to="/tools" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          <ArrowLeft className="h-4 w-4" /> Back to Tools Hub
        </Link>
      </div>
    );
  }

  const accent = getAccentStyles(tool.accentColor);
  const launchable = isToolLaunchable(tool);

  return (
    <div className="mx-auto max-w-2xl" data-testid="tool-preview-page" data-tool-id={tool.id}>
      <Link to="/tools" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Tools Hub
      </Link>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${accent.iconWrap}`}>
            <ToolIcon name={tool.iconName} className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {getCategoryMeta(tool.category).label}
              </span>
              <ToolStatusPill status={tool.status} />
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{tool.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
          </div>
        </div>

        {Array.isArray(tool.highlights) && tool.highlights.length > 0 && (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {tool.highlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 className={`h-4 w-4 ${accent.text}`} /> {highlight}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600" data-testid="coming-soon-badge">
          <Clock className="h-4 w-4 text-slate-400" />
          {launchable
            ? 'This tool is registered and is being wired into the workspace. Check back shortly.'
            : 'Coming Soon — this tool is on the SmartTools roadmap.'}
        </div>
      </div>
    </div>
  );
}

export default ToolPreviewPage;
