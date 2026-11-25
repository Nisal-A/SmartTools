import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { renderPublicPdfController } from './pdfEngine.controller.js';

/**
 * Public Guest PDF Render Routes
 *
 * Mount path:
 * - When mounted at `/api/v1/public/pdf`, exposes `POST /render` -> `/api/v1/public/pdf/render`
 * - Also supports mounting at `/api/v1` (`/public/pdf/render`) or root (`/api/v1/public/pdf/render`)
 */

export const guestPdfRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 PDF renders per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many PDF generation requests from this IP. Please try again in 15 minutes or sign in.',
  },
});

const router = Router();

router.post('/render', guestPdfRateLimiter, renderPublicPdfController);
router.post('/public/pdf/render', guestPdfRateLimiter, renderPublicPdfController);
router.post('/api/v1/public/pdf/render', guestPdfRateLimiter, renderPublicPdfController);

export default router;
