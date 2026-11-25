import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, FileText, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState('');

  const returnTo =
    searchParams.get('returnTo') || location.state?.from || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!loading && isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setServerError(
        err.response?.data?.message || err.message || 'Invalid email or password.'
      );
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10"
      data-testid="login-page"
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-extrabold tracking-tight text-slate-900"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-xl">SmartTools</span>
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            Sign in to your workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Access your saved invoices, quotations, business profile, and customers.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          {serverError ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
            >
              {serverError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  data-testid="login-email-input"
                  {...register('email')}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  data-testid="login-password-input"
                  {...register('password')}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="login-submit-btn"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Don't have an account yet?{' '}
            <Link
              to={`/register${returnTo !== '/dashboard' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Create a free account
            </Link>
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center">
          <p className="text-xs font-medium text-slate-600">
            Just need a quick PDF? No account required.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/tools/invoice-generator"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <FileText className="h-3.5 w-3.5" /> Free Invoice Generator
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              to="/tools"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Explore All Tools
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
