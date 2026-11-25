import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  SESSION_EXPIRED_EVENT,
  clearAuthStorage,
  getStoredAccessToken,
  hasSessionHint,
  setSessionHint,
  setStoredAccessToken,
} from '../services/apiClient.js';
import {
  getMeApi,
  loginApi,
  logoutApi,
  refreshApi,
  registerApi,
} from '../services/auth.api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [authModalState, setAuthModalState] = useState({
    isOpen: false,
    initialMode: 'register',
    title: '',
    subtitle: '',
    onSuccess: null,
  });

  const showToast = useCallback((message, tone = 'info') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /**
   * Restores or refreshes the authenticated user silently.
   * Pure guests (no stored token and no session hint flag) skip network calls
   * completely so no 401 errors ever flash in the console.
   */
  const refreshUser = useCallback(async ({ force = false } = {}) => {
    const token = getStoredAccessToken();
    const shouldTrySilentRefresh = hasSessionHint();

    if (!token && !shouldTrySilentRefresh && !force) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      if (token) {
        const currentUser = await getMeApi();
        setUser(currentUser);
        setSessionHint(Boolean(currentUser));
        return currentUser;
      }

      // Silent HttpOnly cookie refresh when session flag exists
      const refreshed = await refreshApi();
      if (refreshed.accessToken) {
        setStoredAccessToken(refreshed.accessToken);
      }
      setUser(refreshed.user || null);
      setSessionHint(Boolean(refreshed.user));
      return refreshed.user || null;
    } catch {
      clearAuthStorage();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Listen for refresh-token failure events dispatched by apiClient
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { accessToken, user: authedUser } = await loginApi({ email, password });
    if (accessToken) {
      setStoredAccessToken(accessToken);
    }
    setSessionHint(true);
    setUser(authedUser || null);
    return authedUser;
  }, []);

  const register = useCallback(async ({ fullName, email, password, businessName }) => {
    const { accessToken, user: authedUser } = await registerApi({
      fullName,
      email,
      password,
      businessName,
    });
    if (accessToken) {
      setStoredAccessToken(accessToken);
    }
    setSessionHint(true);
    setUser(authedUser || null);
    return authedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore network errors during logout
    }
    clearAuthStorage();
    setUser(null);
  }, []);

  /** Shallow-merges fields into the signed-in user (e.g. optimistic `pinnedToolIds` or `fullName`). */
  const updateUser = useCallback((patch = {}) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const openAuthModal = useCallback((options = {}) => {
    const callback =
      typeof options.onSuccessCallback === 'function'
        ? options.onSuccessCallback
        : typeof options.onSuccess === 'function'
          ? options.onSuccess
          : null;

    setAuthModalState({
      isOpen: true,
      initialMode: options.mode || 'register',
      title: options.title || 'Save your work to SmartTools Cloud',
      subtitle:
        options.subtitle ||
        'Sign in or create a free account to sync drafts, track payments, and manage customers.',
      onSuccess: callback,
    });
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalState((prev) => ({
      ...prev,
      isOpen: false,
      onSuccess: null,
    }));
  }, []);

  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean(user && user.role === 'admin');
  const isGuest = !isAuthenticated;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isGuest,
        loading,
        isLoading: loading,
        login,
        register,
        logout,
        refreshUser,
        refreshMe: refreshUser,
        updateUser,
        authModalState,
        openAuthModal,
        closeAuthModal,
        toast,
        showToast,
        clearToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

export default AuthContext;
