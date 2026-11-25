// Single source of truth for API error codes (PROJECT_MASTER_PLAN.md §5).
// Messages are safe to show to end users: no internals, IPs or stack details.
const ERROR_CODES = Object.freeze({
  INVALID_URL: { status: 400, message: 'Please enter a valid http or https URL.' },
  BLOCKED_URL: { status: 400, message: 'This address cannot be analyzed.' },
  DNS_FAILED: { status: 502, message: 'The website address could not be resolved.' },
  TARGET_UNREACHABLE: { status: 502, message: 'The website could not be reached.' },
  TARGET_TIMEOUT: { status: 504, message: 'The website took too long to respond.' },
  TARGET_HTTP_ERROR: { status: 422, message: 'The website responded with an error status.' },
  NOT_HTML: { status: 422, message: 'The address did not return an HTML page.' },
  RESPONSE_TOO_LARGE: { status: 422, message: 'The page is too large to analyze.' },
  TOO_MANY_REDIRECTS: { status: 422, message: 'The page redirected too many times.' },
  VALIDATION_ERROR: { status: 400, message: 'The request is invalid.' },
  FORBIDDEN: { status: 403, message: 'Access to audit history is restricted.' },
  NOT_FOUND: { status: 404, message: 'The requested resource was not found.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Please try again later.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong. Please try again later.' },
});

export default ERROR_CODES;

