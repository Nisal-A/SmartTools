import mongoose from 'mongoose';

/**
 * User Authentication & RBAC Model (`users` collection)
 *
 * Fields:
 * - `email`: unique, lowercase
 * - `passwordHash`: bcrypt (12 rounds)
 * - `role`: `'user' | 'admin'` (default `'user'`)
 * - `isActive`: boolean (default `true`)
 * - `pinnedToolIds`: `[String]` (default `['invoice-generator', 'quotation-generator']`)
 * - `refreshTokenHash`: hashed 7-day refresh token for session validation & rotation
 * - `lastLoginAt`: timestamp of latest interactive login
 */

export const DEFAULT_PINNED_TOOLS = ['invoice-generator', 'quotation-generator'];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    pinnedToolIds: {
      type: [String],
      default: () => [...DEFAULT_PINNED_TOOLS],
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'users',
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
