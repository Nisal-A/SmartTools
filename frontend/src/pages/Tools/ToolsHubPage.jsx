import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import { TOOLS_REGISTRY } from '../../config/toolsRegistry.js';

export function ToolsHubPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
          <Sparkles className="h-4 w-4" />
          SmartTools Platform Hub
        </div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          Independent Document Generators — Guest-Ready &amp; Cloud-Synced
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Launch either tool immediately without creating an account, preview across physical
          paper standards, export server-rendered PDFs, or sign in to sync profiles and history.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TOOLS_REGISTRY.map((tool) => {
          const isInvoice = tool.id === 'invoice-generator';
          return (
            <Link
              key={tool.id}
              to={tool.route}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      isInvoice
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {isInvoice ? (
                      <FileText className="h-6 w-6" />
                    ) : (
                      <FileSpreadsheet className="h-6 w-6" />
                    )}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {tool.badge}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-indigo-700">
                  {tool.name}
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">{tool.description}</p>
              </div>

              <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                <span>Open {tool.name}</span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default ToolsHubPage;
