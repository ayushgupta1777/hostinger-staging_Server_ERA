import express from 'express';
import { getSettings, getSettingByKey, updateSetting, releaseUpdate } from '../controllers/appSettingController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Publicly accessible for the app (e.g. at checkout)
router.get('/', getSettings);
router.get('/:key', getSettingByKey);

// Admins and developers can update settings
router.put('/', protect, authorize('admin', 'developer'), updateSetting);
router.post('/release-update', protect, authorize('admin', 'developer'), releaseUpdate);

export default router;
