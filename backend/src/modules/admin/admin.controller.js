import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getAdminGlobalHistory,
  inspectAdminUserDocument,
  listAdminUsers,
  updateAdminUserRole,
  toggleAdminUserStatus,
  listAdminAuditLogs,
} from './admin.service.js';

/**
 * Admin Governance Controllers (`/api/v1/admin`)
 */

function extractClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

export const getAdminGlobalHistoryController = asyncHandler(async (req, res) => {
  const { items, pagination } = await getAdminGlobalHistory(
    req.user,
    req.query,
    extractClientIp(req)
  );

  return res.status(200).json({
    success: true,
    data: items,
    pagination,
  });
});

export const inspectAdminUserDocumentController = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const result = await inspectAdminUserDocument(
    req.user,
    type,
    id,
    extractClientIp(req)
  );

  return res.status(200).json({
    success: true,
    data: result,
  });
});

export const listAdminUsersController = asyncHandler(async (req, res) => {
  const { users, pagination } = await listAdminUsers(req.query);

  return res.status(200).json({
    success: true,
    data: users,
    pagination,
  });
});

export const updateAdminUserRoleController = asyncHandler(async (req, res) => {
  const updatedUser = await updateAdminUserRole(
    req.user,
    req.params.id,
    req.body?.role,
    extractClientIp(req)
  );

  return res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

export const toggleAdminUserStatusController = asyncHandler(async (req, res) => {
  const updatedUser = await toggleAdminUserStatus(
    req.user,
    req.params.id,
    req.body?.isActive,
    extractClientIp(req)
  );

  return res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

export const listAdminAuditLogsController = asyncHandler(async (req, res) => {
  const { logs, pagination } = await listAdminAuditLogs(req.query);

  return res.status(200).json({
    success: true,
    data: logs,
    pagination,
  });
});

export default {
  getAdminGlobalHistoryController,
  inspectAdminUserDocumentController,
  listAdminUsersController,
  updateAdminUserRoleController,
  toggleAdminUserStatusController,
  listAdminAuditLogsController,
};
