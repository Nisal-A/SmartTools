import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/authentication/auth.routes.js';
import profileRoutes from './modules/profiles/profiles.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import quotationRoutes from './modules/quotations/quotations.routes.js';
import seoAnalyzerRoutes from './modules/seo-analyzer/seoAnalyzer.routes.js';
import documentsRoutes from './modules/documents/documents.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import pdfEngineRoutes from './modules/pdf-engine/pdfEngine.routes.js';
import {
  notFoundHandler,
  errorHandler,
} from './middleware/errorHandler.middleware.js';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || true,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'smarttools-backend' });
  });

  app.use('/api/v1/public/pdf', pdfEngineRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profiles', profileRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  app.use('/api/v1/quotations', quotationRoutes);
  app.use('/api/v1/seo', seoAnalyzerRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1', documentsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
