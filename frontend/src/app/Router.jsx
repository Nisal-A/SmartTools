import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PublicOrAuthRoute } from './RouteGuards.jsx';
import { ToolsHubPage } from '../pages/Tools/ToolsHubPage.jsx';
import { InvoiceGeneratorPage } from '../pages/InvoiceGenerator/InvoiceGeneratorPage.jsx';
import { QuotationGeneratorPage } from '../pages/QuotationGenerator/QuotationGeneratorPage.jsx';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tools" replace />} />
        <Route
          path="/tools"
          element={
            <PublicOrAuthRoute>
              <ToolsHubPage />
            </PublicOrAuthRoute>
          }
        />
        <Route
          path="/tools/invoice-generator"
          element={
            <PublicOrAuthRoute>
              <InvoiceGeneratorPage />
            </PublicOrAuthRoute>
          }
        />
        <Route
          path="/tools/invoice-generator/:id"
          element={
            <PublicOrAuthRoute>
              <InvoiceGeneratorPage />
            </PublicOrAuthRoute>
          }
        />
        <Route
          path="/tools/quotation-generator"
          element={
            <PublicOrAuthRoute>
              <QuotationGeneratorPage />
            </PublicOrAuthRoute>
          }
        />
        <Route
          path="/tools/quotation-generator/:id"
          element={
            <PublicOrAuthRoute>
              <QuotationGeneratorPage />
            </PublicOrAuthRoute>
          }
        />
        <Route path="*" element={<Navigate to="/tools" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
