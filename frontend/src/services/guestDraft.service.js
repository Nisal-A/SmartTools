/**
 * Guest Draft Persistence Service (Browser `localStorage`)
 *
 * Manages namespaced local drafts for unauthenticated users:
 * - Invoice drafts:   `smarttools_guest_invoice_draft`
 * - Quotation drafts: `smarttools_guest_quote_draft`
 *
 * Provides debounced auto-save, load, clear, and client-side Quotation -> Invoice handoff.
 */

export const GUEST_DRAFT_KEYS = Object.freeze({
  invoice: 'smarttools_guest_invoice_draft',
  quotation: 'smarttools_guest_quote_draft',
});

const pendingTimers = new Map();

function isStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probeKey = '__smarttools_storage_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the namespaced `localStorage` key for a tool type.
 *
 * @param {'invoice'|'quotation'} toolType
 * @returns {string}
 */
export function getDraftKey(toolType) {
  const normalized = String(toolType || 'invoice').trim().toLowerCase();
  if (normalized === 'quotation' || normalized === 'quote') {
    return GUEST_DRAFT_KEYS.quotation;
  }
  return GUEST_DRAFT_KEYS.invoice;
}

/**
 * Immediately saves a draft payload to `localStorage`.
 *
 * @param {'invoice'|'quotation'} toolType
 * @param {object} draftData
 * @returns {{ saved: boolean, updatedAt: string | null }}
 */
export function saveDraft(toolType, draftData) {
  if (!isStorageAvailable() || !draftData || typeof draftData !== 'object') {
    return { saved: false, updatedAt: null };
  }

  try {
    const key = getDraftKey(toolType);
    const updatedAt = new Date().toISOString();
    const envelope = {
      version: 1,
      toolType: key === GUEST_DRAFT_KEYS.quotation ? 'quotation' : 'invoice',
      updatedAt,
      data: draftData,
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return { saved: true, updatedAt };
  } catch {
    return { saved: false, updatedAt: null };
  }
}

/**
 * Creates a standalone debounced auto-save function for React forms.
 *
 * @param {'invoice'|'quotation'} toolType
 * @param {number} [delayMs=450]
 * @param {(result: { saved: boolean, updatedAt: string | null }) => void} [onSaved]
 */
export function createDebouncedAutoSave(toolType, delayMs = 450, onSaved) {
  let timerId = null;
  let lastPayload = null;

  function debounced(draftData) {
    lastPayload = draftData;
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      const result = saveDraft(toolType, lastPayload);
      if (typeof onSaved === 'function') {
        onSaved(result);
      }
    }, delayMs);
  }

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  debounced.flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
      if (lastPayload) {
        const result = saveDraft(toolType, lastPayload);
        if (typeof onSaved === 'function') {
          onSaved(result);
        }
        return result;
      }
    }
    return { saved: false, updatedAt: null };
  };

  return debounced;
}

/**
 * Shared debounced auto-save helper keyed per toolType.
 *
 * @param {'invoice'|'quotation'} toolType
 * @param {object} draftData
 * @param {number} [delayMs=450]
 * @param {(result: { saved: boolean, updatedAt: string | null }) => void} [onSaved]
 */
export function autoSaveDraft(toolType, draftData, delayMs = 450, onSaved) {
  const key = getDraftKey(toolType);
  if (pendingTimers.has(key)) {
    clearTimeout(pendingTimers.get(key));
  }

  const timerId = setTimeout(() => {
    pendingTimers.delete(key);
    const result = saveDraft(toolType, draftData);
    if (typeof onSaved === 'function') {
      onSaved(result);
    }
  }, delayMs);

  pendingTimers.set(key, timerId);
}

/**
 * Loads a saved guest draft from `localStorage`.
 *
 * @param {'invoice'|'quotation'} toolType
 * @returns {{ data: object, updatedAt: string | null } | null}
 */
export function loadDraft(toolType) {
  if (!isStorageAvailable()) return null;

  try {
    const key = getDraftKey(toolType);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    // Support both enveloped `{ version, updatedAt, data }` and legacy flat drafts
    if (parsed.data && typeof parsed.data === 'object') {
      return {
        data: parsed.data,
        updatedAt: parsed.updatedAt || null,
      };
    }

    return {
      data: parsed,
      updatedAt: null,
    };
  } catch {
    return null;
  }
}

/**
 * Clears any pending auto-save and removes the guest draft from `localStorage`.
 *
 * @param {'invoice'|'quotation'} toolType
 */
export function clearDraft(toolType) {
  const key = getDraftKey(toolType);
  if (pendingTimers.has(key)) {
    clearTimeout(pendingTimers.get(key));
    pendingTimers.delete(key);
  }

  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns true if a non-empty guest draft exists for the given tool.
 *
 * @param {'invoice'|'quotation'} toolType
 * @returns {boolean}
 */
export function hasDraft(toolType) {
  return loadDraft(toolType) !== null;
}

/**
 * Guest-mode Quotation-to-Invoice client-side handoff.
 * Transforms a quotation payload into a fresh Invoice draft and stores it under
 * `smarttools_guest_invoice_draft` so navigating to `/tools/invoice-generator`
 * hydrates it automatically without requiring an account.
 *
 * @param {object} quoteData
 * @returns {object} Prepared invoice draft payload
 */
export function handoffQuoteToInvoiceDraft(quoteData = {}) {
  const today = new Date();
  const dueDateObj = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const year = today.getFullYear();

  const clonedItems = Array.isArray(quoteData.items)
    ? quoteData.items.map((item, idx) => ({
        sortOrder: idx,
        name: item.name || '',
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'pcs',
        unitPrice: Number(item.unitPrice) || 0,
        discountType: item.discountType || 'percentage',
        discountValue: Number(item.discountValue) || 0,
        taxRate: Number(item.taxRate) || 0,
      }))
    : [
        {
          sortOrder: 0,
          name: '',
          description: '',
          quantity: 1,
          unit: 'pcs',
          unitPrice: 0,
          discountType: 'percentage',
          discountValue: 0,
          taxRate: 0,
        },
      ];

  const invoiceDraft = {
    invoiceNumber: `INV-${year}-DRAFT`,
    issueDate: today.toISOString().slice(0, 10),
    dueDate: dueDateObj.toISOString().slice(0, 10),
    currency: quoteData.currency || 'USD',
    status: 'draft',
    paymentTerms: quoteData.paymentTerms || '',
    businessSnapshot: quoteData.businessSnapshot
      ? JSON.parse(JSON.stringify(quoteData.businessSnapshot))
      : { businessName: '' },
    customerSnapshot: quoteData.customerSnapshot
      ? JSON.parse(JSON.stringify(quoteData.customerSnapshot))
      : { name: '' },
    bankDetails: quoteData.bankDetails
      ? JSON.parse(JSON.stringify(quoteData.bankDetails))
      : quoteData.businessSnapshot?.bankDetails
        ? JSON.parse(JSON.stringify(quoteData.businessSnapshot.bankDetails))
        : {},
    items: clonedItems,
    globalDiscountType:
      quoteData.globalDiscountType || quoteData.discount?.type || 'percentage',
    globalDiscountValue:
      Number(quoteData.globalDiscountValue ?? quoteData.discount?.value ?? 0) || 0,
    shippingOrAdjustment: Number(quoteData.shippingOrAdjustment) || 0,
    amountPaid: 0,
    notes: quoteData.notes || '',
    pageSize: quoteData.pageSize || 'A4',
    orientation: quoteData.orientation || 'portrait',
    templateKey: quoteData.templateKey || 'indigo',
    sourceQuotationRef: quoteData.quotationNumber || '',
  };

  saveDraft('invoice', invoiceDraft);
  return invoiceDraft;
}

export default {
  GUEST_DRAFT_KEYS,
  getDraftKey,
  saveDraft,
  createDebouncedAutoSave,
  autoSaveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  handoffQuoteToInvoiceDraft,
};
