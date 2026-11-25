import { Router } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware.js';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  meController,
  updatePinnedToolsController,
  updatePasswordController,
} from './auth.controller.js';
import { User } from './user.model.js';
import { BusinessProfile } from '../profiles/businessProfile.model.js';
import { UserProfile } from '../profiles/userProfile.model.js';

export { User, BusinessProfile, UserProfile };

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/refresh', refreshController);
router.post('/logout', optionalAuth, logoutController);
router.get('/me', requireAuth, meController);
router.patch('/me/pinned-tools', requireAuth, updatePinnedToolsController);
router.patch('/me/password', requireAuth, updatePasswordController);

export default router;
