import { Router } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const customerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    billingAddress: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    shippingAddress: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    notes: { type: String, trim: true, default: '' },
  },
  { collection: 'customers', timestamps: true }
);
customerSchema.index({ userId: 1, name: 1 });

export const Customer =
  mongoose.models.Customer || mongoose.model('Customer', customerSchema);

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(String(req.user.id));
    const filter = { userId };

    if (req.query.search && String(req.query.search).trim()) {
      const escaped = String(req.query.search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: customers });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(String(req.user.id));
    const name = String(req.body?.name || '').trim();
    if (!name) {
      throw new AppError('Customer name is required', 400);
    }

    const created = await Customer.create({
      userId,
      name,
      companyName: String(req.body?.companyName || '').trim(),
      email: String(req.body?.email || '').trim(),
      phone: String(req.body?.phone || '').trim(),
      taxId: String(req.body?.taxId || '').trim(),
      billingAddress: req.body?.billingAddress || {},
      shippingAddress: req.body?.shippingAddress || {},
      notes: String(req.body?.notes || '').trim(),
    });

    return res.status(201).json({
      success: true,
      data: typeof created.toObject === 'function' ? created.toObject() : created,
    });
  })
);

export default router;
