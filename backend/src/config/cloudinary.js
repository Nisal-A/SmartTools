import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Configuration (Production-Hardened with Dev-Only Local Fallback)
 *
 * - Always configures Cloudinary SDK v2 with `secure: true`.
 * - In `production`, Cloudinary credentials are strictly required and upload failures
 *   fail clearly without falling back to inline base64 data URIs.
 * - In local `development` / `test` when Cloudinary credentials are unset, safely
 *   falls back to a base64 Data URI so local development works offline.
 */

export function isCloudinaryConfigured() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) return false;
  if (
    cloudName.startsWith('your_') ||
    cloudName.startsWith('your-') ||
    apiKey.startsWith('your_') ||
    apiKey.startsWith('your-') ||
    apiSecret.startsWith('your_') ||
    apiSecret.startsWith('your-')
  ) {
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return true;
}

/**
 * Pings the live Cloudinary Admin API to verify credentials and connectivity.
 * Never exposes API keys or secrets in error messages.
 *
 * @returns {Promise<{ status: string }>}
 */
export async function checkCloudinaryHealth() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or placeholder values.'
    );
  }

  try {
    const response = await cloudinary.api.ping();
    return {
      status: response?.status || 'ok',
    };
  } catch (err) {
    const reason =
      err?.error?.message ||
      err?.message ||
      `HTTP ${err?.error?.http_code || err?.http_code || 'error'} during cloudinary.api.ping()`;
    throw new Error(`Cloudinary ping rejected: ${reason}`);
  }
}

/**
 * Uploads an image buffer to Cloudinary (`secure: true`).
 * Allows base64 fallback ONLY when `NODE_ENV !== 'production'`.
 *
 * @param {Buffer} buffer
 * @param {{ mimeType: string, folder?: string, userId?: string }} options
 * @returns {Promise<{ publicId: string, secureUrl: string, bytes: number, format: string, isFallback: boolean }>}
 */
export async function uploadBufferToCloudinary(buffer, options = {}) {
  const mimeType = options.mimeType || 'image/png';
  const folder = options.folder || 'smarttools/business_logos';
  const userId = options.userId || 'anonymous';
  const isProd = process.env.NODE_ENV === 'production';

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ width: 600, height: 600, crop: 'limit' }],
        },
        (err, result) => {
          if (err || !result) {
            return reject(
              new Error(
                `Cloudinary logo upload failed: ${err?.message || 'Unknown upload error'}`
              )
            );
          }
          return resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            bytes: result.bytes || buffer.length,
            format: result.format || mimeType.split('/')[1] || 'png',
            isFallback: false,
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  if (isProd) {
    throw new Error(
      'Cloudinary upload failed: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required in production.'
    );
  }

  // Non-production local dev / automated test fallback ONLY
  const base64Data = buffer.toString('base64');
  const secureUrl = `data:${mimeType};base64,${base64Data}`;
  const publicId = `local_${folder.replace(/\//g, '_')}_${userId}_${Date.now()}`;

  return {
    publicId,
    secureUrl,
    bytes: buffer.length,
    format: mimeType.split('/')[1] || 'png',
    isFallback: true,
  };
}

/**
 * Deletes an asset from Cloudinary if configured and not a local fallback ID.
 */
export async function deleteFromCloudinary(publicId) {
  if (!publicId || publicId.startsWith('local_') || !isCloudinaryConfigured()) {
    return { result: 'skipped' };
  }
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch {
    return { result: 'error' };
  }
}

export default cloudinary;
