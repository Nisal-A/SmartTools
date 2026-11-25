import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { BusinessProfile, User } from '../authentication/auth.routes.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(String(req.user.id));
    const [user, businessProfile] = await Promise.all([
      User.findById(userId).lean(),
      BusinessProfile.findOne({ userId }).lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        personalProfile: user
          ? {
              id: String(user._id),
              fullName: user.fullName,
              email: user.email,
              role: user.role,
            }
          : null,
        businessProfile: businessProfile || null,
      },
    });
  })
);

router.put(
  '/business',
  asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(String(req.user.id));
    const updated = await BusinessProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          businessName: req.body?.businessName ?? '',
          taxRegistrationNo: req.body?.taxRegistrationNo ?? '',
          email: req.body?.email ?? '',
          phone: req.body?.phone ?? '',
          logoUrl: req.body?.logoUrl ?? '',
          address: req.body?.address ?? {},
          bankDetails: req.body?.bankDetails ?? {},
          defaultCurrency: req.body?.defaultCurrency ?? 'USD',
          defaultTaxRate: Number(req.body?.defaultTaxRate) || 0,
          defaultPaymentTerms: req.body?.defaultPaymentTerms ?? 'Net 30 days',
          defaultInvoiceSize: req.body?.defaultInvoiceSize ?? 'A4',
          defaultQuotationSize: req.body?.defaultQuotationSize ?? 'A4',
        },
      },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      data: updated,
    });
  })
);

export default router;
