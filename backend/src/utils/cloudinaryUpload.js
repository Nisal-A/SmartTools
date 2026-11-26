import { v2 as cloudinary } from 'cloudinary';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import { AppError } from './AppError.js';

/**
 * Expense Receipt Attachment Cloudinary Helper
 *
 * Accepts in-memory buffers (JPEG, PNG, WEBP, PDF up to 5 MB),
 * uploads them to `smarttools/expenses` with `secure: true`,
 * and cleanly deletes replaced/removed attachments.
 * Falls back gracefully to a non-production data URI when Cloudinary
 * credentials are unset or disabled in local/test environments.
 */

export const ALLOWED_EXPENSE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_EXPENSE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const EXPENSE_CLOUDINARY_FOLDER = 'smarttools/expenses';

export function validateExpenseAttachmentFile({ buffer, mimeType, size } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('Receipt file buffer is empty or missing.', 400);
  }

  const byteLength = Number.isFinite(size) ? size : buffer.length;
  if (byteLength > MAX_EXPENSE_ATTACHMENT_BYTES) {
    throw new AppError('Uploaded file exceeds the maximum allowed size (5 MB).', 400);
  }

  if (!ALLOWED_EXPENSE_MIME_TYPES.includes(mimeType)) {
    throw new AppError(
      'Unsupported file type. Allowed types: JPEG, PNG, WEBP, and PDF.',
      400
    );
  }
}

export async function uploadExpenseAttachment(
  buffer,
  { mimeType, originalName = '', userId = 'user' } = {}
) {
  validateExpenseAttachmentFile({
    buffer,
    mimeType,
    size: buffer?.length,
  });

  const fallbackResourceType = mimeType === 'application/pdf' ? 'raw' : 'image';

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: EXPENSE_CLOUDINARY_FOLDER,
          resource_type: 'auto',
          use_filename: Boolean(originalName),
          unique_filename: true,
        },
        (err, result) => {
          if (err || !result?.secure_url) {
            return reject(
              new AppError('Failed to upload receipt attachment.', 502)
            );
          }
          return resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type || fallbackResourceType,
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new AppError(
      'Receipt storage service (Cloudinary) is not configured in production.',
      500
    );
  }

  const safeUser = String(userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = Math.random().toString(36).slice(2, 8);

  return {
    url: `data:${mimeType};base64,${buffer.toString('base64')}`,
    publicId: `local_expenses_${safeUser}_${Date.now()}_${randomSuffix}`,
    resourceType: fallbackResourceType,
  };
}

export async function deleteExpenseAttachment(publicId, resourceType = 'image') {
  if (
    !publicId ||
    String(publicId).startsWith('local_') ||
    !isCloudinaryConfigured()
  ) {
    return { result: 'skipped' };
  }

  try {
    const primaryType = resourceType || 'image';
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: primaryType,
    });
    if (response?.result === 'not found' && primaryType !== 'raw') {
      return await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw',
      });
    }
    return response;
  } catch {
    return { result: 'error' };
  }
}

export default {
  ALLOWED_EXPENSE_MIME_TYPES,
  MAX_EXPENSE_ATTACHMENT_BYTES,
  EXPENSE_CLOUDINARY_FOLDER,
  validateExpenseAttachmentFile,
  uploadExpenseAttachment,
  deleteExpenseAttachment,
};
