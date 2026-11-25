import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary Configuration & Safe Local Development Fallback
 *
 * When CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET
 * are configured in `.env`, uploads stream directly to Cloudinary.
 * When unset (local dev / CI testing), safely falls back to an inline data URI
 * and synthetic publicId so logo uploads and `file_metadata` persistence work
 * out-of-the-box without external credentials.
 */

export function isCloudinaryConfigured() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) return false;
  if (
    cloudName.startsWith('your-') ||
    apiKey.startsWith('your-') ||
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
 * Uploads an image buffer to Cloudinary, or falls back to a safe base64 Data URI
 * when Cloudinary credentials are not set.
 *
 * @param {Buffer} buffer
 * @param {{ mimeType: string, folder?: string, userId?: string }} options
 * @returns {Promise<{ publicId: string, secureUrl: string, bytes: number, format: string, isFallback: boolean }>}
 */
export async function uploadBufferToCloudinary(buffer, options = {}) {
  const mimeType = options.mimeType || 'image/png';
  const folder = options.folder || 'smarttools/business_logos';
  const userId = options.userId || 'anonymous';

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
            return reject(err || new Error('Cloudinary upload failed'));
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

  // Safe local dev / base64 data URI fallback when Cloudinary credentials are unset
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
 *
 * @param {string} publicId
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
