/**
 * Appointment routes - create, list, get one, update status. All require auth.
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import * as appointmentController from '../controllers/appointmentController.js';

const router = express.Router();
router.use(authMiddleware);

router.post('/', appointmentController.create);
router.get('/', appointmentController.list);
router.get('/:id', appointmentController.getById);
router.get('/:id/available-slots', appointmentController.getAvailableSlotsForAppointment);
router.patch('/:id', appointmentController.updateStatus);
router.post('/:id/confirm', appointmentController.confirmWithSlot);
router.post('/:id/cancel', appointmentController.adminCancel);
router.post('/:id/reschedule/propose', appointmentController.proposeReschedule);
router.post('/:id/reschedule/accept', appointmentController.acceptReschedule);
router.post('/:id/reschedule/reject', appointmentController.rejectReschedule);

export default router;
