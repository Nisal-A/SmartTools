import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2, Save, User } from 'lucide-react';
import { updatePersonalProfileApi } from '../../../services/profiles.api.js';
import { useAuth } from '../../../app/AuthContext.jsx';

const personalSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  jobTitle: z.string().trim().max(80).optional().or(z.literal('')),
  timezone: z.string().trim().min(1, 'Please choose a timezone'),
});

const TIMEZONES = [
  'UTC',
  'Asia/Colombo',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
];

export function PersonalTab({ personalProfile, onUpdated }) {
  const { user, updateUser, showToast } = useAuth();
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      fullName: personalProfile?.fullName || user?.fullName || '',
      phone: personalProfile?.phone || '',
      jobTitle: personalProfile?.jobTitle || '',
      timezone: personalProfile?.timezone || 'UTC',
    },
  });

  useEffect(() => {
    reset({
      fullName: personalProfile?.fullName || user?.fullName || '',
      phone: personalProfile?.phone || '',
      jobTitle: personalProfile?.jobTitle || '',
      timezone: personalProfile?.timezone || 'UTC',
    });
  }, [personalProfile, user?.fullName, reset]);

  const onSubmit = async (values) => {
    setErrorMsg('');
    setSavedNotice(false);
    try {
      const updated = await updatePersonalProfileApi(values);
      updateUser({ fullName: updated.fullName });
      onUpdated?.(updated);
      setSavedNotice(true);
      showToast('Personal profile saved.', 'success');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Unable to save personal details.'
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      data-testid="profile-personal-tab"
    >
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-indigo-600">
          <User className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Personal Account</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Personal Information</h2>
        <p className="text-sm text-slate-500">
          Your personal identity and regional preferences across SmartTools.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Personal information updated successfully.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Full Name *
          </label>
          <input
            type="text"
            data-testid="personal-fullname-input"
            {...register('fullName')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-rose-600">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Email Address (Read-only)
          </label>
          <input
            type="email"
            readOnly
            disabled
            value={personalProfile?.email || user?.email || ''}
            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="+1 (555) 123-4567"
            data-testid="personal-phone-input"
            {...register('phone')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Job Title / Role
          </label>
          <input
            type="text"
            placeholder="Founder, Finance Manager…"
            {...register('jobTitle')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Timezone
          </label>
          <select
            data-testid="personal-timezone-select"
            {...register('timezone')}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="save-personal-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Personal Details
        </button>
      </div>
    </form>
  );
}

export default PersonalTab;
