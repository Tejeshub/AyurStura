/**
 * Doctor dashboard - tabs: Appointments, Schedule, Patients.
 * Profile/settings are accessible by clicking the user name/avatar in the header.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  getAppointments,
  getDoctorAvailability,
  setDoctorAvailability,
  getDoctorUnavailableDays,
  addDoctorUnavailableDay,
  removeDoctorUnavailableDay,
  getAppointmentAvailableSlots,
  confirmAppointment,
  proposeReschedule,
} from '../services/api';
import './DoctorDashboard.css';

const DAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
];

const TABS = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'patients', label: 'Patients' },
];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleForm, setScheduleForm] = useState(
    DAYS.map((d) => ({
      day_of_week: d.day,
      start_time: '09:00',
      end_time: '17:00',
      is_available: d.day >= 1 && d.day <= 5,
    }))
  );
  const [message, setMessage] = useState({ type: '', text: '' });
  const [slotPicker, setSlotPicker] = useState({ apptId: null, mode: null }); // mode: 'confirm' | 'reschedule'
  const [slotDate, setSlotDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotTime, setSlotTime] = useState('');
  const [unavailableDate, setUnavailableDate] = useState('');
  const [unavailableDays, setUnavailableDays] = useState([]);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    try {
      const [apptList, avail, unavail] = await Promise.all([
        getAppointments(),
        getDoctorAvailability(),
        getDoctorUnavailableDays(),
      ]);
      setAppointments(apptList);
      setUnavailableDays(unavail || []);
      if (avail && avail.length) {
        const byDay = {};
        avail.forEach((a) => { byDay[a.day_of_week] = a; });
        setScheduleForm(
          DAYS.map((d) => {
            const existing = byDay[d.day];
            return existing
              ? { day_of_week: d.day, start_time: existing.start_time?.slice(0, 5) || '09:00', end_time: existing.end_time?.slice(0, 5) || '17:00', is_available: !!existing.is_available }
              : { day_of_week: d.day, start_time: '09:00', end_time: '17:00', is_available: d.day >= 1 && d.day <= 5 };
          })
        );
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }

  const openSlotPicker = async (appt, mode) => {
    try {
      setMessage({ type: '', text: '' });
      setSlotPicker({ apptId: appt.id, mode });
      const initialDate = mode === 'confirm' ? appt.appointment_date : (appt.confirmed_date || appt.appointment_date);
      setSlotDate(initialDate);
      setSlotTime('');
      const data = await getAppointmentAvailableSlots(appt.id, initialDate);
      setAvailableSlots(data.slots || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load slots' });
    }
  };

  const reloadSlots = async () => {
    if (!slotPicker.apptId || !slotDate) return;
    const data = await getAppointmentAvailableSlots(slotPicker.apptId, slotDate);
    setAvailableSlots(data.slots || []);
    setSlotTime('');
  };

  const handleConfirmWithSlot = async () => {
    try {
      if (!slotPicker.apptId || !slotDate || !slotTime) {
        setMessage({ type: 'error', text: 'Please select date and time slot' });
        return;
      }
      await confirmAppointment(slotPicker.apptId, { confirmed_date: slotDate, confirmed_time: slotTime });
      setMessage({ type: 'success', text: 'Appointment confirmed and email sent.' });
      setAppointments(await getAppointments());
      setSlotPicker({ apptId: null, mode: null });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleProposeReschedule = async () => {
    try {
      if (!slotPicker.apptId || !slotDate || !slotTime) {
        setMessage({ type: 'error', text: 'Please select new date and time slot' });
        return;
      }
      await proposeReschedule(slotPicker.apptId, { reschedule_proposed_date: slotDate, reschedule_proposed_time: slotTime });
      setMessage({ type: 'success', text: 'Reschedule proposed and email sent to patient.' });
      setAppointments(await getAppointments());
      setSlotPicker({ apptId: null, mode: null });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleSaveAvailability = async (e) => {
    e.preventDefault();
    try {
      await setDoctorAvailability(scheduleForm.filter((s) => s.is_available));
      setMessage({ type: 'success', text: 'Availability saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const todayAppointments = appointments.filter((a) => a.appointment_date === new Date().toISOString().slice(0, 10));
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;

  if (loading) {
    return (
      <DashboardLayout role="doctor" onProfileClick={() => navigate('/dashboard/doctor/profile')}>
        <div className="dashboard-loading">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor" onProfileClick={() => navigate('/dashboard/doctor/profile')}>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <p>Today&apos;s Appointments</p>
            <h3>{todayAppointments.length}</h3>
          </div>
          <div className="stat-icon">📅</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>Pending Approvals</p>
            <h3>{pendingCount}</h3>
          </div>
          <div className="stat-icon">🕐</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>Total</p>
            <h3>{appointments.length}</h3>
          </div>
          <div className="stat-icon">✅</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message.text && <div className={`message-banner ${message.type}`}>{message.text}</div>}

      {activeTab === 'appointments' && (
        <div className="appointments-card">
          <h3>Appointments</h3>
          <div className="appointments-list">
            {appointments.length === 0 ? (
              <p className="muted">No appointments.</p>
            ) : (
              appointments.map((a) => (
                <div key={a.id} className={`appointment-item ${a.status}`}>
                  <div className="appointment-info">
                    <h4>{a.patient_name}</h4>
                    <p>{a.patient_email}</p>
                    <div className="appointment-details">
                      <span>📅 Preferred: {a.appointment_date}</span>
                      <span>🕐 Confirmed: {a.confirmed_time ? `${a.confirmed_date} ${a.confirmed_time.slice(0, 5)}` : 'TBD'}</span>
                      <span>Type: {a.type}</span>
                    </div>
                    {a.status === 'reschedule_proposed' && (
                      <p><strong>Proposed:</strong> {a.reschedule_proposed_date} {a.reschedule_proposed_time?.slice(0, 5)}</p>
                    )}
                    {a.symptoms && <p><strong>Symptoms:</strong> {a.symptoms}</p>}
                  </div>
                  <div className="appointment-actions">
                    <span className={`status-badge ${a.status}`}>{a.status}</span>
                    {a.status === 'pending' && (
                      <>
                        <button type="button" className="action-btn confirm" onClick={() => openSlotPicker(a, 'confirm')}>🕐 Pick Slot & Confirm</button>
                      </>
                    )}
                    {['confirmed', 'reschedule_required'].includes(a.status) && (
                      <button type="button" className="action-btn cancel" onClick={() => openSlotPicker(a, 'reschedule')}>🔁 Propose Reschedule</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {slotPicker.apptId && (
            <div className="schedule-card" style={{ marginTop: 16 }}>
              <h3>{slotPicker.mode === 'confirm' ? 'Confirm appointment slot' : 'Propose new slot (patient must accept)'}</h3>
              <div className="availability-item" style={{ alignItems: 'center' }}>
                <div className="time-inputs">
                  <input
                    type="date"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                  />
                  <button type="button" className="update-btn" onClick={reloadSlots}>Load Slots</button>
                  <select value={slotTime} onChange={(e) => setSlotTime(e.target.value)}>
                    <option value="">Select 1-hour slot</option>
                    {availableSlots.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {slotPicker.mode === 'confirm' ? (
                    <button type="button" className="action-btn confirm" onClick={handleConfirmWithSlot}>✅ Confirm</button>
                  ) : (
                    <button type="button" className="action-btn confirm" onClick={handleProposeReschedule}>📩 Send Proposal</button>
                  )}
                  <button type="button" className="action-btn cancel" onClick={() => setSlotPicker({ apptId: null, mode: null })}>Close</button>
                </div>
              </div>
              <p className="muted">Break time is fixed: 1 PM to 2 PM (no slots).</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="schedule-card">
          <h3>⚙️ Manage Availability</h3>
          <form onSubmit={handleSaveAvailability}>
            <div className="availability-list">
              {DAYS.map((d) => {
                const slot = scheduleForm.find((s) => s.day_of_week === d.day) || scheduleForm[0];
                const idx = scheduleForm.findIndex((s) => s.day_of_week === d.day);
                return (
                  <div key={d.day} className="availability-item">
                    <div className="day-toggle">
                      <input
                        type="checkbox"
                        id={`day-${d.day}`}
                        checked={slot?.is_available ?? false}
                        onChange={(e) => {
                          const next = [...scheduleForm];
                          if (idx >= 0) next[idx] = { ...next[idx], is_available: e.target.checked };
                          else next.push({ day_of_week: d.day, start_time: '09:00', end_time: '17:00', is_available: e.target.checked });
                          setScheduleForm(next);
                        }}
                      />
                      <label htmlFor={`day-${d.day}`}>{d.label}</label>
                    </div>
                    <div className="time-inputs">
                      <input
                        type="time"
                        value={slot?.start_time || '09:00'}
                        onChange={(e) => {
                          const next = [...scheduleForm];
                          if (idx >= 0) next[idx] = { ...next[idx], start_time: e.target.value };
                          else next.push({ day_of_week: d.day, start_time: e.target.value, end_time: '17:00', is_available: true });
                          setScheduleForm(next);
                        }}
                      />
                      to
                      <input
                        type="time"
                        value={slot?.end_time || '17:00'}
                        onChange={(e) => {
                          const next = [...scheduleForm];
                          if (idx >= 0) next[idx] = { ...next[idx], end_time: e.target.value };
                          else next.push({ day_of_week: d.day, start_time: '09:00', end_time: e.target.value, is_available: true });
                          setScheduleForm(next);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="submit" className="update-btn">Save Availability</button>
          </form>

          <div style={{ marginTop: 20 }}>
            <h3>🚨 Emergency Unavailable (Full Day)</h3>
            <p className="muted">Mark a date as unavailable. Confirmed appointments on that date will be moved to reschedule_required and patients will be emailed.</p>
            <div className="time-inputs">
              <input type="date" value={unavailableDate} onChange={(e) => setUnavailableDate(e.target.value)} />
              <button
                type="button"
                className="update-btn"
                onClick={async () => {
                  try {
                    if (!unavailableDate) {
                      setMessage({ type: 'error', text: 'Please select a date' });
                      return;
                    }
                    await addDoctorUnavailableDay({ unavailable_date: unavailableDate });
                    setMessage({ type: 'success', text: 'Unavailable day saved. Affected patients notified.' });
                    loadData();
                  } catch (err) {
                    setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
                  }
                }}
              >
                Mark Unavailable Day
              </button>
            </div>
            <h4 style={{ marginTop: '1rem' }}>Current Unavailable Days</h4>
            <div className="unavailable-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {unavailableDays.length === 0 ? (
                <p className="muted">None.</p>
              ) : (
                unavailableDays.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                    <span>{u.unavailable_date}</span>
                    {u.reason && <small style={{ color: '#6b7280' }}>{u.reason}</small>}
                    <button
                      type="button"
                      className="action-btn cancel"
                      onClick={async () => {
                        try {
                          const d = u.unavailable_date;
                          const dateStr = typeof d === 'string' ? d.slice(0, 10) : (d && d.toISOString ? d.toISOString().slice(0, 10) : d);
                          await removeDoctorUnavailableDay(dateStr);
                          setMessage({ type: 'success', text: 'Unavailable day removed.' });
                          loadData();
                        } catch (err) {
                          setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="patients-card">
          <h3>Patient Records</h3>
          <p className="muted">Patients from your appointments.</p>
          <div className="patients-list">
            {appointments.length === 0 ? (
              <p className="muted">No patients yet.</p>
            ) : (
              [...new Map(appointments.map((a) => [a.patient_id, a])).values()].map((a) => (
                <div key={a.patient_id} className="patient-item">
                  <div className="patient-info">
                    <h4>{a.patient_name}</h4>
                    <p>{a.patient_email}</p>
                    <p><strong>Last:</strong> {a.appointment_date} - {a.symptoms?.slice(0, 50)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
