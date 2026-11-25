import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../middleware/auth.middleware.js';
import { User, DEFAULT_PINNED_TOOLS } from './user.model.js';
import { UserProfile } from '../profiles/userProfile.model.js';
import { BusinessProfile } from '../profiles/businessProfile.model.js';

export const BCRYPT_SALT_ROUNDS = 12;

/**
 * Pre-hashes a long JWT refresh token with SHA-256 before bcrypt hashing so
 * bcrypt's 72-byte input limit never truncates the token signature.
 */
function sha256Digest(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

export async function hashRefreshToken(rawToken) {
  return bcrypt.hash(sha256Digest(rawToken), 10);
}

export async function compareRefreshToken(rawToken, storedHash) {
  if (!rawToken || !storedHash) return false;
  return bcrypt.compare(sha256Digest(rawToken), storedHash);
}

export function formatUserResponse(userDoc, personalProfile = null) {
  const id = String(userDoc._id || userDoc.id);
  const fullName =
    personalProfile?.fullName ||
    userDoc.fullName ||
    (userDoc.email ? userDoc.email.split('@')[0] : '');

  return {
    id,
    _id: id,
    email: userDoc.email,
    fullName,
    role: userDoc.role === 'admin' ? 'admin' : 'user',
    isActive: userDoc.isActive !== false,
    pinnedToolIds: Array.isArray(userDoc.pinnedToolIds)
      ? userDoc.pinnedToolIds
      : [...DEFAULT_PINNED_TOOLS],
    lastLoginAt: userDoc.lastLoginAt || null,
    createdAt: userDoc.createdAt || null,
  };
}

/**
 * Registers a new user account, initializes `user_profiles` and `business_profiles`,
 * and issues an access token + refresh token pair.
 */
export async function registerUser(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const fullNameInput = String(payload.fullName || '').trim();
  const businessNameInput = String(payload.businessName || '').trim();
  const phoneInput = String(payload.phone || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError('A valid email address is required.', 400);
  }

  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters long.', 400);
  }

  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const resolvedFullName = fullNameInput || email.split('@')[0];

  const createdUser = await User.create({
    email,
    passwordHash,
    fullName: resolvedFullName,
    role: 'user',
    isActive: true,
    pinnedToolIds: [...DEFAULT_PINNED_TOOLS],
    lastLoginAt: new Date(),
  });

  const userId = createdUser._id;

  const [personalProfile] = await Promise.all([
    UserProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          fullName: resolvedFullName,
          phone: phoneInput,
          avatarUrl: '',
          timezone: 'UTC',
          locale: 'en-US',
        },
      },
      { new: true, upsert: true }
    ).lean(),
    BusinessProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          businessName: businessNameInput || resolvedFullName || 'My Business',
          email,
          phone: phoneInput,
          defaultCurrency: 'USD',
          defaultTaxRate: 0,
          defaultPaymentTerms: 'Net 30 days',
          defaultInvoiceSize: 'A4',
          defaultQuotationSize: 'A4',
        },
      },
      { new: true, upsert: true }
    ).lean(),
  ]);

  const userPayload = formatUserResponse(createdUser, personalProfile);
  const accessToken = signAccessToken(userPayload);
  const refreshToken = signRefreshToken(userPayload);
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  await User.findByIdAndUpdate(userId, {
    $set: { refreshTokenHash },
  });

  return {
    user: userPayload,
    accessToken,
    refreshToken,
  };
}

/**
 * Authenticates an existing user with email + password and issues rotated tokens.
 */
export async function loginUser(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!email || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const user = await User.findOne({ email }).lean();
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.isActive === false) {
    throw new AppError('Your account has been deactivated. Please contact an administrator.', 403);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  const personalProfile = await UserProfile.findOne({ userId: user._id }).lean();
  const now = new Date();
  const userPayload = formatUserResponse({ ...user, lastLoginAt: now }, personalProfile);

  const accessToken = signAccessToken(userPayload);
  const refreshToken = signRefreshToken(userPayload);
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  await User.findByIdAndUpdate(user._id, {
    $set: {
      lastLoginAt: now,
      refreshTokenHash,
    },
  });

  return {
    user: userPayload,
    accessToken,
    refreshToken,
  };
}

/**
 * Validates an incoming 7-day refresh token against the stored hash and rotates tokens.
 */
export async function refreshUserSession(rawRefreshToken) {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw new AppError('Refresh token is required.', 401);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  const userId = String(decoded.id || decoded.sub || '');
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('Invalid refresh token subject.', 401);
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    throw new AppError('User account no longer exists.', 401);
  }

  if (user.isActive === false) {
    throw new AppError('User account has been deactivated.', 403);
  }

  if (!user.refreshTokenHash) {
    throw new AppError('Refresh session has been revoked. Please sign in again.', 401);
  }

  const isMatch = await compareRefreshToken(rawRefreshToken, user.refreshTokenHash);
  if (!isMatch) {
    throw new AppError('Invalid refresh token session.', 401);
  }

  const personalProfile = await UserProfile.findOne({ userId: user._id }).lean();
  const userPayload = formatUserResponse(user, personalProfile);

  const accessToken = signAccessToken(userPayload);
  const refreshToken = signRefreshToken(userPayload);
  const refreshTokenHash = await hashRefreshToken(refreshToken);

  await User.findByIdAndUpdate(user._id, {
    $set: { refreshTokenHash },
  });

  return {
    user: userPayload,
    accessToken,
    refreshToken,
  };
}

/**
 * Revokes the user's refresh token hash in the database on logout.
 */
export async function logoutUser({ userId = null, refreshToken = null } = {}) {
  let targetUserId = userId;

  if (!targetUserId && refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      targetUserId = String(decoded.id || decoded.sub || '');
    } catch {
      targetUserId = null;
    }
  }

  if (targetUserId && mongoose.Types.ObjectId.isValid(String(targetUserId))) {
    await User.findByIdAndUpdate(targetUserId, {
      $set: { refreshTokenHash: null },
    });
  }

  return { loggedOut: true };
}

/**
 * Returns the authenticated user's profile and metadata.
 */
export async function getCurrentUser(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new AppError('User not found.', 404);
  }

  const [user, personalProfile] = await Promise.all([
    User.findById(userId).lean(),
    UserProfile.findOne({ userId: new mongoose.Types.ObjectId(String(userId)) }).lean(),
  ]);

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.isActive === false) {
    throw new AppError('User account is deactivated.', 403);
  }

  return formatUserResponse(user, personalProfile);
}

/**
 * Updates the user's `pinnedToolIds` array.
 */
export async function updatePinnedTools(userId, pinnedToolIds) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new AppError('User not found.', 404);
  }

  if (!Array.isArray(pinnedToolIds)) {
    throw new AppError('pinnedToolIds must be an array of tool ID strings.', 400);
  }

  const normalized = Array.from(
    new Set(
      pinnedToolIds
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { pinnedToolIds: normalized } },
    { new: true }
  ).lean();

  if (!updated) {
    throw new AppError('User not found.', 404);
  }

  const personalProfile = await UserProfile.findOne({ userId: updated._id }).lean();
  return formatUserResponse(updated, personalProfile);
}

/**
 * Updates the authenticated user's password after verifying `currentPassword`.
 */
export async function updateUserPassword(userId, { currentPassword, newPassword } = {}) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new AppError('User not found.', 404);
  }

  const curr = String(currentPassword || '');
  const next = String(newPassword || '');

  if (!curr || !next) {
    throw new AppError('Both currentPassword and newPassword are required.', 400);
  }

  if (next.length < 6) {
    throw new AppError('New password must be at least 6 characters long.', 400);
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  const isCurrentValid = await bcrypt.compare(curr, user.passwordHash);
  if (!isCurrentValid) {
    throw new AppError('Current password is incorrect.', 401);
  }

  const newPasswordHash = await bcrypt.hash(next, BCRYPT_SALT_ROUNDS);

  await User.findByIdAndUpdate(userId, {
    $set: {
      passwordHash: newPasswordHash,
      refreshTokenHash: null,
    },
  });

  return { updated: true };
}

export default {
  registerUser,
  loginUser,
  refreshUserSession,
  logoutUser,
  getCurrentUser,
  updatePinnedTools,
  updateUserPassword,
};
