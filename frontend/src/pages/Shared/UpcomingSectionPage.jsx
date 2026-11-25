import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Construction } from 'lucide-react';
import { ToolIcon } from '../../components/navigation/toolVisuals.jsx';

/**
 * Temporary placeholder for authenticated sections whose full pages ship in
 * later platform tasks (Dashboard, Document History, Profile, Customers, Admin).
 * Keeps sidebar links functional instead of redirecting unexpectedly.
 */
export function UpcomingSectionPage({ title, description, iconName = 'Layers' }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" data-testid="upcoming-section-page">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <ToolIcon name={iconName} className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Construction className="h-4 w-4 text-slate-400" />
        This section's interface is being built. The backend API is already live.
      </div>
      <Link to="/tools" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
        Go to Tools Hub <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default UpcomingSectionPage;
