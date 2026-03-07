import express from 'express';
import { getSettings, getSettingByKey, updateSetting } from '../controllers/appSettingController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly accessible for the app (e.g. at checkout)
router.get('/', getSettings);
router.get('/:key', getSettingByKey);

// Only admins can update settings
router.put('/', protect, restrictTo('admin'), updateSetting);

export default router;
