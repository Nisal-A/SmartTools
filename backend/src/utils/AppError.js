/**
 * Standardized Operational Application Error
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {Array<object>} [errors=[]]
   */
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export default AppError;
