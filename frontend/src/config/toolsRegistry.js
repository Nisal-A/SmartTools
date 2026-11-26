/**
 * SmartTools — Single Source of Truth Tools Registry
 *
 * Every navigation surface (Tools Hub, Category filters, Tools Mega-Menu,
 * Ctrl+K Command Switcher, Sidebar Pinned Tools, Quick-Create menu, Breadcrumbs)
 * is rendered from this file. UI components never hardcode tool lists.
 *
 * ADDING A NEW TOOL:
 *   1. Append one entry to `RAW_TOOLS` below.
 *   2. Register its lazy page component in `TOOL_PAGE_COMPONENTS` (app/Router.jsx).
 *   Nothing else changes. Until step 2 is done (or while `status: 'coming_soon'`),
 *   the tool route safely renders a "Coming Soon" preview instead of a broken page.
 */

export const TOOL_STATUS = Object.freeze({
  ACTIVE: 'active',
  BETA: 'beta',
  COMING_SOON: 'coming_soon',
});

export const TOOL_STATUS_META = Object.freeze({
  active: { label: 'Active', tone: 'emerald' },
  beta: { label: 'Beta', tone: 'amber' },
  coming_soon: { label: 'Coming Soon', tone: 'slate' },
});

export const MAX_PINNED_TOOLS = 5;

/**
 * Tool categories (ordered). Keys are referenced by `tool.category`.
 */
export const TOOL_CATEGORIES = Object.freeze({
  finance: {
    id: 'finance',
    label: 'Finance & Billing',
    description: 'Invoices, quotations, receipts and money workflows.',
    iconName: 'Wallet',
    order: 1,
  },
  marketing: {
    id: 'marketing',
    label: 'Marketing & SEO',
    description: 'Technical SEO audits, on-page scoring, and site health checks.',
    iconName: 'Globe',
    order: 2,
  },
  documents: {
    id: 'documents',
    label: 'Business Documents',
    description: 'Professional documents and paperwork for your business.',
    iconName: 'FileText',
    order: 3,
  },
  ai: {
    id: 'ai',
    label: 'AI Productivity',
    description: 'AI-assisted writing and automation tools.',
    iconName: 'Sparkles',
    order: 4,
  },
  utilities: {
    id: 'utilities',
    label: 'Utilities',
    description: 'Handy calculators and everyday helpers.',
    iconName: 'Wrench',
    order: 5,
  },
});

export const TOOL_CATEGORY_LIST = Object.freeze(
  Object.values(TOOL_CATEGORIES).sort((a, b) => a.order - b.order)
);

const RAW_TOOLS = [
  {
    id: 'invoice-generator',
    name: 'Invoice Generator',
    shortName: 'Invoices',
    tagline: 'Tax-ready invoices in every paper size',
    description:
      'Create professional invoices in A4, A5, Letter, Legal, B5 or 80mm thermal receipt format with payment tracking and PDF export.',
    route: '/tools/invoice-generator',
    iconName: 'FileText',
    category: 'finance',
    tags: ['invoice', 'billing', 'payments', 'pdf', 'thermal', 'receipt', 'a4', 'a5'],
    supportsGuestMode: true,
    status: 'active',
    featured: true,
    defaultPinned: true,
    accentColor: 'indigo',
    quickCreateLabel: 'New Invoice',
    highlights: ['A4 / A5 / Letter / Legal / B5', '80mm Thermal receipts', 'Partial payment tracking'],
  },
  {
    id: 'quotation-generator',
    name: 'Quotation Generator',
    shortName: 'Quotations',
    tagline: 'Winning quotes that convert to invoices',
    description:
      'Generate commercial quotations with validity presets, client acceptance blocks, multi-size PDFs and 1-click conversion to invoices.',
    route: '/tools/quotation-generator',
    iconName: 'FileSpreadsheet',
    category: 'finance',
    tags: ['quotation', 'quote', 'estimate', 'proposal', 'pdf', 'convert'],
    supportsGuestMode: true,
    status: 'active',
    featured: true,
    defaultPinned: true,
    accentColor: 'emerald',
    quickCreateLabel: 'New Quotation',
    highlights: ['Validity presets', 'Client acceptance block', '1-click Convert to Invoice'],
  },
  {
    id: 'seo-analyzer',
    name: 'SEO Analyzer',
    shortName: 'SEO Audit',
    tagline: '18-point technical & on-page SEO auditor',
    description:
      'Safely audit any public web page with SSRF-hardened fetching, 100-point transparent scoring, interactive charts, and CSV export.',
    route: '/tools/seo-analyzer',
    iconName: 'Globe',
    category: 'marketing',
    tags: ['seo', 'audit', 'marketing', 'meta', 'headings', 'technical', 'sitemap', 'robots'],
    supportsGuestMode: true,
    status: 'active',
    featured: true,
    defaultPinned: true,
    accentColor: 'sky',
    quickCreateLabel: 'New SEO Audit',
    highlights: ['18 rule-based checks (100 pts)', 'SSRF-hardened fetcher', 'Interactive charts & CSV export'],
  },
  {
    id: 'receipt-generator',
    name: 'Receipt Generator',
    shortName: 'Receipts',
    tagline: 'Instant payment receipts',
    description:
      'Issue branded payment receipts for cash, card and bank transfers, linked to invoices.',
    route: '/tools/receipt-generator',
    iconName: 'Receipt',
    category: 'finance',
    tags: ['receipt', 'payment', 'pos', 'thermal', 'a5', 'cash', 'card'],
    supportsGuestMode: true,
    status: 'active',
    featured: true,
    defaultPinned: false,
    accentColor: 'amber',
    quickCreateLabel: 'New Receipt',
    highlights: ['Linked to saved invoices', 'Thermal (80mm) & A5 formats', 'Instant print & PDF export'],
  },
  {
    id: 'expense-tracker',
    name: 'Expense Tracker',
    shortName: 'Expenses',
    tagline: 'Track spending and receipts',
    description:
      'Log business expenses, attach receipts and see monthly spending summaries per category.',
    route: '/tools/expense-tracker',
    iconName: 'Wallet',
    category: 'finance',
    tags: ['expense', 'spending', 'budget', 'accounting'],
    supportsGuestMode: false,
    status: 'coming_soon',
    featured: false,
    defaultPinned: false,
    accentColor: 'rose',
    highlights: ['Category budgets', 'Receipt attachments'],
  },
  {
    id: 'purchase-order-generator',
    name: 'Purchase Order Generator',
    shortName: 'Purchase Orders',
    tagline: 'Structured POs for your suppliers',
    description:
      'Create purchase orders for suppliers with delivery schedules, approval blocks and PDF export.',
    route: '/tools/purchase-order-generator',
    iconName: 'Package',
    category: 'documents',
    tags: ['purchase order', 'po', 'supplier', 'procurement'],
    supportsGuestMode: true,
    status: 'active',
    featured: true,
    defaultPinned: false,
    accentColor: 'sky',
    quickCreateLabel: 'New Purchase Order',
    highlights: ['Supplier directory & guest mode', 'Delivery schedule & SKU items', 'Approval signatures & A4 PDF'],
  },
  {
    id: 'ai-proposal-writer',
    name: 'AI Proposal Writer',
    shortName: 'AI Proposals',
    tagline: 'Draft client proposals with AI',
    description:
      'Turn a short brief into a polished, structured client proposal and hand it off to the Quotation Generator.',
    route: '/tools/ai-proposal-writer',
    iconName: 'Bot',
    category: 'ai',
    tags: ['ai', 'proposal', 'writing', 'gpt', 'assistant'],
    supportsGuestMode: false,
    status: 'coming_soon',
    featured: false,
    defaultPinned: false,
    accentColor: 'violet',
    highlights: ['Brief-to-proposal', 'Quotation handoff'],
  },
  {
    id: 'tax-calculator',
    name: 'Tax & VAT Calculator',
    shortName: 'Tax Calc',
    tagline: 'Inclusive / exclusive tax in seconds',
    description:
      'Quickly compute inclusive and exclusive tax, VAT and GST amounts with currency-safe rounding.',
    route: '/tools/tax-calculator',
    iconName: 'Calculator',
    category: 'utilities',
    tags: ['tax', 'vat', 'gst', 'calculator'],
    supportsGuestMode: true,
    status: 'coming_soon',
    featured: false,
    defaultPinned: false,
    accentColor: 'slate',
    highlights: ['Inclusive / exclusive modes', 'Currency-safe rounding'],
  },
];

export const TOOLS_REGISTRY = Object.freeze(RAW_TOOLS.map((tool) => Object.freeze({ ...tool })));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isToolLaunchable(tool) {
  return Boolean(tool) && tool.status !== TOOL_STATUS.COMING_SOON;
}

/** Tools that can be opened today (`active` + `beta`). */
export function getActiveTools(tools = TOOLS_REGISTRY) {
  return tools.filter(isToolLaunchable);
}

export function getComingSoonTools(tools = TOOLS_REGISTRY) {
  return tools.filter((tool) => tool.status === TOOL_STATUS.COMING_SOON);
}

export function getToolById(toolId) {
  return TOOLS_REGISTRY.find((tool) => tool.id === toolId) || null;
}

export function getCategoryMeta(categoryId) {
  return (
    TOOL_CATEGORIES[categoryId] || {
      id: categoryId || 'other',
      label: 'Other Tools',
      description: '',
      iconName: 'Layers',
      order: 99,
    }
  );
}

/**
 * Groups tools by category in `TOOL_CATEGORIES` order. Empty groups are omitted;
 * tools with an unknown category fall into an "Other Tools" group at the end.
 *
 * @returns {Array<{ category: object, tools: object[] }>}
 */
export function getToolsByCategory(tools = TOOLS_REGISTRY) {
  const groups = new Map();
  for (const tool of tools) {
    const meta = getCategoryMeta(tool.category);
    if (!groups.has(meta.id)) groups.set(meta.id, { category: meta, tools: [] });
    groups.get(meta.id).tools.push(tool);
  }
  return Array.from(groups.values()).sort((a, b) => a.category.order - b.category.order);
}

/**
 * Real-time tool search across name, shortName, tagline, description, tags and category label.
 *
 * @param {string} query
 * @param {{
 *   category?: string,            // 'all' | category id
 *   guestOnly?: boolean,          // only `supportsGuestMode`
 *   pinnedOnly?: boolean,
 *   pinnedIds?: string[],
 *   includeComingSoon?: boolean,  // default true
 *   status?: string,              // exact status filter
 * }} [filters]
 */
export function searchTools(query = '', filters = {}) {
  const {
    category = 'all',
    guestOnly = false,
    pinnedOnly = false,
    pinnedIds = [],
    includeComingSoon = true,
    status,
  } = filters;

  const terms = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const pinnedSet = new Set(pinnedIds);

  return TOOLS_REGISTRY.filter((tool) => {
    if (category && category !== 'all' && tool.category !== category) return false;
    if (guestOnly && !tool.supportsGuestMode) return false;
    if (pinnedOnly && !pinnedSet.has(tool.id)) return false;
    if (!includeComingSoon && tool.status === TOOL_STATUS.COMING_SOON) return false;
    if (status && tool.status !== status) return false;

    if (terms.length === 0) return true;

    const haystack = [
      tool.name,
      tool.shortName,
      tool.tagline,
      tool.description,
      getCategoryMeta(tool.category).label,
      ...(tool.tags || []),
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * Resolves the tool owning a pathname (longest route-prefix match), e.g.
 * `/tools/invoice-generator/65ab...` -> Invoice Generator.
 */
export function getToolByRoute(pathname = '') {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  let match = null;
  for (const tool of TOOLS_REGISTRY) {
    if (path === tool.route || path.startsWith(`${tool.route}/`)) {
      if (!match || tool.route.length > match.route.length) match = tool;
    }
  }
  return match;
}

export function getDefaultPinnedToolIds() {
  return getActiveTools()
    .filter((tool) => tool.defaultPinned)
    .map((tool) => tool.id)
    .slice(0, MAX_PINNED_TOOLS);
}

/** Keeps only known, launchable, unique tool IDs (max 5). */
export function sanitizePinnedToolIds(ids) {
  if (!Array.isArray(ids)) return getDefaultPinnedToolIds();
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    const tool = getToolById(id);
    if (tool && isToolLaunchable(tool) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result.slice(0, MAX_PINNED_TOOLS);
}

export function getQuickCreateTools() {
  return getActiveTools().filter((tool) => Boolean(tool.quickCreateLabel));
}

export default TOOLS_REGISTRY;
