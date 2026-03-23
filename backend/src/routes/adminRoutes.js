/**
 * Admin routes - all require auth + admin role.
 */
import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.get('/appointments', adminController.listAppointments);
router.get('/doctors', adminController.listDoctors);
router.post('/doctors', adminController.createDoctor);
router.get('/doctors/:id/profile', adminController.getDoctorProfile);
router.get('/doctors/:id/availability', adminController.getDoctorAvailability);
router.put('/doctors/:id/availability', adminController.setDoctorAvailability);
router.get('/doctors/:id/unavailable-days', adminController.getDoctorUnavailableDays);
router.post('/doctors/:id/unavailable-days', adminController.addDoctorUnavailableDay);
router.delete('/doctors/:id/unavailable-days/:date', adminController.removeDoctorUnavailableDay);
router.patch('/doctors/:id', adminController.updateDoctor);
router.delete('/doctors/:id', adminController.deleteDoctor);
router.get('/patients', adminController.listPatients);
router.get('/analytics', adminController.getAnalytics);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);

export default router;
