import { getToolByRoute } from './toolsRegistry.js';

/**
 * Non-tool navigation sections (Core, Workspace, Admin) and breadcrumb resolution.
 * Tool navigation always comes from `toolsRegistry.js`.
 */

export const CORE_NAV_ITEMS = Object.freeze([
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard', iconName: 'LayoutDashboard' },
  { id: 'all-tools', label: 'All Tools', to: '/tools', iconName: 'LayoutGrid', end: true },
  { id: 'history', label: 'Document History', to: '/history', iconName: 'History' },
]);

export const WORKSPACE_NAV_ITEMS = Object.freeze([
  { id: 'profile', label: 'Profile Management', to: '/profile', iconName: 'UserCog' },
  { id: 'customers', label: 'Customers', to: '/customers', iconName: 'Users' },
]);

export const ADMIN_NAV_ITEMS = Object.freeze([
  { id: 'admin-history', label: 'Global History', to: '/admin/history', iconName: 'Globe' },
  { id: 'admin-users', label: 'Users', to: '/admin/users', iconName: 'ShieldCheck' },
  { id: 'admin-audit-logs', label: 'Audit Logs', to: '/admin/audit-logs', iconName: 'ScrollText' },
]);

/**
 * Builds the dynamic breadcrumb trail for the Top Navbar, e.g.
 * `/tools/invoice-generator` -> [Tools, Invoice Generator].
 *
 * @returns {Array<{ label: string, to: string }>}
 */
export function getBreadcrumbs(pathname = '/') {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';

  if (path === '/') return [{ label: 'Home', to: '/' }];
  if (path === '/tools') return [{ label: 'Tools', to: '/tools' }];

  const tool = getToolByRoute(path);
  if (tool) {
    const crumbs = [
      { label: 'Tools', to: '/tools' },
      { label: tool.name, to: tool.route },
    ];
    if (path !== tool.route) crumbs.push({ label: 'Saved Document', to: path });
    return crumbs;
  }

  if (path.startsWith('/tools/')) {
    return [
      { label: 'Tools', to: '/tools' },
      { label: 'Unknown Tool', to: path },
    ];
  }

  if (path.startsWith('/admin')) {
    const adminItem = ADMIN_NAV_ITEMS.find((item) => path.startsWith(item.to));
    return [
      { label: 'Admin', to: '/admin/history' },
      ...(adminItem ? [{ label: adminItem.label, to: adminItem.to }] : []),
    ];
  }

  const sectionItem = [...CORE_NAV_ITEMS, ...WORKSPACE_NAV_ITEMS].find(
    (item) => path === item.to || path.startsWith(`${item.to}/`)
  );
  if (sectionItem) return [{ label: sectionItem.label, to: sectionItem.to }];

  return [{ label: 'Home', to: '/' }];
}
