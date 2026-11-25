import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, signAccessToken } from '../../middleware/auth.js';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { collection: 'users', timestamps: true }
);
userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);

const businessProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    businessName: { type: String, trim: true, default: '' },
    taxRegistrationNo: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    address: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    bankDetails: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    defaultCurrency: { type: String, default: 'USD' },
    defaultTaxRate: { type: Number, default: 0 },
    defaultPaymentTerms: { type: String, default: 'Net 30 days' },
    defaultInvoiceSize: { type: String, default: 'A4' },
    defaultQuotationSize: { type: String, default: 'A4' },
  },
  { collection: 'business_profiles', timestamps: true }
);
businessProfileSchema.index({ userId: 1 }, { unique: true });

export const BusinessProfile =
  mongoose.models.BusinessProfile ||
  mongoose.model('BusinessProfile', businessProfileSchema);

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.fullName || '').trim();
    const businessName = String(req.body?.businessName || '').trim();

    if (!email || !password || password.length < 6) {
      throw new AppError('Valid email and password (min 6 chars) are required', 400);
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await User.create({
      email,
      passwordHash,
      fullName: fullName || email.split('@')[0],
      role: 'user',
      lastLoginAt: new Date(),
    });

    await BusinessProfile.create({
      userId: createdUser._id,
      businessName: businessName || fullName || 'My Business',
      email,
      defaultCurrency: 'USD',
      defaultTaxRate: 0,
      defaultPaymentTerms: 'Net 30 days',
      defaultInvoiceSize: 'A4',
      defaultQuotationSize: 'A4',
    });

    const userPayload = {
      id: String(createdUser._id),
      email: createdUser.email,
      fullName: createdUser.fullName,
      role: createdUser.role,
    };

    const accessToken = signAccessToken(userPayload);

    return res.status(201).json({
      success: true,
      accessToken,
      user: userPayload,
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = await User.findOne({ email }).lean();
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const userPayload = {
      id: String(user._id),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const accessToken = signAccessToken(userPayload);
    return res.status(200).json({
      success: true,
      accessToken,
      user: userPayload,
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return res.status(200).json({
      success: true,
      data: {
        id: String(user._id),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    return res.status(200).json({ success: true, message: 'Signed out' });
  })
);

export default router;
