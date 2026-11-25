import mongoose from 'mongoose';

/**
 * File Metadata Model (`file_metadata` collection)
 * Tracks uploaded business logos and user assets stored in Cloudinary (or local dev fallback).
 */

const fileMetadataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      trim: true,
    },
    secureUrl: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    bytes: {
      type: Number,
      required: true,
      default: 0,
    },
    originalName: {
      type: String,
      trim: true,
      default: '',
    },
    entityType: {
      type: String,
      enum: ['business_logo', 'user_avatar', 'attachment'],
      default: 'business_logo',
    },
  },
  {
    collection: 'file_metadata',
    timestamps: true,
  }
);

fileMetadataSchema.index({ userId: 1, entityType: 1 });

export const FileMetadata =
  mongoose.models.FileMetadata ||
  mongoose.model('FileMetadata', fileMetadataSchema);

export default FileMetadata;
