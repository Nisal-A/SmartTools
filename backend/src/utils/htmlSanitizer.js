import { isAllowedPdfRequest } from '../config/puppeteerPool.js';

/**
 * Strict HTML Escaping & Attribute Sanitization Utility for Puppeteer PDF Templates.
 * Prevents XSS, HTML injection, and SSRF via unescaped user fields.
 */

const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
});

const HTML_ESCAPE_REGEX = /[&<>"'`]/g;

/**
 * Escapes any dynamic value for safe interpolation into HTML text nodes or attributes.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Escapes HTML and converts newline characters into `<br />` tags for multiline blocks.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtmlMultiline(value) {
  if (value === null || value === undefined) return '';
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

/**
 * Validates and sanitizes an image URL for use in `<img src="...">`.
 * Only permits `data:image/*` base64 strings or whitelisted Cloudinary/asset hosts.
 *
 * @param {unknown} url
 * @returns {string} Safe escaped URL or empty string if disallowed
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!isAllowedPdfRequest(trimmed, 'image')) {
    return '';
  }
  return escapeHtml(trimmed);
}

/**
 * Formats a single-line or structured address object into an HTML-escaped string.
 *
 * @param {string|object|null|undefined} address
 * @returns {string}
 */
export function formatEscapedAddress(address) {
  if (!address) return '';
  if (typeof address === 'string') {
    return escapeHtmlMultiline(address.trim());
  }
  if (typeof address === 'object') {
    const line1 = address.street ? escapeHtml(address.street.trim()) : '';
    const cityStatePostal = [address.city, address.state, address.postalCode]
      .map((part) => (part ? String(part).trim() : ''))
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');
    const country = address.country ? escapeHtml(address.country.trim()) : '';

    return [line1, cityStatePostal, country].filter(Boolean).join('<br />');
  }
  return '';
}

/**
 * Formats a numeric currency amount safely with currency code/symbol.
 *
 * @param {number|string} amount
 * @param {string} [currency='USD']
 * @returns {string}
 */
export function formatCurrencyHtml(amount, currency = 'USD') {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const safeCurrency = String(currency || 'USD').trim().toUpperCase();

  try {
    return escapeHtml(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safeNum)
    );
  } catch {
    return escapeHtml(`${safeCurrency} ${safeNum.toFixed(2)}`);
  }
}

/**
 * Formats a date string or Date instance into a clean YYYY-MM-DD or readable date string.
 *
 * @param {string|Date|null|undefined} dateValue
 * @returns {string}
 */
export function formatDateHtml(dateValue) {
  if (!dateValue) return '—';
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return escapeHtml(dateValue.toISOString().slice(0, 10));
  }
  const str = String(dateValue).trim();
  if (!str) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return escapeHtml(str.slice(0, 10));
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return escapeHtml(parsed.toISOString().slice(0, 10));
  }
  return escapeHtml(str);
}
