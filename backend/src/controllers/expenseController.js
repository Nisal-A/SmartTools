import mongoose from 'mongoose';
import {
  Expense,
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from '../models/Expense.js';
import { CategoryBudget, MONTH_KEY_REGEX } from '../models/CategoryBudget.js';
import { User } from '../modules/authentication/user.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  uploadExpenseAttachment,
  deleteExpenseAttachment,
} from '../utils/cloudinaryUpload.js';

/**
 * Expense Tracker & Category Budget Controllers (`/api/expenses`)
 *
 * Every user route is strictly isolated to the authenticated user (`req.user`).
 */

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function requireAuthUserId(req) {
  const rawId = req.user?._id || req.user?.id || null;
  if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw new AppError('Authentication required.', 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function currentUtcMonthKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseMonthRange(monthStr) {
  const clean = String(monthStr || '').trim();
  if (!MONTH_KEY_REGEX.test(clean)) {
    throw new AppError('Month must be in YYYY-MM format (e.g., 2026-11).', 400);
  }
  const [yearStr, monthPart] = clean.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthPart);
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0));
  return { month: clean, startDate, endDate };
}

function parseAmount(rawValue, label = 'Amount') {
  if (
    rawValue === undefined ||
    rawValue === null ||
    String(rawValue).trim() === ''
  ) {
    throw new AppError(`${label} is required.`, 400);
  }
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num < 0) {
    throw new AppError(`${label} must be a non-negative number.`, 400);
  }
  return round2(num);
}

function parseExpenseDate(rawDate) {
  if (
    rawDate === undefined ||
    rawDate === null ||
    String(rawDate).trim() === ''
  ) {
    throw new AppError('Expense date is required.', 400);
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('Expense date must be a valid date.', 400);
  }
  return parsed;
}

function parseExpensePayload(body = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new AppError('Expense title is required.', 400);
    }
    data.title = title;
  }

  if (!partial || body.category !== undefined) {
    const category = String(body.category ?? '').trim();
    if (!EXPENSE_CATEGORIES.includes(category)) {
      throw new AppError(
        `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`,
        400
      );
    }
    data.category = category;
  }

  if (!partial || body.amount !== undefined) {
    data.amount = parseAmount(body.amount, 'Expense amount');
  }

  if (body.currency !== undefined) {
    const currency = String(body.currency || '').trim().toUpperCase();
    data.currency = currency || 'LKR';
  } else if (!partial) {
    data.currency = 'LKR';
  }

  if (!partial || body.expenseDate !== undefined) {
    data.expenseDate = parseExpenseDate(body.expenseDate);
  }

  if (body.paymentMethod !== undefined) {
    const paymentMethod = String(body.paymentMethod || '').trim();
    if (!EXPENSE_PAYMENT_METHODS.includes(paymentMethod)) {
      throw new AppError(
        `Payment method must be one of: ${EXPENSE_PAYMENT_METHODS.join(', ')}.`,
        400
      );
    }
    data.paymentMethod = paymentMethod;
  } else if (!partial) {
    data.paymentMethod = 'Card';
  }

  if (body.vendor !== undefined) {
    data.vendor = String(body.vendor ?? '').trim();
  } else if (!partial) {
    data.vendor = '';
  }

  if (body.notes !== undefined) {
    data.notes = String(body.notes ?? '').trim();
  } else if (!partial) {
    data.notes = '';
  }

  return data;
}

async function findOwnedExpenseOr404(expenseId, userId) {
  if (!expenseId || !mongoose.Types.ObjectId.isValid(String(expenseId))) {
    throw new AppError('Expense not found.', 404);
  }
  const expense = await Expense.findOne({
    _id: new mongoose.Types.ObjectId(String(expenseId)),
    userId,
  }).lean();
  if (!expense) {
    throw new AppError('Expense not found.', 404);
  }
  return expense;
}

function emptyAttachment() {
  return {
    url: '',
    publicId: '',
    originalName: '',
    resourceType: '',
  };
}

function shouldRemoveReceipt(rawFlag) {
  return rawFlag === true || rawFlag === 'true' || rawFlag === '1';
}

function buildSearchRegex(rawSearch) {
  const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
  if (!search) return null;
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

/**
 * Aggregates monthly spend per category using MongoDB's aggregation pipeline when
 * connected to live MongoDB, or an identical in-memory grouping pass under test mode.
 */
async function aggregateMonthlySpendByCategory(userId, startDate, endDate) {
  const matchStage = {
    userId,
    expenseDate: { $gte: startDate, $lt: endDate },
  };

  if (mongoose.connection.readyState === 1) {
    return Expense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          spent: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
    ]);
  }

  const docs = await Expense.find(matchStage).lean();
  const grouped = new Map();
  for (const doc of docs) {
    const existing = grouped.get(doc.category) || {
      _id: doc.category,
      spent: 0,
      transactionCount: 0,
    };
    existing.spent = round2(existing.spent + (Number(doc.amount) || 0));
    existing.transactionCount += 1;
    grouped.set(doc.category, existing);
  }
  return [...grouped.values()];
}

/** `POST /api/expenses` — create expense with optional Cloudinary receipt upload. */
export const createExpense = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const fields = parseExpensePayload(req.body);

  let receiptAttachment = emptyAttachment();
  if (req.file) {
    const uploaded = await uploadExpenseAttachment(req.file.buffer, {
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      userId: String(userId),
    });
    receiptAttachment = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      originalName: req.file.originalname || '',
      resourceType: uploaded.resourceType,
    };
  }

  try {
    const created = await Expense.create({
      ...fields,
      userId,
      receiptAttachment,
    });
    const expense =
      typeof created.toObject === 'function' ? created.toObject() : created;

    return res.status(201).json({
      success: true,
      data: expense,
      expense,
    });
  } catch (err) {
    if (receiptAttachment.publicId) {
      await deleteExpenseAttachment(
        receiptAttachment.publicId,
        receiptAttachment.resourceType
      );
    }
    throw err;
  }
});

/** `GET /api/expenses` — user-scoped list filtered by month, category, and search. */
export const listExpenses = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const filter = { userId };

  if (req.query.month) {
    const { startDate, endDate } = parseMonthRange(req.query.month);
    filter.expenseDate = { $gte: startDate, $lt: endDate };
  }

  const rawCategory =
    typeof req.query.category === 'string' ? req.query.category.trim() : '';
  if (rawCategory && rawCategory.toLowerCase() !== 'all') {
    if (!EXPENSE_CATEGORIES.includes(rawCategory)) {
      throw new AppError(
        `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`,
        400
      );
    }
    filter.category = rawCategory;
  }

  const searchRegex = buildSearchRegex(req.query.search);
  if (searchRegex) {
    filter.$or = [
      { title: searchRegex },
      { vendor: searchRegex },
      { notes: searchRegex },
      { category: searchRegex },
    ];
  }

  const expenses = await Expense.find(filter)
    .sort({ expenseDate: -1, createdAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    count: expenses.length,
    data: expenses,
    expenses,
  });
});

/** `PUT /api/expenses/:id` — owner-only update with receipt replacement or removal. */
export const updateExpense = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const existing = await findOwnedExpenseOr404(req.params.id, userId);
  const updates = parseExpensePayload(req.body, { partial: true });

  const oldPublicId = existing.receiptAttachment?.publicId || '';
  const oldResourceType = existing.receiptAttachment?.resourceType || 'image';
  let newUploadedAttachment = null;
  let shouldDeleteOldAttachment = false;

  if (req.file) {
    const uploaded = await uploadExpenseAttachment(req.file.buffer, {
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      userId: String(userId),
    });
    newUploadedAttachment = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      originalName: req.file.originalname || '',
      resourceType: uploaded.resourceType,
    };
    updates.receiptAttachment = newUploadedAttachment;
    shouldDeleteOldAttachment = Boolean(oldPublicId);
  } else if (shouldRemoveReceipt(req.body?.removeReceipt)) {
    updates.receiptAttachment = emptyAttachment();
    shouldDeleteOldAttachment = Boolean(oldPublicId);
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No editable expense fields were provided.', 400);
  }

  try {
    const updated = await Expense.findOneAndUpdate(
      { _id: existing._id, userId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (shouldDeleteOldAttachment) {
      await deleteExpenseAttachment(oldPublicId, oldResourceType);
    }

    return res.status(200).json({
      success: true,
      data: updated,
      expense: updated,
    });
  } catch (err) {
    if (newUploadedAttachment?.publicId) {
      await deleteExpenseAttachment(
        newUploadedAttachment.publicId,
        newUploadedAttachment.resourceType
      );
    }
    throw err;
  }
});

/** `DELETE /api/expenses/:id` — owner-only delete + Cloudinary cleanup. */
export const deleteExpense = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const existing = await findOwnedExpenseOr404(req.params.id, userId);

  if (existing.receiptAttachment?.publicId) {
    await deleteExpenseAttachment(
      existing.receiptAttachment.publicId,
      existing.receiptAttachment.resourceType
    );
  }

  await Expense.deleteOne({ _id: existing._id, userId });

  return res.status(200).json({
    success: true,
    message: 'Expense deleted successfully.',
    data: { deleted: true, id: String(existing._id) },
  });
});

/** `GET /api/expenses/summary?month=YYYY-MM` — monthly spend & category budget stats. */
export const getExpenseSummary = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const requestedMonth = req.query.month
    ? String(req.query.month).trim()
    : currentUtcMonthKey();
  const { month, startDate, endDate } = parseMonthRange(requestedMonth);

  const [spendRows, budgetDocs] = await Promise.all([
    aggregateMonthlySpendByCategory(userId, startDate, endDate),
    CategoryBudget.find({ userId, month }).lean(),
  ]);

  const spendByCategory = new Map(
    spendRows.map((row) => [
      row._id,
      {
        spent: round2(row.spent || 0),
        transactionCount: Number(row.transactionCount || 0),
      },
    ])
  );
  const budgetByCategory = new Map(
    budgetDocs.map((b) => [b.category, round2(b.limitAmount || 0)])
  );

  let totalSpent = 0;
  let totalBudget = 0;
  let totalTransactions = 0;

  const categories = EXPENSE_CATEGORIES.map((category) => {
    const spendEntry = spendByCategory.get(category) || {
      spent: 0,
      transactionCount: 0,
    };
    const budgetLimit = budgetByCategory.get(category) ?? 0;
    const spent = spendEntry.spent;
    const remaining = round2(Math.max(0, budgetLimit - spent));
    const percentUsed =
      budgetLimit > 0
        ? round2((spent / budgetLimit) * 100)
        : spent > 0
          ? 100
          : 0;

    totalSpent = round2(totalSpent + spent);
    totalBudget = round2(totalBudget + budgetLimit);
    totalTransactions += spendEntry.transactionCount;

    return {
      category,
      spent,
      budgetLimit,
      remaining,
      percentUsed,
      transactionCount: spendEntry.transactionCount,
      isOverBudget: budgetLimit > 0 && spent > budgetLimit,
    };
  });

  const totalRemaining = round2(Math.max(0, totalBudget - totalSpent));
  const percentUsed =
    totalBudget > 0
      ? round2((totalSpent / totalBudget) * 100)
      : totalSpent > 0
        ? 100
        : 0;

  const summaryPayload = {
    month,
    totalSpent,
    totalBudget,
    totalRemaining,
    percentUsed,
    totalTransactions,
    categories,
  };

  return res.status(200).json({
    success: true,
    ...summaryPayload,
    data: summaryPayload,
  });
});

/** `PUT /api/expenses/budgets` — upsert monthly limit for a category (or batch). */
export const upsertCategoryBudget = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const { month } = parseMonthRange(req.body?.month);

  if (Array.isArray(req.body?.budgets)) {
    if (req.body.budgets.length === 0) {
      throw new AppError('Budgets array cannot be empty.', 400);
    }

    const validatedEntries = req.body.budgets.map((entry) => {
      const category = String(entry?.category ?? '').trim();
      if (!EXPENSE_CATEGORIES.includes(category)) {
        throw new AppError(
          `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`,
          400
        );
      }
      const limitAmount = parseAmount(entry?.limitAmount, 'Budget limit');
      return { category, limitAmount };
    });

    const savedBudgets = await Promise.all(
      validatedEntries.map((entry) =>
        CategoryBudget.findOneAndUpdate(
          { userId, month, category: entry.category },
          { $set: { limitAmount: entry.limitAmount } },
          { upsert: true, new: true, runValidators: true }
        ).lean()
      )
    );

    return res.status(200).json({
      success: true,
      data: savedBudgets,
      budgets: savedBudgets,
    });
  }

  const category = String(req.body?.category ?? '').trim();
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new AppError(
      `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`,
      400
    );
  }
  const limitAmount = parseAmount(req.body?.limitAmount, 'Budget limit');

  const budget = await CategoryBudget.findOneAndUpdate(
    { userId, month, category },
    { $set: { limitAmount } },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  return res.status(200).json({
    success: true,
    data: budget,
    budget,
  });
});

/** `GET /api/expenses/admin` — admin-only paginated overview across all users. */
export const getAdminExpenses = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(String(req.query.page || '1'), 10) || 1
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20)
  );
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.month) {
    const { startDate, endDate } = parseMonthRange(req.query.month);
    filter.expenseDate = { $gte: startDate, $lt: endDate };
  }

  const rawCategory =
    typeof req.query.category === 'string' ? req.query.category.trim() : '';
  if (rawCategory && rawCategory.toLowerCase() !== 'all') {
    if (!EXPENSE_CATEGORIES.includes(rawCategory)) {
      throw new AppError(
        `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}.`,
        400
      );
    }
    filter.category = rawCategory;
  }

  const searchRegex = buildSearchRegex(req.query.search);
  if (searchRegex) {
    filter.$or = [
      { title: searchRegex },
      { vendor: searchRegex },
      { notes: searchRegex },
      { category: searchRegex },
    ];
  }

  const [total, rawExpenses] = await Promise.all([
    Expense.countDocuments(filter),
    Expense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const ownerIds = [
    ...new Set(
      rawExpenses
        .map((exp) => (exp.userId ? String(exp.userId) : null))
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const ownerMap = new Map();
  if (ownerIds.length > 0) {
    const users = await User.find({ _id: { $in: ownerIds } }).lean();
    for (const u of users) {
      ownerMap.set(String(u._id), {
        id: String(u._id),
        email: u.email || '',
        fullName: u.fullName || '',
      });
    }
  }

  const expenses = rawExpenses.map((exp) => ({
    ...exp,
    owner: exp.userId
      ? ownerMap.get(String(exp.userId)) || { id: String(exp.userId) }
      : null,
  }));

  return res.status(200).json({
    success: true,
    data: expenses,
    expenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    },
  });
});

export default {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  upsertCategoryBudget,
  getAdminExpenses,
};
