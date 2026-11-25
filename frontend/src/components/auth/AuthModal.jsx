import React, { useEffect, useState } from 'react';
import { CloudUpload, Loader2, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';

/**
 * Reusable Login / Register Auth Modal (`frontend/src/components/auth/AuthModal.jsx`)
 *
 * Works both:
 * 1. Globally via `useAuth().openAuthModal({ mode, title, subtitle, onSuccessCallback })`
 * 2. Directly as a controlled component (`<AuthModal isOpen onClose onSuccessCallback />`)
 *
 * When a Guest clicks "Save to Cloud" inside the Invoice or Quotation Generator,
 * this modal authenticates them in-place and immediately invokes `onSuccessCallback`
 * so their draft migrates to MongoDB without losing page state.
 */
export function AuthModal({
  isOpen: controlledOpen,
  initialMode: controlledMode,
  title: controlledTitle,
  subtitle: controlledSubtitle,
  onClose: controlledClose,
  onSuccessCallback: controlledOnSuccess,
} = {}) {
  const { authModalState, closeAuthModal, login, register } = useAuth();

  const isControlled = typeof controlledOpen === 'boolean';
  const isOpen = isControlled ? controlledOpen : authModalState.isOpen;
  const resolvedInitialMode = isControlled
    ? controlledMode || 'register'
    : authModalState.initialMode || 'register';
  const heading = isControlled
    ? controlledTitle || 'Save your work to SmartTools Cloud'
    : authModalState.title;
  const subheading = isControlled
    ? controlledSubtitle ||
      'Sign in or create a free account to sync drafts, track payments, and manage customers.'
    : authModalState.subtitle;

  const [mode, setMode] = useState(resolvedInitialMode);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(resolvedInitialMode);
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [isOpen, resolvedInitialMode]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isControlled && typeof controlledClose === 'function') {
      controlledClose();
    } else {
      closeAuthModal();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const authedUser =
        mode === 'login'
          ? await login({ email: email.trim(), password })
          : await register({
              fullName: fullName.trim(),
              businessName: businessName.trim(),
              email: email.trim(),
              password,
            });

      const pendingCallback = isControlled
        ? controlledOnSuccess
        : authModalState.onSuccess;

      handleClose();

      if (typeof pendingCallback === 'function') {
        await pendingCallback(authedUser);
      }
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message ||
          err.message ||
          'Authentication failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
      data-testid="auth-modal"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <CloudUpload className="h-5 w-5" />
            </div>
            <div>
              <h2 id="auth-modal-heading" className="text-base font-bold text-slate-900">
                {heading}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{subheading}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close authentication modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              mode === 'register'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              mode === 'login'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 p-5">
          {errorMsg ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              {errorMsg}
            </div>
          ) : null}

          {mode === 'register' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Business Name (Optional)
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Morgan Studio LLC"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Password *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : mode === 'login' ? (
              'Sign In & Continue'
            ) : (
              'Create Free Account & Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
