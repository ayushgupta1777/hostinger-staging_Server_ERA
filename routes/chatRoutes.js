import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { getOrCreateChat, getMessages, getAdminConversations } from '../controllers/chatController.js';

const router = express.Router();

// User Routes
router.get('/user', protect, getOrCreateChat);
router.get('/:chatId/messages', protect, getMessages);

// Admin Routes
router.get('/admin/conversations', protect, admin, getAdminConversations);

export default router;
