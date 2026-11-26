import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import { AppError } from '../utils/AppError.js';
import {
  ALLOWED_EXPENSE_MIME_TYPES,
  MAX_EXPENSE_ATTACHMENT_BYTES,
} from '../utils/cloudinaryUpload.js';
import {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  upsertCategoryBudget,
  getAdminExpenses,
} from '../controllers/expenseController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_EXPENSE_ATTACHMENT_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_EXPENSE_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(
          'Unsupported file type. Allowed types: JPEG, PNG, WEBP, and PDF.',
          400
        )
      );
    }
    return cb(null, true);
  },
});

function handleReceiptUpload(req, res, next) {
  upload.single('receipt')(req, res, (err) => {
    if (!err) {
      return next();
    }

    let message = err.message || 'Invalid receipt attachment upload.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size (5 MB).';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected upload field. Use "receipt" for receipt attachments.';
    }

    return res.status(400).json({
      success: false,
      message,
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
  });
}

const router = Router();

// All Expense Tracker routes require authentication with strict user isolation
router.use(requireAuth);

// Static paths must precede parameterized `/:id` routes
router.get('/summary', getExpenseSummary);
router.put('/budgets', upsertCategoryBudget);
router.get('/admin', requireAdmin, getAdminExpenses);

router.get('/', listExpenses);
router.post('/', handleReceiptUpload, createExpense);
router.put('/:id', handleReceiptUpload, updateExpense);
router.delete('/:id', deleteExpense);

export default router;
