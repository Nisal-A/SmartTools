import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function Pagination({ page = 1, totalPages = 0, total = 0, onPageChange }) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-600">
        <span>
          Showing <strong>{total}</strong> {total === 1 ? 'audit' : 'audits'}
        </span>
        <span>Page 1 of {Math.max(1, totalPages)}</span>
      </div>
    );
  }

  return (
    <nav
      aria-label="Audit history pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"
    >
      <p className="text-xs text-slate-600">
        Page <strong className="text-slate-900">{page}</strong> of{' '}
        <strong className="text-slate-900">{totalPages}</strong> ·{' '}
        <strong className="text-slate-900">{total}</strong> total {total === 1 ? 'audit' : 'audits'}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>Previous</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
