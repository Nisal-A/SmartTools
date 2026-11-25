/**
 * Express Async Route Wrapper
 * Catches rejected promises and sends a structured JSON error response,
 * preserving custom error codes (e.g., SSRF `BLOCKED_URL`, `VALIDATION_ERROR`, `NOT_FOUND`).
 */
export function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (res.headersSent) {
        return;
      }
      const statusCode =
        err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
      const errorCode = typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
      const message = err.message || 'Internal Server Error';

      return res.status(statusCode).json({
        success: false,
        message,
        error: {
          code: errorCode,
          message,
        },
        ...(err.errors && err.errors.length ? { errors: err.errors } : {}),
        ...(err.meta && typeof err.meta === 'object' ? err.meta : {}),
      });
    });
  };
}

export default asyncHandler;
