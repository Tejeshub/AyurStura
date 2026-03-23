/**
 * Doctor routes - list/get doctors (public), /me and /me/availability (doctor only).
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/authMiddleware.js';
import * as doctorController from '../controllers/doctorController.js';

const router = express.Router();

router.get('/', doctorController.list);

// Specific doctor self routes must come before the generic :id route
router.get('/me', authMiddleware, roleMiddleware('doctor'), doctorController.getMe);
router.patch('/me', authMiddleware, roleMiddleware('doctor'), doctorController.updateMe);
router.get('/me/availability', authMiddleware, roleMiddleware('doctor'), doctorController.getAvailability);
router.put('/me/availability', authMiddleware, roleMiddleware('doctor'), doctorController.setAvailability);
router.get('/me/unavailable-days', authMiddleware, roleMiddleware('doctor'), doctorController.listUnavailableDays);
router.post('/me/unavailable-days', authMiddleware, roleMiddleware('doctor'), doctorController.addUnavailableDay);
router.delete('/me/unavailable-days/:date', authMiddleware, roleMiddleware('doctor'), doctorController.removeUnavailableDay);

router.get('/:id/unavailable-days', doctorController.getUnavailableDaysById);
router.get('/:id', doctorController.getById);

export default router;
