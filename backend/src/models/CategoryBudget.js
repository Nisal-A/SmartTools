import mongoose from 'mongoose';
import { EXPENSE_CATEGORIES } from './Expense.js';

/**
 * CategoryBudget Model (`category_budgets` collection)
 *
 * Stores monthly per-category budget limits scoped strictly per user.
 */

export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const categoryBudgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    month: {
      type: String,
      required: true,
      trim: true,
      match: MONTH_KEY_REGEX,
    },
    category: {
      type: String,
      required: true,
      enum: EXPENSE_CATEGORIES,
    },
    limitAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    collection: 'category_budgets',
    timestamps: true,
  }
);

categoryBudgetSchema.index(
  { userId: 1, month: 1, category: 1 },
  { unique: true }
);

export const CategoryBudget =
  mongoose.models.CategoryBudget ||
  mongoose.model('CategoryBudget', categoryBudgetSchema);

export default CategoryBudget;
