import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute, PublicOrAuthRoute } from './RouteGuards.jsx';
import { LandingPage } from '../pages/Landing/LandingPage.jsx';
import { LoginPage } from '../pages/Auth/LoginPage.jsx';
import { RegisterPage } from '../pages/Auth/RegisterPage.jsx';
import { ToolsHubPage } from '../pages/Tools/ToolsHubPage.jsx';
import { ToolPreviewPage } from '../pages/Tools/ToolPreviewPage.jsx';
import { DashboardPage } from '../pages/Dashboard/DashboardPage.jsx';
import { DocumentHistoryPage } from '../pages/DocumentHistory/DocumentHistoryPage.jsx';
import { ProfileManagementPage } from '../pages/ProfileManagement/ProfileManagementPage.jsx';
import { AdminGlobalHistoryPage } from '../pages/Admin/AdminGlobalHistoryPage.jsx';
import { AdminUsersPage } from '../pages/Admin/AdminUsersPage.jsx';
import { AdminAuditLogsPage } from '../pages/Admin/AdminAuditLogsPage.jsx';
import { TOOLS_REGISTRY, isToolLaunchable } from '../config/toolsRegistry.js';

/**
 * Lazy-loaded tool page components keyed by `tool.id` from `toolsRegistry.js`.
 *
 * ADDING A NEW TOOL ROUTE:
 *   1. Add its metadata object to `frontend/src/config/toolsRegistry.js`.
 *   2. Register its lazy page component below.
 */
const TOOL_PAGE_COMPONENTS = {
  'invoice-generator': lazy(() =>
    import('../pages/InvoiceGenerator/InvoiceGeneratorPage.jsx')
  ),
  'quotation-generator': lazy(() =>
    import('../pages/QuotationGenerator/QuotationGeneratorPage.jsx')
  ),
};

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm font-medium text-slate-500">
      Loading tool…
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Landing & Auth Pages */}
          <Route
            path="/"
            element={
              <PublicOrAuthRoute>
                <LandingPage />
              </PublicOrAuthRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Tools Hub */}
          <Route
            path="/tools"
            element={
              <PublicOrAuthRoute>
                <ToolsHubPage />
              </PublicOrAuthRoute>
            }
          />

          {/* Dynamic registry-driven active tool routes (+ optional /:id record routes) */}
          {TOOLS_REGISTRY.filter(
            (tool) => isToolLaunchable(tool) && Boolean(TOOL_PAGE_COMPONENTS[tool.id])
          ).map((tool) => {
            const ToolPage = TOOL_PAGE_COMPONENTS[tool.id];
            const Wrapper = tool.supportsGuestMode ? PublicOrAuthRoute : ProtectedRoute;
            return (
              <React.Fragment key={tool.id}>
                <Route
                  path={tool.route}
                  element={
                    <Wrapper>
                      <ToolPage />
                    </Wrapper>
                  }
                />
                <Route
                  path={`${tool.route}/:id`}
                  element={
                    <Wrapper>
                      <ToolPage />
                    </Wrapper>
                  }
                />
              </React.Fragment>
            );
          })}

          {/* Coming Soon / unmounted tool preview fallback */}
          <Route
            path="/tools/:toolSlug"
            element={
              <PublicOrAuthRoute>
                <ToolPreviewPage />
              </PublicOrAuthRoute>
            }
          />

          {/* Authenticated Workspace Sections */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <DocumentHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfileManagementPage defaultTab="personal" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <ProfileManagementPage defaultTab="customers" />
              </ProtectedRoute>
            }
          />

          {/* Admin Governance Sections (Admin Only) */}
          <Route
            path="/admin/history"
            element={
              <AdminRoute>
                <AdminGlobalHistoryPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <AdminRoute>
                <AdminAuditLogsPage />
              </AdminRoute>
            }
          />

          <Route path="*" element={<Navigate to="/tools" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRouter;
