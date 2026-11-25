import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { updatePasswordApi } from '../../../services/auth.api.js';
import { useAuth } from '../../../app/AuthContext.jsx';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

export function SecurityTab() {
  const { logout, showToast } = useAuth();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values) => {
    setErrorMsg('');
    setSavedNotice(false);
    try {
      await updatePasswordApi({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      setSavedNotice(true);
      showToast('Password changed successfully.', 'success');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Unable to update password.'
      );
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6" data-testid="profile-security-tab">
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-indigo-600">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Account Security</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Password & Session</h2>
        <p className="text-sm text-slate-500">
          Update your password or sign out of your active SmartTools session.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {errorMsg}
          </div>
        )}

        {savedNotice && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Password updated successfully.
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Current Password
          </label>
          <input
            type="password"
            data-testid="security-current-password"
            {...register('currentPassword')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.currentPassword && (
            <p className="mt-1 text-xs text-rose-600">{errors.currentPassword.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            New Password
          </label>
          <input
            type="password"
            data-testid="security-new-password"
            {...register('newPassword')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.newPassword && (
            <p className="mt-1 text-xs text-rose-600">{errors.newPassword.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Confirm New Password
          </label>
          <input
            type="password"
            data-testid="security-confirm-password"
            {...register('confirmPassword')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-rose-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="update-password-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="h-4 w-4" />
          )}
          Update Password
        </button>
      </form>

      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
        <h3 className="text-sm font-bold text-rose-900">Sign Out of SmartTools</h3>
        <p className="mt-1 text-xs text-rose-700">
          Revokes your refresh session cookie on this browser and returns you to Guest Mode.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          data-testid="security-signout-btn"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" /> Sign Out Now
        </button>
      </div>
    </div>
  );
}

export default SecurityTab;
