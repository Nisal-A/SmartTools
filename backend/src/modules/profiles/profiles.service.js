import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from '../../config/cloudinary.js';
import { User } from '../authentication/user.model.js';
import { UserProfile } from './userProfile.model.js';
import { BusinessProfile } from './businessProfile.model.js';
import { FileMetadata } from './fileMetadata.model.js';

const ALLOWED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
];

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB
const VALID_INVOICE_SIZES = ['A4', 'A5', 'LETTER', 'LEGAL', 'B5', 'THERMAL_80'];
const VALID_QUOTATION_SIZES = ['A4', 'A5', 'LETTER', 'LEGAL', 'B5'];

function toObjectId(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new AppError('Valid user ID is required.', 401);
  }
  return new mongoose.Types.ObjectId(String(userId));
}

function normalizeAddress(addr) {
  if (!addr) {
    return {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    };
  }
  if (typeof addr === 'string') {
    return {
      street: addr.trim(),
      city: '',
      state: '',
      postalCode: '',
      country: '',
    };
  }
  return {
    street: String(addr.street || '').trim(),
    city: String(addr.city || '').trim(),
    state: String(addr.state || '').trim(),
    postalCode: String(addr.postalCode || '').trim(),
    country: String(addr.country || '').trim(),
  };
}

function normalizeBankDetails(bank = {}) {
  if (!bank || typeof bank !== 'object') {
    return {
      bankName: '',
      accountName: '',
      accountNumber: '',
      routingOrSwift: '',
      iban: '',
      branch: '',
      instructions: '',
    };
  }
  return {
    bankName: String(bank.bankName || '').trim(),
    accountName: String(bank.accountName || '').trim(),
    accountNumber: String(bank.accountNumber || '').trim(),
    routingOrSwift: String(bank.routingOrSwift || '').trim(),
    iban: String(bank.iban || '').trim(),
    branch: String(bank.branch || '').trim(),
    instructions: String(bank.instructions || '').trim(),
  };
}

/**
 * Retrieves both Personal Profile (`user_profiles`) and Business Profile (`business_profiles`)
 * for the authenticated user, initializing default records if missing.
 */
export async function getMyProfiles(userId) {
  const uid = toObjectId(userId);

  const [user, existingPersonal, existingBusiness] = await Promise.all([
    User.findById(uid).lean(),
    UserProfile.findOne({ userId: uid }).lean(),
    BusinessProfile.findOne({ userId: uid }).lean(),
  ]);

  if (!user) {
    throw new AppError('User account not found.', 404);
  }

  let personalDoc = existingPersonal;
  if (!personalDoc) {
    personalDoc = await UserProfile.findOneAndUpdate(
      { userId: uid },
      {
        $setOnInsert: {
          userId: uid,
          fullName: user.fullName || user.email.split('@')[0],
          phone: '',
          avatarUrl: '',
          jobTitle: '',
          timezone: 'UTC',
          locale: 'en-US',
        },
      },
      { new: true, upsert: true }
    ).lean();
  }

  let businessDoc = existingBusiness;
  if (!businessDoc) {
    businessDoc = await BusinessProfile.findOneAndUpdate(
      { userId: uid },
      {
        $setOnInsert: {
          userId: uid,
          businessName: user.fullName || 'My Business',
          email: user.email,
          defaultCurrency: 'USD',
          defaultTaxRate: 0,
          defaultPaymentTerms: 'Net 30 days',
          defaultInvoiceSize: 'A4',
          defaultQuotationSize: 'A4',
        },
      },
      { new: true, upsert: true }
    ).lean();
  }

  return {
    personalProfile: {
      id: String(personalDoc._id),
      userId: String(uid),
      email: user.email,
      role: user.role,
      fullName: personalDoc.fullName || user.fullName || '',
      phone: personalDoc.phone || '',
      avatarUrl: personalDoc.avatarUrl || '',
      jobTitle: personalDoc.jobTitle || '',
      timezone: personalDoc.timezone || 'UTC',
      locale: personalDoc.locale || 'en-US',
      pinnedToolIds: user.pinnedToolIds || [],
    },
    businessProfile: businessDoc,
  };
}

/**
 * Updates the user's personal profile (`user_profiles`) and syncs `fullName` on `users`.
 */
export async function updatePersonalProfile(userId, payload = {}) {
  const uid = toObjectId(userId);
  const existing = await UserProfile.findOne({ userId: uid }).lean();

  const updateFields = {};
  if (payload.fullName !== undefined) {
    updateFields.fullName = String(payload.fullName || '').trim();
  }
  if (payload.phone !== undefined) {
    updateFields.phone = String(payload.phone || '').trim();
  }
  if (payload.avatarUrl !== undefined) {
    updateFields.avatarUrl = String(payload.avatarUrl || '').trim();
  }
  if (payload.jobTitle !== undefined) {
    updateFields.jobTitle = String(payload.jobTitle || '').trim();
  }
  if (payload.timezone !== undefined) {
    updateFields.timezone = String(payload.timezone || 'UTC').trim();
  }
  if (payload.locale !== undefined) {
    updateFields.locale = String(payload.locale || 'en-US').trim();
  }

  const updatedPersonal = await UserProfile.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        fullName: updateFields.fullName ?? existing?.fullName ?? '',
        phone: updateFields.phone ?? existing?.phone ?? '',
        avatarUrl: updateFields.avatarUrl ?? existing?.avatarUrl ?? '',
        jobTitle: updateFields.jobTitle ?? existing?.jobTitle ?? '',
        timezone: updateFields.timezone ?? existing?.timezone ?? 'UTC',
        locale: updateFields.locale ?? existing?.locale ?? 'en-US',
      },
    },
    { new: true, upsert: true }
  ).lean();

  if (updateFields.fullName !== undefined) {
    await User.findByIdAndUpdate(uid, {
      $set: { fullName: updateFields.fullName },
    });
  }

  const user = await User.findById(uid).lean();

  return {
    id: String(updatedPersonal._id),
    userId: String(uid),
    email: user?.email || '',
    role: user?.role || 'user',
    fullName: updatedPersonal.fullName,
    phone: updatedPersonal.phone,
    avatarUrl: updatedPersonal.avatarUrl,
    jobTitle: updatedPersonal.jobTitle,
    timezone: updatedPersonal.timezone,
    locale: updatedPersonal.locale,
  };
}

/**
 * Updates the user's reusable business profile (`business_profiles`).
 */
export async function updateBusinessProfile(userId, payload = {}) {
  const uid = toObjectId(userId);
  const existing = await BusinessProfile.findOne({ userId: uid }).lean();

  const defaultInvoiceSize =
    payload.defaultInvoiceSize !== undefined
      ? String(payload.defaultInvoiceSize).toUpperCase()
      : existing?.defaultInvoiceSize || 'A4';

  const defaultQuotationSize =
    payload.defaultQuotationSize !== undefined
      ? String(payload.defaultQuotationSize).toUpperCase()
      : existing?.defaultQuotationSize || 'A4';

  if (!VALID_INVOICE_SIZES.includes(defaultInvoiceSize)) {
    throw new AppError(
      `Invalid defaultInvoiceSize "${defaultInvoiceSize}". Allowed: ${VALID_INVOICE_SIZES.join(', ')}`,
      400
    );
  }

  if (!VALID_QUOTATION_SIZES.includes(defaultQuotationSize)) {
    throw new AppError(
      `Invalid defaultQuotationSize "${defaultQuotationSize}". Allowed: ${VALID_QUOTATION_SIZES.join(', ')}`,
      400
    );
  }

  const taxRate =
    payload.defaultTaxRate !== undefined
      ? Number(payload.defaultTaxRate)
      : existing?.defaultTaxRate ?? 0;

  if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new AppError('defaultTaxRate must be a number between 0 and 100.', 400);
  }

  const nextAddress =
    payload.address !== undefined
      ? normalizeAddress(payload.address)
      : existing?.address || normalizeAddress({});

  const nextBankDetails =
    payload.bankDetails !== undefined
      ? normalizeBankDetails(payload.bankDetails)
      : existing?.bankDetails || normalizeBankDetails({});

  const updatedBusiness = await BusinessProfile.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        businessName:
          payload.businessName !== undefined
            ? String(payload.businessName || '').trim()
            : existing?.businessName ?? '',
        logoUrl:
          payload.logoUrl !== undefined
            ? String(payload.logoUrl || '').trim()
            : existing?.logoUrl ?? '',
        logoFileId:
          payload.logoFileId !== undefined
            ? payload.logoFileId
            : existing?.logoFileId ?? null,
        taxRegistrationNo:
          payload.taxRegistrationNo !== undefined
            ? String(payload.taxRegistrationNo || '').trim()
            : existing?.taxRegistrationNo ?? '',
        email:
          payload.email !== undefined
            ? String(payload.email || '').trim()
            : existing?.email ?? '',
        phone:
          payload.phone !== undefined
            ? String(payload.phone || '').trim()
            : existing?.phone ?? '',
        website:
          payload.website !== undefined
            ? String(payload.website || '').trim()
            : existing?.website ?? '',
        address: nextAddress,
        bankDetails: nextBankDetails,
        defaultCurrency:
          payload.defaultCurrency !== undefined
            ? String(payload.defaultCurrency || 'USD').trim().toUpperCase()
            : existing?.defaultCurrency ?? 'USD',
        defaultTaxRate: taxRate,
        defaultPaymentTerms:
          payload.defaultPaymentTerms !== undefined
            ? String(payload.defaultPaymentTerms || '').trim()
            : existing?.defaultPaymentTerms ?? 'Net 30 days',
        defaultInvoiceSize,
        defaultQuotationSize,
      },
    },
    { new: true, upsert: true }
  ).lean();

  return updatedBusiness;
}

/**
 * Validates and uploads a business logo via Multer memory buffer -> Cloudinary (or local dev fallback),
 * persists a `file_metadata` record, and updates `business_profiles.logoUrl` & `logoFileId`.
 */
export async function uploadBusinessLogo(userId, fileInput) {
  const uid = toObjectId(userId);

  if (!fileInput || !Buffer.isBuffer(fileInput.buffer) || fileInput.buffer.length === 0) {
    throw new AppError('Logo image file is required.', 400);
  }

  const mimeType = String(fileInput.mimetype || '').toLowerCase();
  if (!ALLOWED_LOGO_MIME_TYPES.includes(mimeType)) {
    throw new AppError(
      `Unsupported logo MIME type "${mimeType}". Allowed: PNG, JPEG, WEBP, SVG, GIF.`,
      400
    );
  }

  if (fileInput.buffer.length > MAX_LOGO_BYTES) {
    throw new AppError('Logo file size cannot exceed 5 MB.', 400);
  }

  // Check if user already had a logoFileId to clean up old asset
  const existingBusiness = await BusinessProfile.findOne({ userId: uid }).lean();
  if (existingBusiness?.logoFileId) {
    const oldMeta = await FileMetadata.findById(existingBusiness.logoFileId).lean();
    if (oldMeta?.cloudinaryPublicId) {
      await deleteFromCloudinary(oldMeta.cloudinaryPublicId);
    }
  }

  const uploadResult = await uploadBufferToCloudinary(fileInput.buffer, {
    mimeType,
    userId: String(uid),
    folder: 'smarttools/business_logos',
  });

  const fileRecord = await FileMetadata.create({
    userId: uid,
    cloudinaryPublicId: uploadResult.publicId,
    secureUrl: uploadResult.secureUrl,
    mimeType,
    bytes: uploadResult.bytes || fileInput.buffer.length,
    originalName: String(fileInput.originalname || 'business-logo.png').trim(),
    entityType: 'business_logo',
  });

  const fileObj =
    typeof fileRecord.toObject === 'function' ? fileRecord.toObject() : fileRecord;

  const updatedBusiness = await BusinessProfile.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        logoUrl: uploadResult.secureUrl,
        logoFileId: fileObj._id,
      },
    },
    { new: true, upsert: true }
  ).lean();

  return {
    logoUrl: uploadResult.secureUrl,
    logoFileId: String(fileObj._id),
    isFallback: uploadResult.isFallback,
    fileMetadata: fileObj,
    businessProfile: updatedBusiness,
  };
}

export default {
  getMyProfiles,
  updatePersonalProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
};
