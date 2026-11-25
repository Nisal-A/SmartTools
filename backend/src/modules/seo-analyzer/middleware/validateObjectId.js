import mongoose from 'mongoose';
import AppError from '../utils/AppError.js';

/**
 * Validates that `:id` is a 24-character hex MongoDB ObjectId.
 */
export const validateObjectId = (req, res, next) => {
  const { id } = req.params;

  if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    next(new AppError('VALIDATION_ERROR', 'Invalid audit ID format.'));
    return;
  }

  next();
};

export default validateObjectId;
