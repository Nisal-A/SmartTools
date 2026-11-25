import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Building2,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  User,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required'),
    businessName: z.string().trim().optional(),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function RegisterPage() {
  const { register: registerUser, isAuthenticated, loading } = useAuth();
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
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      businessName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (!loading && isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await registerUser({
        fullName: values.fullName.trim(),
        businessName: values.businessName?.trim() || '',
        email: values.email.trim(),
        password: values.password,
      });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setServerError(
        err.response?.data?.message ||
          err.message ||
          'Registration failed. Please try again.'
      );
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10"
      data-testid="register-page"
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
            Create your free account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            One account unlocks cloud history, reusable business profiles, and shared customers.
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
                Full Name *
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Alex Morgan"
                  data-testid="register-fullname-input"
                  {...register('fullName')}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {errors.fullName && (
                <p className="mt-1 text-xs text-rose-600">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Business Name (Optional)
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Morgan Studio LLC"
                  data-testid="register-business-input"
                  {...register('businessName')}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  data-testid="register-email-input"
                  {...register('email')}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min 6 chars"
                    data-testid="register-password-input"
                    {...register('password')}
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Confirm *
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    data-testid="register-confirm-input"
                    {...register('confirmPassword')}
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="register-submit-btn"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <Link
              to={`/login${returnTo !== '/dashboard' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
