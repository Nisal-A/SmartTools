import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  SESSION_EXPIRED_EVENT,
  clearAuthStorage,
  getStoredAccessToken,
  hasSessionHint,
  setSessionHint,
  setStoredAccessToken,
  setStoredRefreshToken,
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
  // Prevents stale initial-mount refresh calls from overwriting a newer login/register/logout
  const authEpochRef = useRef(0);
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
    const startEpoch = authEpochRef.current;
    const token = getStoredAccessToken();
    const shouldTrySilentRefresh = hasSessionHint();

    if (!token && !shouldTrySilentRefresh && !force) {
      if (authEpochRef.current === startEpoch) {
        setUser(null);
        setLoading(false);
      }
      return null;
    }

    try {
      if (token) {
        const currentUser = await getMeApi();
        if (authEpochRef.current === startEpoch) {
          setUser(currentUser);
          setSessionHint(Boolean(currentUser));
        }
        return currentUser;
      }

      // Silent HttpOnly cookie (+ cross-site fallback token) refresh via single-flight mutex
      const refreshed = await refreshApi();
      if (authEpochRef.current === startEpoch) {
        if (refreshed.accessToken) {
          setStoredAccessToken(refreshed.accessToken);
        }
        if (refreshed.refreshToken) {
          setStoredRefreshToken(refreshed.refreshToken);
        }
        setUser(refreshed.user || null);
        setSessionHint(Boolean(refreshed.user));
      }
      return refreshed.user || null;
    } catch (err) {
      if (authEpochRef.current !== startEpoch) {
        return null;
      }
      const status = err?.response?.status;
      // Only wipe stored session on definitive auth/account rejection (401/403/404),
      // not on transient Render cold-start / network timeouts
      if (status === 401 || status === 403 || status === 404) {
        clearAuthStorage();
        setUser(null);
      }
      return null;
    } finally {
      if (authEpochRef.current === startEpoch) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Listen for refresh-token failure events & cross-tab localStorage auth changes
  useEffect(() => {
    const handleSessionExpired = () => {
      authEpochRef.current += 1;
      setUser(null);
      setLoading(false);
    };

    const handleStorageSync = (event) => {
      if (event.key === 'smarttools_access_token') {
        if (!event.newValue) {
          authEpochRef.current += 1;
          setUser(null);
          setLoading(false);
        } else {
          refreshUser({ force: true });
        }
      }
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [refreshUser]);

  const login = useCallback(async ({ email, password }) => {
    authEpochRef.current += 1;
    const { accessToken, refreshToken, user: authedUser } = await loginApi({
      email,
      password,
    });
    if (accessToken) {
      setStoredAccessToken(accessToken);
    }
    if (refreshToken) {
      setStoredRefreshToken(refreshToken);
    }
    setSessionHint(true);
    setUser(authedUser || null);
    setLoading(false);
    return authedUser;
  }, []);

  const register = useCallback(async ({ fullName, email, password, businessName }) => {
    authEpochRef.current += 1;
    const { accessToken, refreshToken, user: authedUser } = await registerApi({
      fullName,
      email,
      password,
      businessName,
    });
    if (accessToken) {
      setStoredAccessToken(accessToken);
    }
    if (refreshToken) {
      setStoredRefreshToken(refreshToken);
    }
    setSessionHint(true);
    setUser(authedUser || null);
    setLoading(false);
    return authedUser;
  }, []);

  const logout = useCallback(async () => {
    authEpochRef.current += 1;
    try {
      await logoutApi();
    } catch {
      // Ignore network errors during logout
    }
    clearAuthStorage();
    setUser(null);
    setLoading(false);
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
