import { CLIENT_ID_STORAGE_KEY } from './constants.js';

const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const generateFallbackUuid = () => {
  const randomPart = () => Math.random().toString(36).slice(2, 10);
  return `client_${Date.now().toString(36)}_${randomPart()}_${randomPart()}`;
};

/**
 * Generates and persists a per-browser anonymous client ID in localStorage
 * for `X-Client-Id` history scoping (ADR-015 Option B).
 */
export const getOrCreateClientId = () => {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing && CLIENT_ID_PATTERN.test(existing)) {
      return existing;
    }

    const created =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : generateFallbackUuid();

    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return 'anonymous-browser';
  }
};

/**
 * Maps a numeric 0–100 score to its display band and semantic status styling (Master Plan §8, ADR-016).
 */
export const getScoreBand = (score) => {
  const numeric = Number(score);
  if (Number.isNaN(numeric)) {
    return {
      label: 'Not scored',
      variant: 'not_tested',
      colorHex: '#64748b',
      textClass: 'text-slate-700',
      bgClass: 'bg-slate-100',
      borderClass: 'border-slate-300',
    };
  }

  const rounded = Math.min(100, Math.max(0, Math.round(numeric)));

  if (rounded >= 90) {
    return {
      label: 'Excellent',
      variant: 'passed',
      colorHex: '#15803d',
      textClass: 'text-green-700',
      bgClass: 'bg-green-50',
      borderClass: 'border-green-200',
    };
  }

  if (rounded >= 75) {
    return {
      label: 'Good',
      variant: 'passed',
      colorHex: '#16a34a',
      textClass: 'text-green-700',
      bgClass: 'bg-green-50',
      borderClass: 'border-green-200',
    };
  }

  if (rounded >= 50) {
    return {
      label: 'Needs work',
      variant: 'warning',
      colorHex: '#d97706',
      textClass: 'text-amber-700',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
    };
  }

  return {
    label: 'Poor',
    variant: 'failed',
    colorHex: '#dc2626',
    textClass: 'text-red-700',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
  };
};

export const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const truncateUrl = (rawUrl, maxLength = 56) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (rawUrl.length <= maxLength) return rawUrl;
  return `${rawUrl.slice(0, maxLength - 1)}…`;
};

export const truncateText = (text, maxLength = 90) => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
};
