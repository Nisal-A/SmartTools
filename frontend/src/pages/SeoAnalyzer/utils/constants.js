// Single source of truth for client constants, error-code message mappings,
// and category metadata (PROJECT_MASTER_PLAN.md §5, §7, §8).

export const CLIENT_ID_STORAGE_KEY = 'seocheck_client_id';

export const ERROR_MESSAGES = Object.freeze({
  INVALID_URL: 'Please enter a valid public URL starting with http:// or https://.',
  BLOCKED_URL:
    'This address cannot be analyzed. SEOCheck only audits public internet websites on standard HTTP/HTTPS ports.',
  DNS_FAILED: 'We could not resolve that domain name. Please check the spelling and try again.',
  TARGET_UNREACHABLE:
    'The website could not be reached. It may be offline or refusing automated connections.',
  TARGET_TIMEOUT: 'The website took too long to respond (over the 10-second limit). Please try again later.',
  TARGET_HTTP_ERROR: 'The website responded with an HTTP error status instead of an analyzable page.',
  NOT_HTML:
    'That URL did not return an HTML document (for example, it may be a JSON endpoint, PDF, or image).',
  RESPONSE_TOO_LARGE: 'The web page exceeds the 2 MB size cap for a single-page SEO audit.',
  TOO_MANY_REDIRECTS:
    'The URL redirected more than 5 times. Please submit the final destination URL directly.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  FORBIDDEN: 'Access to audit history is restricted.',
  NOT_FOUND: 'The requested audit report could not be found.',
  RATE_LIMITED: 'Too many requests. Please wait a few minutes before starting another audit.',
  INTERNAL_ERROR: 'Something went wrong on the server. Please try again shortly.',
  NETWORK_ERROR: 'Unable to reach the SEOCheck API. Please confirm the backend server is running.',
});

export const getFriendlyErrorMessage = (error) => {
  if (!error) return ERROR_MESSAGES.INTERNAL_ERROR;
  if (typeof error === 'string') return error;
  if (error.code && Object.hasOwn(ERROR_MESSAGES, error.code)) {
    return ERROR_MESSAGES[error.code];
  }
  return error.message || ERROR_MESSAGES.INTERNAL_ERROR;
};

export const STATUS_CONFIG = Object.freeze({
  passed: {
    label: 'Passed',
    badgeVariant: 'passed',
  },
  warning: {
    label: 'Warning',
    badgeVariant: 'warning',
  },
  failed: {
    label: 'Failed',
    badgeVariant: 'failed',
  },
  not_tested: {
    label: 'Not tested',
    badgeVariant: 'not_tested',
  },
});

export const AUDIT_CATEGORIES = Object.freeze([
  {
    key: 'title',
    label: 'Title Tag',
    weight: 15,
    summary: 'Checks that a non-empty <title> exists and measures 30–60 characters.',
  },
  {
    key: 'meta',
    label: 'Meta Description',
    weight: 15,
    summary: 'Verifies a <meta name="description"> exists and falls within 70–160 characters.',
  },
  {
    key: 'headings',
    label: 'Heading Structure',
    weight: 15,
    summary: 'Evaluates H1 presence, single primary H1 usage, and sequential H1–H6 nesting.',
  },
  {
    key: 'images',
    label: 'Image Accessibility',
    weight: 15,
    summary: 'Measures descriptive ALT attribute coverage while separating decorative alt="" tags.',
  },
  {
    key: 'links',
    label: 'Link Health',
    weight: 10,
    summary: 'Checks for internal navigation links and flags empty, "#"-only, or javascript: hrefs.',
  },
  {
    key: 'technical',
    label: 'Technical Foundations',
    weight: 30,
    summary:
      'Inspects HTTPS, redirects, canonical URL, viewport, HTML lang, meta robots, robots.txt, and XML sitemap.',
  },
]);
