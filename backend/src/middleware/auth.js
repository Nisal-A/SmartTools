import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

const DEFAULT_JWT_SECRET = 'smarttools-dev-jwt-access-secret-2026';

export function getJwtSecret() {
  return process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
}

/**
 * Signs a short-lived JWT access token for a user.
 *
 * @param {{ id?: string, _id?: string, email?: string, role?: 'user'|'admin' }} user
 * @returns {string}
 */
export function signAccessToken(user) {
  const userId = String(user.id || user._id);
  const role = user.role || 'user';
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
 * Authentication middleware verifying Bearer JWT and populating `req.user = { id, role, email }`.
 */
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid Bearer token.',
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is missing.',
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const userId = String(decoded.id || decoded.sub || decoded.userId || '');

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload.',
      });
    }

    req.user = {
      id: userId,
      role: decoded.role === 'admin' ? 'admin' : 'user',
      email: decoded.email || '',
    };

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
 * Role-based access control middleware restricting routes to `role === 'admin'`.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Administrator privileges required.',
    });
  }

  return next();
}
