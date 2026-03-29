import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getAllUsersMaster,
    getUserActivityHistory,
    forceResetPassword
} from '../controllers/developerController.js';

const router = express.Router();

// ALL ROUTES ARE RESTRICTED TO DEVELOPERS ONLY
router.use(protect, authorize('developer'));

// Master User Data
router.get('/users', getAllUsersMaster);
router.post('/users/:userId/reset-password', forceResetPassword);

// Activity Monitoring
router.get('/activity/:userId', getUserActivityHistory);

export default router;
