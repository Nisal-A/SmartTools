import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Lock, LogIn, RefreshCw, Search, SearchX, UserPlus } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import HistoryTable from '../../components/seo/history/HistoryTable.jsx';
import Pagination from '../../components/seo/history/Pagination.jsx';
import SearchBar from '../../components/seo/history/SearchBar.jsx';
import Alert from '../../components/seo/ui/Alert.jsx';
import Button from '../../components/seo/ui/Button.jsx';
import Card from '../../components/seo/ui/Card.jsx';
import EmptyState from '../../components/seo/ui/EmptyState.jsx';
import Spinner from '../../components/seo/ui/Spinner.jsx';
import useAuditHistory from './hooks/useAuditHistory.js';

export default function AuditHistoryPage() {
  const { isAuthenticated, openAuthModal } = useAuth();

  const {
    audits,
    meta,
    page,
    setPage,
    search,
    setSearch,
    loading,
    error,
    refetch,
    removeAudit,
  } = useAuditHistory({
    initialPage: 1,
    limit: 10,
    enabled: isAuthenticated,
  });

  const handleSearchChange = useCallback(
    (nextQuery) => {
      setPage(1);
      setSearch(nextQuery);
    },
    [setPage, setSearch]
  );

  // Guests cannot browse saved history; prompt inline sign-in via SmartTools AuthModal
  if (!isAuthenticated) {
    return (
      <div className="space-y-6" data-testid="seo-history-guest-gate">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My SEO Audits
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Sign in to save, search, and revisit your personal SEO audit reports across sessions.
            </p>
          </div>
          <Link
            to="/tools/seo-analyzer/analyze"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Analyze a URL</span>
          </Link>
        </div>

        <Card>
          <EmptyState
            icon={Lock}
            title="Sign in to access your personal SEO audit history"
            description="Guest audits open immediately after analysis and contribute to anonymized global metrics on Overview, while personal audit history is privately scoped to signed-in SmartTools accounts."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal({
                      mode: 'login',
                      title: 'Sign in to view your SEO audits',
                      subtitle:
                        'Your personal SEO audit history is private and synced to your SmartTools Cloud account.',
                    })
                  }
                  data-testid="seo-history-signin-btn"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogIn className="h-4 w-4" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openAuthModal({
                      mode: 'register',
                      title: 'Create a free SmartTools account',
                      subtitle:
                        'Save every SEO audit, Invoice, and Quotation privately under one unified history.',
                    })
                  }
                  data-testid="seo-history-register-btn"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  <UserPlus className="h-4 w-4" /> Create Free Account
                </button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const hasSearchQuery = search.trim().length > 0;

  return (
    <div className="space-y-6" data-testid="seo-history-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My SEO Audits
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Search, revisit, or delete SEO audits saved privately to your SmartTools account.
          </p>
        </div>

        <Link
          to="/tools/seo-analyzer/analyze"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>New Audit</span>
        </Link>
      </div>

      <Card>
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <SearchBar value={search} onChange={handleSearchChange} />

          <Button variant="ghost" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" label="Loading audit history…" />
            <span className="ml-2 text-sm text-slate-600">Loading audit history…</span>
          </div>
        ) : error ? (
          <Alert
            variant="error"
            title="Could not load audit history"
            action={
              <Button variant="outline" size="sm" onClick={refetch}>
                Retry
              </Button>
            }
          >
            {error.message}
          </Alert>
        ) : audits.length === 0 ? (
          hasSearchQuery ? (
            <EmptyState
              icon={SearchX}
              title="No matching audits found"
              description={`No saved audits matched "${search.trim()}". Try a different domain or clear your search filter.`}
              action={
                <Button variant="outline" size="sm" onClick={() => handleSearchChange('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Clock}
              title="No saved audits yet"
              description="Run your first SEO audit to start building a searchable history of page reports."
              action={
                <Link
                  to="/tools/seo-analyzer/analyze"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  <span>Analyze a Website</span>
                </Link>
              }
            />
          )
        ) : (
          <div className="space-y-6">
            <HistoryTable audits={audits} onDelete={removeAudit} />
            <Pagination
              page={meta.page ?? page}
              totalPages={meta.totalPages ?? 0}
              total={meta.total ?? audits.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
