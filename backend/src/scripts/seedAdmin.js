import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User, DEFAULT_PINNED_TOOLS } from '../modules/authentication/user.model.js';
import { BCRYPT_SALT_ROUNDS } from '../modules/authentication/auth.service.js';
import { UserProfile } from '../modules/profiles/userProfile.model.js';
import { BusinessProfile } from '../modules/profiles/businessProfile.model.js';

const __scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__scriptDir, '../../.env') });

/**
 * Idempotent Admin Bootstrap Script (`backend/src/scripts/seedAdmin.js`)
 *
 * Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables
 * (with safe local defaults if unset) and ensures an active `role: 'admin'`
 * user and corresponding `user_profiles` & `business_profiles` records exist.
 *
 * Running multiple times is completely idempotent and never creates duplicates.
 */
export async function seedAdmin(options = {}) {
  const adminEmail = String(
    options.email || process.env.ADMIN_EMAIL || 'admin@smarttools.dev'
  )
    .trim()
    .toLowerCase();

  const adminPassword = String(
    options.password || process.env.ADMIN_PASSWORD || 'Admin@123456'
  );

  const adminName = String(
    options.fullName || process.env.ADMIN_NAME || 'SmartTools Administrator'
  ).trim();

  if (!adminEmail || !adminPassword || adminPassword.length < 6) {
    throw new Error(
      'seedAdmin requires valid ADMIN_EMAIL and ADMIN_PASSWORD (min 6 chars).'
    );
  }

  const isCliDirect =
    process.argv[1] &&
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

  const dbStatus = await connectDatabase(undefined, {
    allowInMemoryFallback:
      options.allowInMemoryFallback ?? !isCliDirect,
  });

  let existingAdmin = await User.findOne({ email: adminEmail }).lean();
  let created = false;
  let adminUser;

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);
    const createdDoc = await User.create({
      email: adminEmail,
      passwordHash,
      fullName: adminName,
      role: 'admin',
      isActive: true,
      pinnedToolIds: [...DEFAULT_PINNED_TOOLS],
      lastLoginAt: null,
    });
    adminUser = typeof createdDoc.toObject === 'function' ? createdDoc.toObject() : createdDoc;
    created = true;
  } else {
    // Ensure role is 'admin' and account is active (idempotent update)
    const updatedDoc = await User.findByIdAndUpdate(
      existingAdmin._id,
      {
        $set: {
          role: 'admin',
          isActive: true,
        },
      },
      { new: true }
    ).lean();
    adminUser = updatedDoc || existingAdmin;
    created = false;
  }

  const userId = adminUser._id;

  // Idempotently ensure UserProfile and BusinessProfile exist for the admin
  await Promise.all([
    UserProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          fullName: adminName,
          phone: '',
          avatarUrl: '',
          timezone: 'UTC',
          locale: 'en-US',
        },
      },
      { new: true, upsert: true }
    ),
    BusinessProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          businessName: 'SmartTools HQ',
          email: adminEmail,
          defaultCurrency: 'USD',
          defaultTaxRate: 0,
          defaultPaymentTerms: 'Net 30 days',
          defaultInvoiceSize: 'A4',
          defaultQuotationSize: 'A4',
        },
      },
      { new: true, upsert: true }
    ),
  ]);

  return {
    created,
    dbName: dbStatus.dbName,
    inMemory: dbStatus.isInMemoryMode,
    admin: {
      id: String(adminUser._id),
      email: adminUser.email,
      role: adminUser.role,
      isActive: adminUser.isActive,
    },
  };
}

// Execute directly when invoked via `node src/scripts/seedAdmin.js`
const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFilePath === executedFilePath) {
  seedAdmin()
    .then((result) => {
      const targetLabel = result.inMemory
        ? 'in-memory'
        : `MongoDB (${result.dbName})`;
      if (result.created) {
        console.log(
          `[seedAdmin] Created initial admin user in ${targetLabel}: ${result.admin.email} (id: ${result.admin.id})`
        );
      } else {
        console.log(
          `[seedAdmin] Verified existing admin user in ${targetLabel}: ${result.admin.email} (id: ${result.admin.id})`
        );
      }
      return disconnectDatabase();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seedAdmin] Failed:', err.message);
      process.exit(1);
    });
}

export default seedAdmin;
