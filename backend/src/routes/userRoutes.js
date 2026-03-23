/**
 * User routes - /api/users/me (get/update profile). All require auth.
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import * as userController from '../controllers/userController.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);

export default router;
