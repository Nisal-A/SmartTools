import { rateLimit } from 'express-rate-limit';
import env from '../../../config/env.js';
import AppError from '../utils/AppError.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const createLimiter = (limit) =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED')),
  });

export const globalLimiter = createLimiter(env.RATE_LIMIT_GLOBAL_PER_15MIN);
export const analyzeRateLimiter = createLimiter(env.RATE_LIMIT_ANALYZE_PER_15MIN);
export const analyzeLimiter = analyzeRateLimiter;
