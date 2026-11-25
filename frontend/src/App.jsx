import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { AuthProvider, useAuth } from './app/AuthContext.jsx';
import { AuthModal } from './components/auth/AuthModal.jsx';
import { AppRouter } from './app/Router.jsx';

function GlobalToast() {
  const { toast, clearToast } = useAuth();
  if (!toast) return null;

  const toneClasses =
    toast.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : toast.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-indigo-200 bg-indigo-50 text-indigo-800';

  const Icon =
    toast.tone === 'error'
      ? AlertTriangle
      : toast.tone === 'success'
        ? CheckCircle2
        : Info;

  return (
    <div
      role="status"
      data-testid="global-toast"
      className={`no-print fixed right-5 top-16 z-[80] flex max-w-md items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${toneClasses}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={clearToast}
        aria-label="Dismiss notification"
        className="rounded-md p-0.5 opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <AuthModal />
      <GlobalToast />
    </AuthProvider>
  );
}

export default App;
