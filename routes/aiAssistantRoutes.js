import express from 'express';
import { handleAIChat } from '../controllers/aiAssistantController.js';

const router = express.Router();

// The single endpoint for the Visual AI Assistant
router.post('/chat', handleAIChat);

export default router;
