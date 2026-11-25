import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCog,
  Users,
} from 'lucide-react';
import { getMyProfilesApi } from '../../services/profiles.api.js';
import { PersonalTab } from './tabs/PersonalTab.jsx';
import { BusinessTab } from './tabs/BusinessTab.jsx';
import { DocumentDefaultsTab } from './tabs/DocumentDefaultsTab.jsx';
import { CustomersTab } from './tabs/CustomersTab.jsx';
import { SecurityTab } from './tabs/SecurityTab.jsx';

const TABS = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'business', label: 'Business Profile', icon: Building2 },
  { id: 'defaults', label: 'Document Defaults', icon: SlidersHorizontal },
  { id: 'customers', label: 'Customers Directory', icon: Users },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

export function ProfileManagementPage({ defaultTab = 'personal' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const activeTab = TABS.some((t) => t.id === queryTab) ? queryTab : defaultTab;

  const [personalProfile, setPersonalProfile] = useState(null);
  const [businessProfile, setBusinessProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const data = await getMyProfilesApi();
        if (!cancelled) {
          setPersonalProfile(data.personalProfile || null);
          setBusinessProfile(data.businessProfile || null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err.response?.data?.message || 'Unable to load your profile settings.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectTab = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <div className="space-y-6" data-testid="profile-management-page">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
          <UserCog className="h-4 w-4" /> Workspace Settings
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          Profile Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure your personal details, reusable business branding, default paper sizes, shared customers, and account security.
        </p>
      </section>

      {loadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Section Tabs */}
        <aside className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                data-testid={`profile-tab-btn-${tab.id}`}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </aside>

        {/* Active Tab Content */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {isLoading && activeTab !== 'customers' && activeTab !== 'security' ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading profile…
            </div>
          ) : (
            <>
              {activeTab === 'personal' && (
                <PersonalTab
                  personalProfile={personalProfile}
                  onUpdated={(updated) => setPersonalProfile(updated)}
                />
              )}
              {activeTab === 'business' && (
                <BusinessTab
                  businessProfile={businessProfile}
                  onUpdated={(updated) => setBusinessProfile(updated)}
                />
              )}
              {activeTab === 'defaults' && (
                <DocumentDefaultsTab
                  businessProfile={businessProfile}
                  onUpdated={(updated) => setBusinessProfile(updated)}
                />
              )}
              {activeTab === 'customers' && <CustomersTab />}
              {activeTab === 'security' && <SecurityTab />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default ProfileManagementPage;
