import AppError from '../utils/AppError.js';

const DEFAULT_CLIENT_ID = 'anonymous-public';
const CLIENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Extracts and validates the `X-Client-Id` header for anonymous per-browser scoping
 * (ADR-015 Option B). Falls back to `"anonymous-public"` when omitted so Postman works directly.
 */
export const clientIdentity = (req, res, next) => {
  const rawHeader = req.get('x-client-id');

  if (rawHeader === undefined || rawHeader.trim() === '') {
    req.clientId = DEFAULT_CLIENT_ID;
    next();
    return;
  }

  const trimmed = rawHeader.trim();
  if (!CLIENT_ID_REGEX.test(trimmed)) {
    next(new AppError('VALIDATION_ERROR', 'Invalid X-Client-Id header format.'));
    return;
  }

  req.clientId = trimmed;
  next();
};

export default clientIdentity;
