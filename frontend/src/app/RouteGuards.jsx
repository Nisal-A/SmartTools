import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { GuestShellLayout } from '../layouts/GuestShellLayout.jsx';
import { AppShellLayout } from '../layouts/AppShellLayout.jsx';

function AuthLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Loading SmartTools workspace…
    </div>
  );
}

/**
 * Dual Guest / Authenticated Route Shell Wrapper
 *
 * Allows unauthenticated guests to open tools immediately inside `GuestShellLayout`,
 * while signed-in users automatically get `AppShellLayout`.
 */
export function PublicOrAuthRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <AppShellLayout>{children}</AppShellLayout>;
  }

  return <GuestShellLayout>{children}</GuestShellLayout>;
}

/**
 * Authenticated-only Route Wrapper (`AppShellLayout`).
 * Redirects unauthenticated visitors to `/tools`.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthLoadingShell />;
  if (!isAuthenticated) return <Navigate to="/tools" replace />;

  return <AppShellLayout>{children}</AppShellLayout>;
}

/**
 * Administrator-only Route Wrapper (`AppShellLayout`).
 * Redirects non-admins to `/dashboard` (or `/tools` if guest).
 */
export function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <AuthLoadingShell />;
  if (!isAuthenticated) return <Navigate to="/tools" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <AppShellLayout>{children}</AppShellLayout>;
}

export default PublicOrAuthRoute;
