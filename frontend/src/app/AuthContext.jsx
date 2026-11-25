import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiClient,
  getStoredAccessToken,
  setStoredAccessToken,
} from '../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalState, setAuthModalState] = useState({
    isOpen: false,
    initialMode: 'register',
    title: '',
    subtitle: '',
    onSuccess: null,
  });

  const refreshMe = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const res = await apiClient.get('/auth/me');
      const currentUser = res.data?.data || res.data?.user || null;
      setUser(currentUser);
      return currentUser;
    } catch {
      setStoredAccessToken('');
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = useCallback(async ({ email, password }) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const token = res.data?.accessToken || res.data?.data?.accessToken;
    const authedUser = res.data?.user || res.data?.data?.user;
    if (token) setStoredAccessToken(token);
    setUser(authedUser || null);
    return authedUser;
  }, []);

  const register = useCallback(async ({ fullName, email, password, businessName }) => {
    const res = await apiClient.post('/auth/register', {
      fullName,
      email,
      password,
      businessName,
    });
    const token = res.data?.accessToken || res.data?.data?.accessToken;
    const authedUser = res.data?.user || res.data?.data?.user;
    if (token) setStoredAccessToken(token);
    setUser(authedUser || null);
    return authedUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors during logout
    }
    setStoredAccessToken('');
    setUser(null);
  }, []);

  const openAuthModal = useCallback((options = {}) => {
    setAuthModalState({
      isOpen: true,
      initialMode: options.mode || 'register',
      title: options.title || 'Save your work to SmartTools Cloud',
      subtitle:
        options.subtitle ||
        'Sign in or create a free account to sync drafts, track payments, and manage customers.',
      onSuccess: typeof options.onSuccess === 'function' ? options.onSuccess : null,
    });
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalState((prev) => ({
      ...prev,
      isOpen: false,
      onSuccess: null,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        register,
        logout,
        refreshMe,
        authModalState,
        openAuthModal,
        closeAuthModal,
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
