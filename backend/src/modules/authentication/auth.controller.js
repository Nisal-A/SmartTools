import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../../middleware/auth.middleware.js';
import {
  registerUser,
  loginUser,
  refreshUserSession,
  logoutUser,
  getCurrentUser,
  updatePinnedTools,
  updateUserPassword,
} from './auth.service.js';

/**
 * Authentication Controllers (`/api/v1/auth`)
 */

export const registerController = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await registerUser(req.body);
  setRefreshTokenCookie(res, refreshToken, req);

  return res.status(201).json({
    success: true,
    accessToken,
    refreshToken,
    user,
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

export const loginController = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await loginUser(req.body);
  setRefreshTokenCookie(res, refreshToken, req);

  return res.status(200).json({
    success: true,
    accessToken,
    refreshToken,
    user,
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

export const refreshController = asyncHandler(async (req, res) => {
  const rawRefreshToken =
    req.cookies?.[REFRESH_COOKIE_NAME] ||
    req.cookies?.smarttools_refresh_token ||
    req.body?.refreshToken ||
    null;

  const { user, accessToken, refreshToken } = await refreshUserSession(rawRefreshToken);
  setRefreshTokenCookie(res, refreshToken, req);

  return res.status(200).json({
    success: true,
    accessToken,
    refreshToken,
    user,
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

export const logoutController = asyncHandler(async (req, res) => {
  const rawRefreshToken =
    req.cookies?.[REFRESH_COOKIE_NAME] ||
    req.cookies?.smarttools_refresh_token ||
    req.body?.refreshToken ||
    null;

  await logoutUser({
    userId: req.user?.id || null,
    refreshToken: rawRefreshToken,
  });

  clearRefreshTokenCookie(res, req);

  return res.status(200).json({
    success: true,
    message: 'Signed out successfully.',
  });
});

export const meController = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);

  return res.status(200).json({
    success: true,
    user,
    data: user,
  });
});

export const updatePinnedToolsController = asyncHandler(async (req, res) => {
  const pinnedToolIds = req.body?.pinnedToolIds;
  const user = await updatePinnedTools(req.user.id, pinnedToolIds);

  return res.status(200).json({
    success: true,
    user,
    data: {
      pinnedToolIds: user.pinnedToolIds,
      user,
    },
  });
});

export const updatePasswordController = asyncHandler(async (req, res) => {
  await updateUserPassword(req.user.id, {
    currentPassword: req.body?.currentPassword,
    newPassword: req.body?.newPassword,
  });

  clearRefreshTokenCookie(res, req);

  return res.status(200).json({
    success: true,
    message: 'Password updated successfully.',
  });
});

export default {
  registerController,
  loginController,
  refreshController,
  logoutController,
  meController,
  updatePinnedToolsController,
  updatePasswordController,
};
