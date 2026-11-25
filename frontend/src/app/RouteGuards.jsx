import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';
import { GuestShellLayout } from '../layouts/GuestShellLayout.jsx';
import { AppShellLayout } from '../layouts/AppShellLayout.jsx';

function AuthLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-sm font-medium text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
      Loading SmartTools workspace…
    </div>
  );
}

/**
 * Dual Guest / Authenticated Route Shell Wrapper (`PublicOrAuthRoute`)
 *
 * Wraps `/`, `/tools`, `/tools/invoice-generator`, `/tools/quotation-generator` —
 * renders `AppShellLayout` if logged in or `GuestShellLayout` if Guest with zero redirects.
 */
export function PublicOrAuthRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <AppShellLayout>{children}</AppShellLayout>;
  }

  return <GuestShellLayout>{children}</GuestShellLayout>;
}

/**
 * Authenticated-only Route Guard (`ProtectedRoute`)
 *
 * Wraps `/dashboard`, `/history`, `/profile`, `/customers` — redirects
 * unauthenticated visitors to `/login` with the encoded return URL.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingShell />;
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        state={{ from: returnTo }}
        replace
      />
    );
  }

  return <AppShellLayout>{children}</AppShellLayout>;
}

function UnauthorizedAdminRedirect() {
  const { showToast } = useAuth();

  useEffect(() => {
    showToast(
      'Unauthorized: Administrator privileges are required to access the Admin Console.',
      'error'
    );
  }, [showToast]);

  return <Navigate to="/dashboard" replace />;
}

/**
 * Administrator-only Route Guard (`AdminRoute`)
 *
 * Wraps `/admin/*` — redirects unauthenticated users to `/login` and
 * redirects non-admins to `/dashboard` with an unauthorized toast notification.
 */
export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingShell />;
  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        state={{ from: returnTo }}
        replace
      />
    );
  }
  if (!isAdmin) {
    return <UnauthorizedAdminRedirect />;
  }

  return <AppShellLayout>{children}</AppShellLayout>;
}

export default PublicOrAuthRoute;
