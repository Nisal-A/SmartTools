import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getMyProfiles,
  updatePersonalProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
} from './profiles.service.js';

/**
 * Profile Management Controllers (`/api/v1/profiles`)
 */

export const getMyProfilesController = asyncHandler(async (req, res) => {
  const data = await getMyProfiles(req.user.id);
  return res.status(200).json({
    success: true,
    data,
  });
});

export const updatePersonalProfileController = asyncHandler(async (req, res) => {
  const personalProfile = await updatePersonalProfile(req.user.id, req.body);
  return res.status(200).json({
    success: true,
    data: personalProfile,
  });
});

export const updateBusinessProfileController = asyncHandler(async (req, res) => {
  const businessProfile = await updateBusinessProfile(req.user.id, req.body);
  return res.status(200).json({
    success: true,
    data: businessProfile,
  });
});

export const uploadBusinessLogoController = asyncHandler(async (req, res) => {
  let fileInput = req.file || (Array.isArray(req.files) && req.files[0]) || null;

  // Support base64 JSON payload as an alternative to multipart/form-data
  if (!fileInput && req.body && typeof req.body.base64 === 'string') {
    const rawBase64 = req.body.base64.replace(/^data:[^;]+;base64,/, '');
    fileInput = {
      buffer: Buffer.from(rawBase64, 'base64'),
      mimetype: req.body.mimeType || 'image/png',
      originalname: req.body.fileName || 'logo.png',
    };
  }

  const result = await uploadBusinessLogo(req.user.id, fileInput);
  return res.status(200).json({
    success: true,
    data: result,
  });
});

export default {
  getMyProfilesController,
  updatePersonalProfileController,
  updateBusinessProfileController,
  uploadBusinessLogoController,
};
