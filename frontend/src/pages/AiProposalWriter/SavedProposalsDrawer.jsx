import React, { useMemo, useState } from 'react';
import {
  FileText,
  History,
  Loader2,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const STATUS_BADGE_CLASSES = {
  Draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  Sent: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Handed Off': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function SavedProposalsDrawer({
  isOpen,
  proposals = [],
  loading = false,
  activeProposalId = null,
  onClose,
  onLoadProposal,
  onDeleteProposal,
}) {
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter((p) =>
      [p.proposalNumber, p.projectTitle, p.clientName, p.clientCompany, p.status]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [proposals, query]);

  if (!isOpen) return null;

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDeleteProposal(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Saved Proposals"
      data-testid="saved-proposals-drawer"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Saved Proposals</h2>
              <p className="text-xs text-slate-500">
                {proposals.length} saved {proposals.length === 1 ? 'draft' : 'drafts'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved proposals drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, client, PRP-#…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
              Loading proposals…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center">
              <FileText className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-700">No saved proposals found</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Generate a proposal and click Save Proposal to keep it here.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const badgeCls =
                STATUS_BADGE_CLASSES[item.status] || STATUS_BADGE_CLASSES.Draft;
              const isSelected = activeProposalId && item._id === activeProposalId;
              return (
                <div
                  key={item._id}
                  data-testid={`saved-proposal-card-${item._id}`}
                  className={`rounded-2xl border p-4 transition ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-violet-700">
                          {item.proposalNumber}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${badgeCls}`}
                        >
                          {item.status || 'Draft'}
                        </span>
                      </div>
                      <h3 className="mt-1 truncate text-sm font-bold text-slate-900">
                        {item.projectTitle}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.clientName}
                        {item.clientCompany ? ` · ${item.clientCompany}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadProposal(item);
                        onClose();
                      }}
                      data-testid={`load-proposal-${item._id}`}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                    >
                      Load &amp; Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id)}
                      disabled={deletingId === item._id}
                      aria-label={`Delete ${item.projectTitle}`}
                      data-testid={`delete-proposal-${item._id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {deletingId === item._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default SavedProposalsDrawer;
