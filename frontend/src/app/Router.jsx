import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute, PublicOrAuthRoute } from './RouteGuards.jsx';
import { LandingPage } from '../pages/Landing/LandingPage.jsx';
import { ToolsHubPage } from '../pages/Tools/ToolsHubPage.jsx';
import { ToolPreviewPage } from '../pages/Tools/ToolPreviewPage.jsx';
import { UpcomingSectionPage } from '../pages/Shared/UpcomingSectionPage.jsx';
import { TOOLS_REGISTRY, isToolLaunchable } from '../config/toolsRegistry.js';

/**
 * Lazy-loaded tool page components keyed by `tool.id` from `toolsRegistry.js`.
 *
 * ADDING A NEW TOOL ROUTE:
 *   1. Add its metadata object to `frontend/src/config/toolsRegistry.js`.
 *   2. Register its lazy page component below.
 *   Any tool without an entry here automatically falls back to `ToolPreviewPage`.
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
          {/* Public Landing */}
          <Route
            path="/"
            element={
              <PublicOrAuthRoute>
                <LandingPage />
              </PublicOrAuthRoute>
            }
          />

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

          {/* Coming Soon / unmounted tool preview fallback (never a broken route) */}
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
                <UpcomingSectionPage
                  title="Dashboard"
                  description="Activity KPIs, pending invoice balances, conversion rates, and recent documents."
                  iconName="LayoutDashboard"
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <UpcomingSectionPage
                  title="Document History"
                  description="Unified, filterable history of your invoices and quotations."
                  iconName="History"
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UpcomingSectionPage
                  title="Profile Management"
                  description="Personal details, reusable business profile, logo, bank details, and security."
                  iconName="UserCog"
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <UpcomingSectionPage
                  title="Shared Customers Directory"
                  description="Manage reusable customer billing & shipping records shared across all tools."
                  iconName="Users"
                />
              </ProtectedRoute>
            }
          />

          {/* Admin Governance Sections (Admin Only) */}
          <Route
            path="/admin/history"
            element={
              <AdminRoute>
                <UpcomingSectionPage
                  title="Admin Global History"
                  description="Cross-user document history across all registered tools with audit logging."
                  iconName="Globe"
                />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UpcomingSectionPage
                  title="Admin User Management"
                  description="Manage platform users, document counts, roles, and account statuses."
                  iconName="ShieldCheck"
                />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <AdminRoute>
                <UpcomingSectionPage
                  title="Admin Audit Logs"
                  description="Immutable governance trail of admin inspections, exports, and role changes."
                  iconName="ScrollText"
                />
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
