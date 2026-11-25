import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const DEFAULT_JWT_ACCESS_SECRET = 'smarttools-dev-jwt-access-secret-2026';
const DEFAULT_JWT_REFRESH_SECRET = 'smarttools-dev-jwt-refresh-secret-2026';

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getJwtSecret() {
  return (
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    DEFAULT_JWT_ACCESS_SECRET
  );
}

export function getJwtRefreshSecret() {
  return (
    process.env.JWT_REFRESH_SECRET ||
    `${getJwtSecret()}_refresh` ||
    DEFAULT_JWT_REFRESH_SECRET
  );
}

/**
 * Signs a short-lived JWT access token (15m default) for a user.
 *
 * @param {{ id?: string, _id?: string, email?: string, role?: 'user'|'admin' }} user
 * @returns {string}
 */
export function signAccessToken(user) {
  const userId = String(user.id || user._id);
  const role = user.role === 'admin' ? 'admin' : 'user';
  return jwt.sign(
    {
      sub: userId,
      id: userId,
      email: user.email || '',
      role,
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    }
  );
}

/**
 * Signs a 7-day JWT refresh token with a unique `jti` placed first in the payload.
 *
 * @param {{ id?: string, _id?: string, email?: string, role?: 'user'|'admin' }} user
 * @returns {string}
 */
export function signRefreshToken(user) {
  const userId = String(user.id || user._id);
  const role = user.role === 'admin' ? 'admin' : 'user';
  return jwt.sign(
    {
      jti: crypto.randomUUID(),
      sub: userId,
      id: userId,
      email: user.email || '',
      role,
      type: 'refresh',
    },
    getJwtRefreshSecret(),
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    }
  );
}

/**
 * Verifies a refresh token signature and expiration.
 *
 * @param {string} token
 * @returns {object}
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, getJwtRefreshSecret());
}

/**
 * Attaches the 7-day HttpOnly Secure SameSite refresh token cookie to the response.
 */
export function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

/**
 * Clears the HttpOnly refresh token cookie on logout.
 */
export function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Internal helper to extract Bearer token from request headers.
 */
function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

/**
 * Looks up the User document if the `User` model is registered, verifying `isActive`.
 */
async function resolveActiveUserFromTokenPayload(decoded) {
  const userId = String(decoded.id || decoded.sub || decoded.userId || '');
  if (!userId) return { error: 'Invalid token payload.', status: 401 };

  const UserModel = mongoose.models.User;
  if (UserModel && mongoose.Types.ObjectId.isValid(userId)) {
    const dbUser = await UserModel.findById(userId).lean();
    if (dbUser) {
      if (dbUser.isActive === false) {
        return {
          error: 'User account has been deactivated.',
          status: 403,
        };
      }
      return {
        user: {
          id: String(dbUser._id),
          email: dbUser.email,
          role: dbUser.role === 'admin' ? 'admin' : 'user',
        },
      };
    }
  }

  return {
    user: {
      id: userId,
      email: decoded.email || '',
      role: decoded.role === 'admin' ? 'admin' : 'user',
    },
  };
}

/**
 * `requireAuth`: Verifies access token, confirms user is active, and attaches
 * `req.user = { id, email, role }`.
 */
export async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid Bearer token.',
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const resolved = await resolveActiveUserFromTokenPayload(decoded);

    if (resolved.error) {
      return res.status(resolved.status || 401).json({
        success: false,
        message: resolved.error,
      });
    }

    req.user = resolved.user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message:
        err.name === 'TokenExpiredError'
          ? 'Access token has expired.'
          : 'Invalid or expired authentication token.',
    });
  }
}

/**
 * `optionalAuth`: Attaches `req.user = { id, email, role }` if a valid token exists;
 * otherwise sets `req.user = null` so guest routes work seamlessly.
 */
export async function optionalAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const resolved = await resolveActiveUserFromTokenPayload(decoded);

    if (resolved.error || !resolved.user) {
      req.user = null;
      return next();
    }

    req.user = resolved.user;
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

export default {
  requireAuth,
  optionalAuth,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getJwtSecret,
  getJwtRefreshSecret,
};
