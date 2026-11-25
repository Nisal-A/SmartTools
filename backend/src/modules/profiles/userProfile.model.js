import mongoose from 'mongoose';

/**
 * User Profile Model (`user_profiles` collection)
 * Stores personal details isolated from authentication credentials and business profile.
 */

const userProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: '',
    },
    jobTitle: {
      type: String,
      trim: true,
      default: '',
    },
    timezone: {
      type: String,
      trim: true,
      default: 'UTC',
    },
    locale: {
      type: String,
      trim: true,
      default: 'en-US',
    },
  },
  {
    collection: 'user_profiles',
    timestamps: true,
  }
);

userProfileSchema.index({ userId: 1 }, { unique: true });

export const UserProfile =
  mongoose.models.UserProfile ||
  mongoose.model('UserProfile', userProfileSchema);

export default UserProfile;
