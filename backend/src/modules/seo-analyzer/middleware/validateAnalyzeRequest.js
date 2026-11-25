import AppError from '../utils/AppError.js';

const MAX_URL_LENGTH = 2048;

/**
 * Ensures `req.body.url` is a non-empty string up to 2048 characters before entering the controller.
 */
export const validateAnalyzeRequest = (req, res, next) => {
  const rawUrl = req.body?.url;

  if (typeof rawUrl !== 'string') {
    next(new AppError('VALIDATION_ERROR', 'Request body must include a string "url" field.'));
    return;
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    next(new AppError('VALIDATION_ERROR', 'URL must be between 1 and 2048 characters.'));
    return;
  }

  req.body.url = trimmed;
  next();
};

export default validateAnalyzeRequest;
