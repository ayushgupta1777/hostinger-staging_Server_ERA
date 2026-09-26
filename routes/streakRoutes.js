import express from 'express';
import { syncActivity, getStreakData } from '../controllers/streakController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All streak routes require authentication

router.route('/')
  .get(getStreakData);

router.route('/sync')
  .post(syncActivity);

export default router;
