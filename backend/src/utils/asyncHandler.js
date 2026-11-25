/**
 * Express Async Route Wrapper
 * Catches rejected promises and sends a structured JSON error response.
 */
export function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (res.headersSent) {
        return;
      }
      const statusCode =
        err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
      return res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(err.errors && err.errors.length ? { errors: err.errors } : {}),
        ...(err.meta && typeof err.meta === 'object' ? err.meta : {}),
      });
    });
  };
}

export default asyncHandler;
