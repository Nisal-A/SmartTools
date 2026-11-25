import ERROR_CODES from './errorCodes.js';

/**
 * An expected, user-facing error. The central error handler trusts its
 * `code`, `statusCode` and `message`; any other error is treated as a bug.
 */
export default class AppError extends Error {
  /**
   * @param {keyof typeof ERROR_CODES} code
   * @param {string} [message] safe, user-facing override of the default message
   * @param {{ statusCode?: number, cause?: unknown }} [options]
   */
  constructor(code, message, options = {}) {
    const known = Object.hasOwn(ERROR_CODES, code);
    const resolvedCode = known ? code : 'INTERNAL_ERROR';
    const definition = ERROR_CODES[resolvedCode];

    super(message ?? definition.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = resolvedCode;
    this.statusCode = options.statusCode ?? definition.status;
    this.isOperational = known;
  }
}

