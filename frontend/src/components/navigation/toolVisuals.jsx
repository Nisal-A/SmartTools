import React from 'react';
import {
  Bot,
  Briefcase,
  Calculator,
  Clock,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Package,
  PenLine,
  QrCode,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { TOOL_STATUS_META } from '../../config/toolsRegistry.js';

/**
 * Shared visual primitives for registry-driven navigation.
 *
 * Icons are resolved by `iconName` from a curated map (keeps the bundle tree-shaken).
 * Unknown names fall back to a neutral icon so a new registry entry never breaks the UI.
 * Accent classes are spelled out in full so Tailwind's JIT keeps them in the build.
 */

const ICON_MAP = {
  Bot,
  Briefcase,
  Calculator,
  Clock,
  FileSpreadsheet,
  FileText,
  Globe,
  History,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Package,
  PenLine,
  QrCode,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  Wrench,
};

export function resolveIcon(iconName) {
  return ICON_MAP[iconName] || Layers;
}

export function ToolIcon({ name, className = 'h-4 w-4', ...rest }) {
  const Icon = resolveIcon(name);
  return <Icon className={className} aria-hidden="true" {...rest} />;
}

const ACCENT_STYLES = {
  indigo: {
    iconWrap: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100',
    solid: 'bg-indigo-600 text-white hover:bg-indigo-700',
    text: 'text-indigo-600',
    hoverBorder: 'hover:border-indigo-300',
    dot: 'bg-indigo-500',
  },
  emerald: {
    iconWrap: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
    solid: 'bg-emerald-600 text-white hover:bg-emerald-700',
    text: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-300',
    dot: 'bg-emerald-500',
  },
  amber: {
    iconWrap: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
    solid: 'bg-amber-600 text-white hover:bg-amber-700',
    text: 'text-amber-600',
    hoverBorder: 'hover:border-amber-300',
    dot: 'bg-amber-500',
  },
  rose: {
    iconWrap: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
    solid: 'bg-rose-600 text-white hover:bg-rose-700',
    text: 'text-rose-600',
    hoverBorder: 'hover:border-rose-300',
    dot: 'bg-rose-500',
  },
  sky: {
    iconWrap: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100',
    solid: 'bg-sky-600 text-white hover:bg-sky-700',
    text: 'text-sky-600',
    hoverBorder: 'hover:border-sky-300',
    dot: 'bg-sky-500',
  },
  violet: {
    iconWrap: 'bg-violet-50 text-violet-600 ring-1 ring-violet-100',
    solid: 'bg-violet-600 text-white hover:bg-violet-700',
    text: 'text-violet-600',
    hoverBorder: 'hover:border-violet-300',
    dot: 'bg-violet-500',
  },
  slate: {
    iconWrap: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    solid: 'bg-slate-800 text-white hover:bg-slate-900',
    text: 'text-slate-600',
    hoverBorder: 'hover:border-slate-300',
    dot: 'bg-slate-500',
  },
};

export function getAccentStyles(accentColor) {
  return ACCENT_STYLES[accentColor] || ACCENT_STYLES.slate;
}

const STATUS_PILL_CLASSES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  beta: 'bg-amber-50 text-amber-700 ring-amber-200',
  coming_soon: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function ToolStatusPill({ status, className = '' }) {
  const meta = TOOL_STATUS_META[status] || TOOL_STATUS_META.active;
  const tone = STATUS_PILL_CLASSES[status] || STATUS_PILL_CLASSES.active;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${tone} ${className}`}
    >
      {meta.label}
    </span>
  );
}

export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
}

export function ShortcutHint({ className = '' }) {
  const mod = isMacPlatform() ? '⌘' : 'Ctrl';
  return (
    <kbd
      className={`inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 shadow-sm ${className}`}
    >
      {mod} K
    </kbd>
  );
}
