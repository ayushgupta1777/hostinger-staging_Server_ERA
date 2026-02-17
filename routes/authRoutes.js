// ============================================
// backend/routes/authRoutes.js
// ============================================
import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  sendOTP,
  verifyOTP,
  logout
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { registerValidation, loginValidation, validate } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/send-otp', protect, sendOTP);
router.post('/verify-otp', protect, verifyOTP);

export default router;