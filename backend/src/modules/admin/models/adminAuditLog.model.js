import mongoose from 'mongoose';

/**
 * Admin Governance Audit Log Model (`admin_audit_logs` collection)
 *
 * Immutable audit trail recording every cross-user history query, user document
 * inspection, PDF export of another user's document, role change, or account status toggle.
 */

export const ADMIN_AUDIT_ACTIONS = Object.freeze([
  'VIEW_GLOBAL_HISTORY',
  'VIEW_USER_DOCUMENT',
  'EXPORT_USER_DOCUMENT_PDF',
  'UPDATE_USER_ROLE',
  'TOGGLE_USER_STATUS',
]);

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ADMIN_AUDIT_ACTIONS,
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resourceType: {
      type: String,
      trim: true,
      default: 'system',
    },
    resourceId: {
      type: String,
      trim: true,
      default: null,
    },
    queryMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'admin_audit_logs',
    timestamps: false,
  }
);

adminAuditLogSchema.index({ adminUserId: 1, timestamp: -1 });
adminAuditLogSchema.index({ targetUserId: 1 });
adminAuditLogSchema.index({ action: 1, timestamp: -1 });

export const AdminAuditLog =
  mongoose.models.AdminAuditLog ||
  mongoose.model('AdminAuditLog', adminAuditLogSchema);

/**
 * Helper to record an immutable admin audit log entry.
 */
export async function recordAdminAuditLog({
  adminUserId,
  action,
  targetUserId = null,
  resourceType = 'system',
  resourceId = null,
  queryMeta = {},
  ipAddress = '',
}) {
  if (!adminUserId || !mongoose.Types.ObjectId.isValid(String(adminUserId))) {
    return null;
  }

  const validTargetId =
    targetUserId && mongoose.Types.ObjectId.isValid(String(targetUserId))
      ? new mongoose.Types.ObjectId(String(targetUserId))
      : null;

  const created = await AdminAuditLog.create({
    adminUserId: new mongoose.Types.ObjectId(String(adminUserId)),
    action,
    targetUserId: validTargetId,
    resourceType: String(resourceType || 'system'),
    resourceId: resourceId ? String(resourceId) : null,
    queryMeta: queryMeta || {},
    ipAddress: String(ipAddress || ''),
    timestamp: new Date(),
  });

  return typeof created.toObject === 'function' ? created.toObject() : created;
}

export default AdminAuditLog;
