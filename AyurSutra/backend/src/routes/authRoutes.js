/**
 * Auth routes - register, login, logout, refresh.
 * All use POST. Cookies are set by controller.
 */
import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);

export default router;
