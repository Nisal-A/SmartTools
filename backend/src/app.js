import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { getDatabaseHealth } from './config/db.js';
import authRoutes from './modules/authentication/auth.routes.js';
import profileRoutes from './modules/profiles/profiles.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import quotationRoutes from './modules/quotations/quotations.routes.js';
import seoAnalyzerRoutes from './modules/seo-analyzer/seoAnalyzer.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import pdfEngineRoutes from './modules/pdf-engine/pdfEngine.routes.js';
import receiptRoutes from './routes/receiptRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import {
  notFoundHandler,
  errorHandler,
} from './middleware/errorHandler.middleware.js';

/**
 * Unwraps accidental quotes, angle brackets, or Markdown link formatting
 * (e.g. `[https://app.example.com](https://app.example.com)`) from env URLs.
 */
export function unwrapEnvUrl(value = '') {
  let cleaned = String(value || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();

  const markdownMatch = cleaned.match(/^\[[^\]]*\]\((https?:\/\/[^)\s]+)\)$/i);
  if (markdownMatch) {
    cleaned = markdownMatch[1].trim();
  } else if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/**
 * Normalizes `CLIENT_URL` (plus legacy `FRONTEND_ORIGIN` / `CLIENT_ORIGIN` fallbacks)
 * by splitting comma-separated URLs, unwrapping accidental Markdown links, and
 * normalizing to exact `protocol://host` origins without trailing slashes.
 */
export function getNormalizedAllowedOrigins() {
  const raw =
    process.env.CLIENT_URL ||
    process.env.FRONTEND_ORIGIN ||
    process.env.CLIENT_ORIGIN ||
    '';

  const origins = raw
    .split(',')
    .map((entry) => unwrapEnvUrl(entry).replace(/\/+$/, ''))
    .filter(Boolean)
    .map((entry) => {
      try {
        const parsed = new URL(entry);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.origin;
        }
      } catch {
        // Fall back to stripped string if non-URL value was supplied
      }
      return entry;
    });

  return [...new Set(origins)];
}

function safeCompareSecret(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createApp() {
  const app = express();

  // Trust Render's first-hop reverse proxy for accurate client IPs & Secure cookies
  app.set('trust proxy', 1);

  // Isolated lightweight keep-alive endpoint mounted BEFORE auth, rate limiters & body parsers
  app.get('/api/v1/system/ping', (req, res) => {
    const keepaliveSecret = (process.env.KEEPALIVE_SECRET || '').trim();
    if (keepaliveSecret) {
      const providedKey = req.get('x-keepalive-key') || '';
      if (!safeCompareSecret(providedKey, keepaliveSecret)) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized keep-alive ping.',
        });
      }
    }

    return res.status(200).json({
      status: 'ok',
      pong: true,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  const allowedOrigins = getNormalizedAllowedOrigins();

  app.use(
    cors({
      origin(requestOrigin, callback) {
        // Allow non-browser / same-origin requests with no Origin header
        if (!requestOrigin) {
          return callback(null, true);
        }

        if (allowedOrigins.length === 0) {
          // Local dev convenience when CLIENT_URL is not configured
          return callback(null, true);
        }

        const normalizedOrigin = requestOrigin.trim().replace(/\/+$/, '');
        if (allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/v1/health', (_req, res) => {
    const dbHealth = getDatabaseHealth();
    res.status(200).json({
      status: 'ok',
      service: 'smarttools-backend',
      database: dbHealth.database,
      dbName: dbHealth.dbName,
      uptime: Math.round(process.uptime()),
    });
  });

  app.use('/api/receipts', receiptRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/purchase-orders', purchaseOrderRoutes);
  app.use('/api/v1/public/pdf', pdfEngineRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profiles', profileRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  app.use('/api/v1/quotations', quotationRoutes);
  app.use('/api/v1/receipts', receiptRoutes);
  app.use('/api/v1/suppliers', supplierRoutes);
  app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
  app.use('/api/v1/seo', seoAnalyzerRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1', documentsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
