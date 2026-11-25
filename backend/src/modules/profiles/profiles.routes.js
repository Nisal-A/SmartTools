import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  getMyProfilesController,
  updatePersonalProfileController,
  updateBusinessProfileController,
  uploadBusinessLogoController,
} from './profiles.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
});

const router = Router();

router.use(requireAuth);

router.get('/me', getMyProfilesController);
router.put('/personal', updatePersonalProfileController);
router.put('/business', updateBusinessProfileController);
router.post('/business/logo', upload.any(), uploadBusinessLogoController);

export default router;
