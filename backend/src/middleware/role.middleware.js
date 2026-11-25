/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Strictly enforces `'user'` vs `'admin'` permissions.
 */

/**
 * Rejects any non-admin request with `403 Forbidden` (or `401` if unauthenticated).
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

/**
 * Generic role guard factory.
 *
 * @param  {...string} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient role permissions.',
      });
    }

    return next();
  };
}

export default {
  requireAdmin,
  requireRole,
};
