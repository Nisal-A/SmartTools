/**
 * Centralized Express Error Handling & 404 Not Found Middleware
 */

export function notFoundHandler(req, res, _next) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(err, _req, res, _next) {
  if (res.headersSent) {
    return;
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errorCode = typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
  let errors = Array.isArray(err.errors) ? err.errors : [];

  // MongoDB duplicate key error (E11000)
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'CONFLICT';
    message = err.message?.includes('email')
      ? 'An account with this email already exists.'
      : 'Duplicate resource conflict.';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = 'Resource not found.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size (5 MB).';
    }
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid or expired authentication token.';
  }

  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: errorCode,
      message,
    },
    ...(errors.length > 0 ? { errors } : {}),
    ...(err.meta && typeof err.meta === 'object' ? err.meta : {}),
  });
}

export default {
  notFoundHandler,
  errorHandler,
};
