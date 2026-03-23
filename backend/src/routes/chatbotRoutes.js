import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/authMiddleware.js';
import { chatMessage } from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/message', authMiddleware, roleMiddleware('patient', 'doctor', 'admin'), chatMessage);

export default router;
