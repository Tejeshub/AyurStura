/**
 * API client - axios instance with base URL and credentials (cookies).
 * On 401, trigger logout so AuthContext can clear user and redirect.
 */
import axios from 'axios';

// Use empty string in dev so Vite proxy (/api -> backend) is used and cookies work same-origin
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Optional: attach a listener for 401 to call a global logout (set by AuthContext)
let onUnauthorized = () => {};
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      onUnauthorized();
    }
    return Promise.reject(err);
  }
);

/** Auth */
export function login(data) {
  return api.post('/api/auth/login', data).then((r) => r.data);
}
export function register(data) {
  return api.post('/api/auth/register', data).then((r) => r.data);
}
export function logout() {
  return api.post('/api/auth/logout').then((r) => r.data);
}
export function refresh() {
  return api.post('/api/auth/refresh').then((r) => r.data);
}

/** User */
export function getMe() {
  return api.get('/api/users/me').then((r) => r.data);
}
export function updateMe(data) {
  return api.patch('/api/users/me', data).then((r) => r.data);
}

/** Doctors (public for listing) */
export function getDoctors() {
  return api.get('/api/doctors').then((r) => r.data);
}
export function getDoctor(id) {
  return api.get(`/api/doctors/${id}`).then((r) => r.data);
}
export function getDoctorUnavailableDates(doctorId) {
  return api.get(`/api/doctors/${doctorId}/unavailable-days`).then((r) => r.data);
}

/** Appointments */
export function createAppointment(data) {
  return api.post('/api/appointments', data).then((r) => r.data);
}
export function getAppointments() {
  return api.get('/api/appointments').then((r) => r.data);
}
export function getAppointment(id) {
  return api.get(`/api/appointments/${id}`).then((r) => r.data);
}
export function updateAppointmentStatus(id, status) {
  return api.patch(`/api/appointments/${id}`, { status }).then((r) => r.data);
}
export function getAppointmentAvailableSlots(id, date) {
  return api.get(`/api/appointments/${id}/available-slots`, { params: { date } }).then((r) => r.data);
}
export function confirmAppointment(id, data) {
  return api.post(`/api/appointments/${id}/confirm`, data).then((r) => r.data);
}
export function proposeReschedule(id, data) {
  return api.post(`/api/appointments/${id}/reschedule/propose`, data).then((r) => r.data);
}
export function acceptReschedule(id) {
  return api.post(`/api/appointments/${id}/reschedule/accept`).then((r) => r.data);
}
export function rejectReschedule(id) {
  return api.post(`/api/appointments/${id}/reschedule/reject`).then((r) => r.data);
}
export function cancelAppointment(id) {
  return api.post(`/api/appointments/${id}/cancel`).then((r) => r.data);
}

/** Doctor profile & availability (doctor role) */
export function getDoctorMe() {
  return api.get('/api/doctors/me').then((r) => r.data);
}
export function updateDoctorMe(data) {
  return api.patch('/api/doctors/me', data).then((r) => r.data);
}
export function getDoctorAvailability() {
  return api.get('/api/doctors/me/availability').then((r) => r.data);
}
export function setDoctorAvailability(slots) {
  return api.put('/api/doctors/me/availability', slots).then((r) => r.data);
}
export function getDoctorUnavailableDays() {
  return api.get('/api/doctors/me/unavailable-days').then((r) => r.data);
}
export function addDoctorUnavailableDay(data) {
  return api.post('/api/doctors/me/unavailable-days', data).then((r) => r.data);
}
export function removeDoctorUnavailableDay(date) {
  return api.delete(`/api/doctors/me/unavailable-days/${date}`).then((r) => r.data);
}

/** Admin */
export function getAdminAppointments() {
  return api.get('/api/admin/appointments').then((r) => r.data);
}
export function getAdminDoctors() {
  return api.get('/api/admin/doctors').then((r) => r.data);
}
export function createAdminDoctor(data) {
  return api.post('/api/admin/doctors', data).then((r) => r.data);
}
export function updateAdminDoctor(id, data) {
  return api.patch(`/api/admin/doctors/${id}`, data).then((r) => r.data);
}
export function deleteAdminDoctor(id) {
  return api.delete(`/api/admin/doctors/${id}`);
}
export function getAdminDoctorProfile(id) {
  return api.get(`/api/admin/doctors/${id}/profile`).then((r) => r.data);
}
export function getAdminDoctorAvailability(id) {
  return api.get(`/api/admin/doctors/${id}/availability`).then((r) => r.data);
}
export function setAdminDoctorAvailability(id, slots) {
  return api.put(`/api/admin/doctors/${id}/availability`, slots).then((r) => r.data);
}
export function getAdminDoctorUnavailableDays(id) {
  return api.get(`/api/admin/doctors/${id}/unavailable-days`).then((r) => r.data);
}
export function addAdminDoctorUnavailableDay(id, data) {
  return api.post(`/api/admin/doctors/${id}/unavailable-days`, data).then((r) => r.data);
}
export function removeAdminDoctorUnavailableDay(id, date) {
  return api.delete(`/api/admin/doctors/${id}/unavailable-days/${date}`).then((r) => r.data);
}
export function getAdminPatients() {
  return api.get('/api/admin/patients').then((r) => r.data);
}
export function getAdminAnalytics() {
  return api.get('/api/admin/analytics').then((r) => r.data);
}
export function getAdminSettings() {
  return api.get('/api/admin/settings').then((r) => r.data);
}
export function updateAdminSettings(data) {
  return api.patch('/api/admin/settings', data).then((r) => r.data);
}

/** Chatbot */
export function sendChatbotMessage(data) {
  return api.post('/api/chatbot/message', data).then((r) => r.data);
}
