import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { User } from '../authentication/user.model.js';
import { UserProfile } from '../profiles/userProfile.model.js';
import { Invoice } from '../invoices/models/invoice.model.js';
import { Quotation } from '../quotations/models/quotation.model.js';
import {
  getActiveHistoryAdapters,
  getHistoryAdapter,
} from '../documents/historyAdapters.js';
import {
  AdminAuditLog,
  ADMIN_AUDIT_ACTIONS,
  recordAdminAuditLog,
} from './models/adminAuditLog.model.js';

/**
 * Admin Governance Service (`admin.service.js`)
 *
 * The ONLY service layer permitted to query cross-user document histories and
 * user accounts. Every cross-user history view, document inspection, role change,
 * or account status toggle writes an immutable record to `admin_audit_logs`.
 */

function toObjectId(id, label = 'Resource') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError(`${label} not found`, 404);
  }
  return new mongoose.Types.ObjectId(String(id));
}

/**
 * Builds a lookup Map of `userIdString -> { id, email, fullName, role }` for a set of user IDs.
 */
async function buildOwnerLookupMap(userIds = []) {
  const uniqueValidIds = Array.from(
    new Set(
      userIds
        .map((id) => String(id || ''))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const ownerMap = new Map();
  if (uniqueValidIds.length === 0) return ownerMap;

  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: uniqueValidIds } }).lean(),
    UserProfile.find({ userId: { $in: uniqueValidIds } }).lean(),
  ]);

  const profileNameByUserId = new Map();
  for (const p of profiles) {
    if (p.fullName) {
      profileNameByUserId.set(String(p.userId), p.fullName);
    }
  }

  for (const u of users) {
    const uidStr = String(u._id);
    const fullName =
      profileNameByUserId.get(uidStr) ||
      u.fullName ||
      (u.email ? u.email.split('@')[0] : 'Unknown User');

    ownerMap.set(uidStr, {
      id: uidStr,
      email: u.email,
      fullName,
      role: u.role,
    });
  }

  return ownerMap;
}

/**
 * Cross-user global document history (`GET /api/v1/admin/history`).
 * Populates owner name & email, supports filtering by `userId`, `ownerEmail`, `toolType`,
 * `status`, `search`, `dateFrom`, `dateTo`, and records `VIEW_GLOBAL_HISTORY`.
 */
export async function getAdminGlobalHistory(adminUser, query = {}, ipAddress = '') {
  const requestedToolType = String(query.toolType || 'all').trim().toLowerCase();
  const adapters = getActiveHistoryAdapters(requestedToolType);

  if (requestedToolType !== 'all' && adapters.length === 0) {
    throw new AppError(`Unsupported toolType "${query.toolType}".`, 400);
  }

  // Resolve optional owner filter (`userId` and/or `ownerEmail`)
  let filterUserIds = null;
  let targetUserIdForAudit = null;

  if (query.userId && String(query.userId).trim()) {
    const rawUid = String(query.userId).trim();
    if (!mongoose.Types.ObjectId.isValid(rawUid)) {
      filterUserIds = [];
    } else {
      filterUserIds = [new mongoose.Types.ObjectId(rawUid)];
      targetUserIdForAudit = rawUid;
    }
  }

  if (query.ownerEmail && String(query.ownerEmail).trim()) {
    const escapedEmail = String(query.ownerEmail)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchedUsers = await User.find({
      email: { $regex: escapedEmail, $options: 'i' },
    }).lean();
    const emailMatchedIds = matchedUsers.map((u) => String(u._id));

    if (filterUserIds !== null) {
      const existingSet = new Set(filterUserIds.map((id) => String(id)));
      filterUserIds = emailMatchedIds
        .filter((id) => existingSet.has(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    } else {
      filterUserIds = emailMatchedIds.map((id) => new mongoose.Types.ObjectId(id));
      if (emailMatchedIds.length === 1) {
        targetUserIdForAudit = emailMatchedIds[0];
      }
    }
  }

  let rawAdapterEntries = [];

  if (filterUserIds === null || filterUserIds.length > 0) {
    const perAdapter = await Promise.all(
      adapters.map(async (adapter) => {
        const filter = adapter.buildFilter({
          filterUserIds,
          status: query.status,
          search: query.search,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        });

        const rawDocs = await adapter.model
          .find(filter)
          .sort({ createdAt: -1 })
          .lean();

        const processedDocs = adapter.postProcessDoc
          ? await Promise.all(rawDocs.map((d) => adapter.postProcessDoc(d)))
          : rawDocs;

        return processedDocs.map((doc) => ({ adapter, doc }));
      })
    );

    rawAdapterEntries = perAdapter.flat();
  }

  // Batch-load owner profiles for all returned documents
  const ownerMap = await buildOwnerLookupMap(
    rawAdapterEntries.map((entry) => entry.doc.userId)
  );

  const combined = rawAdapterEntries
    .map(({ adapter, doc }) => {
      const owner = ownerMap.get(String(doc.userId)) || {
        id: String(doc.userId),
        email: 'unknown@user',
        fullName: 'Unknown User',
      };
      return adapter.toHistoryDTO(doc, owner);
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const skip = (page - 1) * limit;
  const items = combined.slice(skip, skip + limit);

  // Record mandatory VIEW_GLOBAL_HISTORY audit entry
  await recordAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'VIEW_GLOBAL_HISTORY',
    targetUserId: targetUserIdForAudit,
    resourceType: 'history',
    resourceId: null,
    queryMeta: {
      toolType: requestedToolType,
      userId: query.userId || null,
      ownerEmail: query.ownerEmail || null,
      status: query.status || null,
      search: query.search || null,
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      page,
      limit,
    },
    ipAddress,
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Inspects full document details (items, payments, snapshots, owner) for read-only admin view
 * (`GET /api/v1/admin/history/:type/:id`) and logs `VIEW_USER_DOCUMENT`.
 */
export async function inspectAdminUserDocument(
  adminUser,
  toolType,
  documentId,
  ipAddress = ''
) {
  const adapter = getHistoryAdapter(toolType);
  if (!adapter) {
    throw new AppError(
      `Unsupported document type "${toolType}". Expected "invoice" or "quotation".`,
      400
    );
  }

  const fullDoc = await adapter.getById(adminUser, documentId, {
    allowAdmin: true,
  });

  const ownerMap = await buildOwnerLookupMap([fullDoc.userId]);
  const owner = ownerMap.get(String(fullDoc.userId)) || {
    id: String(fullDoc.userId),
    email: '',
    fullName: '',
  };

  await recordAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'VIEW_USER_DOCUMENT',
    targetUserId: fullDoc.userId,
    resourceType: adapter.toolType,
    resourceId: String(fullDoc._id),
    queryMeta: {
      documentNumber:
        fullDoc.invoiceNumber || fullDoc.quotationNumber || String(fullDoc._id),
    },
    ipAddress,
  });

  return {
    toolType: adapter.toolType,
    owner,
    document: {
      ...fullDoc,
      owner,
    },
  };
}

/**
 * Paginated list of users with `invoiceCount`, `quotationCount`, `role`, `isActive`, and `lastLoginAt`
 * (`GET /api/v1/admin/users`).
 */
export async function listAdminUsers(query = {}) {
  const filter = {};

  if (query.role && ['user', 'admin'].includes(String(query.role).toLowerCase())) {
    filter.role = String(query.role).toLowerCase();
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = String(query.isActive) === 'true';
  }

  if (query.search && String(query.search).trim()) {
    const escaped = String(query.search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { email: { $regex: escaped, $options: 'i' } },
      { fullName: { $regex: escaped, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((u) => u._id);
  const ownerMap = await buildOwnerLookupMap(userIds);

  const enrichedUsers = await Promise.all(
    users.map(async (u) => {
      const [invoiceCount, quotationCount] = await Promise.all([
        Invoice.countDocuments({ userId: u._id }),
        Quotation.countDocuments({ userId: u._id }),
      ]);

      const ownerMeta = ownerMap.get(String(u._id));

      return {
        id: String(u._id),
        _id: String(u._id),
        email: u.email,
        fullName: ownerMeta?.fullName || u.fullName || u.email.split('@')[0],
        role: u.role,
        isActive: u.isActive !== false,
        pinnedToolIds: u.pinnedToolIds || [],
        invoiceCount,
        quotationCount,
        totalDocuments: invoiceCount + quotationCount,
        lastLoginAt: u.lastLoginAt || null,
        createdAt: u.createdAt || null,
      };
    })
  );

  return {
    users: enrichedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Promotes or demotes a user's role (`PATCH /api/v1/admin/users/:id/role`).
 * Prevents demoting the last active admin or an admin demoting themselves when last active admin.
 */
export async function updateAdminUserRole(
  adminUser,
  targetUserId,
  newRoleInput,
  ipAddress = ''
) {
  const targetObjId = toObjectId(targetUserId, 'User');
  const nextRole = String(newRoleInput || '').trim().toLowerCase();

  if (!['user', 'admin'].includes(nextRole)) {
    throw new AppError('Invalid role. Allowed values: "user" or "admin".', 400);
  }

  const targetUser = await User.findById(targetObjId).lean();
  if (!targetUser) {
    throw new AppError('User not found.', 404);
  }

  const previousRole = targetUser.role;

  if (previousRole === 'admin' && nextRole === 'user') {
    const activeAdminsCount = await User.countDocuments({
      role: 'admin',
      isActive: true,
    });

    if (
      String(targetUser._id) === String(adminUser.id) &&
      activeAdminsCount <= 1
    ) {
      throw new AppError(
        'Cannot demote yourself when you are the last active administrator.',
        400
      );
    }

    if (activeAdminsCount <= 1 && targetUser.isActive !== false) {
      throw new AppError(
        'Cannot demote the last active administrator on the platform.',
        400
      );
    }
  }

  const updated = await User.findByIdAndUpdate(
    targetObjId,
    { $set: { role: nextRole } },
    { new: true }
  ).lean();

  await recordAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'UPDATE_USER_ROLE',
    targetUserId: targetUser._id,
    resourceType: 'user',
    resourceId: String(targetUser._id),
    queryMeta: {
      previousRole,
      newRole: nextRole,
      targetEmail: targetUser.email,
    },
    ipAddress,
  });

  return {
    id: String(updated._id),
    email: updated.email,
    fullName: updated.fullName,
    role: updated.role,
    isActive: updated.isActive !== false,
  };
}

/**
 * Activates or suspends a user account (`PATCH /api/v1/admin/users/:id/status`).
 * Strictly prevents self-suspension.
 */
export async function toggleAdminUserStatus(
  adminUser,
  targetUserId,
  requestedIsActive,
  ipAddress = ''
) {
  const targetObjId = toObjectId(targetUserId, 'User');

  const targetUser = await User.findById(targetObjId).lean();
  if (!targetUser) {
    throw new AppError('User not found.', 404);
  }

  const previousStatus = targetUser.isActive !== false;
  const nextIsActive =
    typeof requestedIsActive === 'boolean'
      ? requestedIsActive
      : requestedIsActive !== undefined
        ? String(requestedIsActive) === 'true'
        : !previousStatus;

  if (String(targetUser._id) === String(adminUser.id) && !nextIsActive) {
    throw new AppError('Administrators cannot suspend their own account.', 400);
  }

  if (targetUser.role === 'admin' && !nextIsActive) {
    const activeAdminsCount = await User.countDocuments({
      role: 'admin',
      isActive: true,
    });
    if (activeAdminsCount <= 1) {
      throw new AppError(
        'Cannot suspend the last active administrator account.',
        400
      );
    }
  }

  const updatePayload = {
    isActive: nextIsActive,
    ...(nextIsActive === false ? { refreshTokenHash: null } : {}),
  };

  const updated = await User.findByIdAndUpdate(
    targetObjId,
    { $set: updatePayload },
    { new: true }
  ).lean();

  await recordAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'TOGGLE_USER_STATUS',
    targetUserId: targetUser._id,
    resourceType: 'user',
    resourceId: String(targetUser._id),
    queryMeta: {
      previousStatus,
      isActive: nextIsActive,
      targetEmail: targetUser.email,
    },
    ipAddress,
  });

  return {
    id: String(updated._id),
    email: updated.email,
    fullName: updated.fullName,
    role: updated.role,
    isActive: updated.isActive !== false,
  };
}

/**
 * Paginated view of `admin_audit_logs` filterable by admin or action
 * (`GET /api/v1/admin/audit-logs`).
 */
export async function listAdminAuditLogs(query = {}) {
  const filter = {};

  const adminFilterId = query.adminUserId || query.adminId || query.admin;
  if (adminFilterId && mongoose.Types.ObjectId.isValid(String(adminFilterId))) {
    filter.adminUserId = new mongoose.Types.ObjectId(String(adminFilterId));
  }

  if (
    query.targetUserId &&
    mongoose.Types.ObjectId.isValid(String(query.targetUserId))
  ) {
    filter.targetUserId = new mongoose.Types.ObjectId(String(query.targetUserId));
  }

  if (
    query.action &&
    ADMIN_AUDIT_ACTIONS.includes(String(query.action).trim().toUpperCase())
  ) {
    filter.action = String(query.action).trim().toUpperCase();
  }

  if (query.resourceType && String(query.resourceType).trim()) {
    filter.resourceType = String(query.resourceType).trim().toLowerCase();
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 30));
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminAuditLog.countDocuments(filter),
  ]);

  const userIdsToResolve = [];
  for (const log of logs) {
    if (log.adminUserId) userIdsToResolve.push(log.adminUserId);
    if (log.targetUserId) userIdsToResolve.push(log.targetUserId);
  }

  const ownerMap = await buildOwnerLookupMap(userIdsToResolve);

  const enrichedLogs = logs.map((log) => ({
    id: String(log._id),
    _id: String(log._id),
    adminUserId: String(log.adminUserId),
    admin: ownerMap.get(String(log.adminUserId)) || {
      id: String(log.adminUserId),
      email: '',
      fullName: 'Administrator',
    },
    action: log.action,
    targetUserId: log.targetUserId ? String(log.targetUserId) : null,
    targetUser: log.targetUserId
      ? ownerMap.get(String(log.targetUserId)) || {
          id: String(log.targetUserId),
          email: '',
          fullName: '',
        }
      : null,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    queryMeta: log.queryMeta || {},
    ipAddress: log.ipAddress || '',
    timestamp: log.timestamp,
  }));

  return {
    logs: enrichedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export default {
  getAdminGlobalHistory,
  inspectAdminUserDocument,
  listAdminUsers,
  updateAdminUserRole,
  toggleAdminUserStatus,
  listAdminAuditLogs,
};
