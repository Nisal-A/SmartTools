import React from 'react';
import { useAuth } from './AuthContext.jsx';
import { GuestShellLayout } from '../layouts/GuestShellLayout.jsx';
import { AppShellLayout } from '../layouts/AppShellLayout.jsx';

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

export default PublicOrAuthRoute;
