import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import {
  generateProposal,
  createProposal,
  getMyProposals,
  getProposalById,
  updateProposal,
  deleteProposal,
  getAdminProposals,
} from '../controllers/proposalController.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const proposalGenerateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: () => {
    const configured = Number(process.env.RATE_LIMIT_PROPOSAL_GEN_PER_15MIN);
    return Number.isInteger(configured) && configured > 0 ? configured : 15;
  },
  keyGenerator: (req) => String(req.user?._id || req.user?.id || req.ip || 'anon'),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message:
        'Too many AI proposal generation requests. Please wait a few minutes and try again.',
      error: {
        code: 'RATE_LIMITED',
        message:
          'Too many AI proposal generation requests. Please wait a few minutes and try again.',
      },
    }),
});

const router = Router();

// All AI Proposal Writer routes require authentication
router.use(requireAuth);

// Static routes must precede parameterized `/:id` routes
router.post('/generate', proposalGenerateLimiter, generateProposal);
router.get('/my', getMyProposals);
router.get('/admin', requireAdmin, getAdminProposals);

router.post('/', createProposal);
router.get('/:id', getProposalById);
router.put('/:id', updateProposal);
router.delete('/:id', deleteProposal);

export default router;
