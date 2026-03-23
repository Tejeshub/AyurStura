/**
 * Patient dashboard - tabs: Book Appointment, My Appointments.
 * Profile is accessible by clicking the user name/avatar in the header.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { getDoctors, getDoctorUnavailableDates, createAppointment, getAppointments, acceptReschedule, rejectReschedule } from '../services/api';
import './PatientDashboard.css';

const TABS = [
  { id: 'book', label: '📅 Book Appointment' },
  { id: 'appointments', label: '📋 My Appointments' },
];

const APPOINTMENT_TYPES = [
  { value: 'consultation', label: 'Initial Consultation' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'panchakarma', label: 'Panchakarma Treatment' },
  { value: 'therapy', label: 'Therapy Session' },
];

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('book');
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [bookForm, setBookForm] = useState({
    doctor_id: '',
    type: 'consultation',
    appointment_date: '',
    symptoms: '',
  });
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [loadingUnavailable, setLoadingUnavailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [docList, apptList] = await Promise.all([
          getDoctors(),
          getAppointments(),
        ]);
        setDoctors(docList);
        setAppointments(apptList);
      } catch (_) {
        setMessage({ type: 'error', text: 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!bookForm.doctor_id) {
      setUnavailableDates([]);
      setBookForm((f) => ({ ...f, appointment_date: '' }));
      return;
    }
    setLoadingUnavailable(true);
    getDoctorUnavailableDates(bookForm.doctor_id)
      .then((data) => {
        const dates = (data.unavailable_dates || []).map((d) => (typeof d === 'string' ? d.slice(0, 10) : d));
        setUnavailableDates(dates);
      })
      .catch(() => setUnavailableDates([]))
      .finally(() => setLoadingUnavailable(false));
  }, [bookForm.doctor_id]);

  const minDate = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const maxDateStr = maxDate.toISOString().split('T')[0];
  const allDates = [];
  const d = new Date(minDate);
  const end = new Date(maxDateStr);
  while (d <= end) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    allDates.push(dateStr);
    d.setDate(d.getDate() + 1);
  }

  const handleBookSubmit = async (e) => {
    e.preventDefault();
    if (!bookForm.doctor_id || !bookForm.appointment_date || !bookForm.symptoms?.trim()) {
      setMessage({ type: 'error', text: 'Please fill all required fields' });
      return;
    }
    setSubmitLoading(true);
    setMessage({ type: '', text: '' });
    try {
      await createAppointment({
        doctor_id: parseInt(bookForm.doctor_id, 10),
        type: bookForm.type,
        appointment_date: bookForm.appointment_date,
        symptoms: bookForm.symptoms.trim(),
      });
      setMessage({ type: 'success', text: 'Appointment request sent. Doctor will confirm the time.' });
      setBookForm({ doctor_id: '', type: 'consultation', appointment_date: '', symptoms: '' });
      const apptList = await getAppointments();
      setAppointments(apptList);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to book' });
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="patient" onProfileClick={() => navigate('/dashboard/patient/profile')}>
        <div className="dashboard-loading">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient" onProfileClick={() => navigate('/dashboard/patient/profile')}>
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

      {message.text && (
        <div className={`message-banner ${message.type}`}>{message.text}</div>
      )}

      {activeTab === 'book' && (
        <div className="booking-grid">
          <div className="booking-form-card">
            <h3>📅 Book New Appointment</h3>
            <form className="booking-form" onSubmit={handleBookSubmit}>
              <div className="field-group">
                <label>Select Doctor <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={bookForm.doctor_id}
                  onChange={(e) => setBookForm((f) => ({ ...f, doctor_id: e.target.value, appointment_date: '' }))}
                  required
                >
                  <option value="">Choose a doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.name} - {d.specialization || 'General'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>Appointment Type<span style={{ color: 'red' }}>*</span></label>
                <select
                  value={bookForm.type}
                  onChange={(e) => setBookForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {APPOINTMENT_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>Preferred Date<span style={{ color: 'red' }}>*</span></label>
                <select
                  value={bookForm.appointment_date}
                  onChange={(e) => setBookForm((f) => ({ ...f, appointment_date: e.target.value }))}
                  required
                  disabled={!bookForm.doctor_id}
                >
                  <option value="">
                    {!bookForm.doctor_id ? 'Select a doctor first' : loadingUnavailable ? 'Loading dates...' : 'Choose a date'}
                  </option>
                  {allDates.map((dateStr) => (
                    <option key={dateStr} value={dateStr} disabled={unavailableDates.includes(dateStr)}>
                      {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      {unavailableDates.includes(dateStr) ? ' (Unavailable)' : ''}
                    </option>
                  ))}
                </select>
                {bookForm.doctor_id && !loadingUnavailable && unavailableDates.length > 0 && (
                  <small className="muted">Doctor has marked {unavailableDates.length} day(s) as unavailable (disabled in the list).</small>
                )}
              </div>
              <div className="field-group">
                <label>Symptoms & Concerns<span style={{ color: 'red' }}>*</span></label>
                <textarea
                  placeholder="Describe your symptoms and health concerns..."
                  rows={4}
                  value={bookForm.symptoms}
                  onChange={(e) => setBookForm((f) => ({ ...f, symptoms: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="book-btn" disabled={submitLoading}>
                Book Appointment
              </button>
            </form>
          </div>
          <div className="doctors-card">
            <h3>Available Doctors</h3>
            <div className="doctors-list">
              {doctors.length === 0 ? (
                <p className="muted">No doctors listed yet.</p>
              ) : (
                doctors.map((d) => (
                  <div
                    key={d.id}
                    className={`doctor-item ${d.is_available ? 'available' : 'unavailable'}`}
                  >
                    <div className="doctor-info">
                      <h4>Dr. {d.name}</h4>
                      <p>{d.specialization || 'General'}</p>
                    </div>
                    <span className={`status-badge ${d.is_available ? 'available' : 'unavailable'}`}>
                      {d.is_available ? 'Available' : 'Busy'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="appointments-card">
          <h3>My Appointments</h3>
          <div className="appointments-list">
            {appointments.length === 0 ? (
              <p className="muted">No appointments yet.</p>
            ) : (
              appointments.map((a) => (
                <div key={a.id} className="appointment-item">
                  <div className="appointment-info">
                    <h4>{a.doctor_name}</h4>
                    <p>{a.specialization}</p>
                    <div className="appointment-details">
                      <span>
                        📅 {new Date(a.confirmed_date || a.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span>🕐 {a.confirmed_time ? a.confirmed_time.slice(0, 5) : 'TBD (doctor will confirm)'}</span>
                    </div>
                    {a.status === 'reschedule_proposed' && (
                      <div className="appointment-details" style={{ marginTop: 8 }}>
                        <span><strong>New proposed:</strong> {a.reschedule_proposed_date} {a.reschedule_proposed_time?.slice(0, 5)}</span>
                      </div>
                    )}
                    {a.symptoms && <p><strong>Symptoms:</strong> {a.symptoms}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <span className={`status-badge ${a.status}`}>{a.status}</span>
                    {a.status === 'reschedule_proposed' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="action-btn confirm"
                          onClick={async () => {
                            try {
                              await acceptReschedule(a.id);
                              setMessage({ type: 'success', text: 'Reschedule accepted.' });
                              setAppointments(await getAppointments());
                            } catch (err) {
                              setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
                            }
                          }}
                        >
                          ✅ Accept
                        </button>
                        <button
                          type="button"
                          className="action-btn cancel"
                          onClick={async () => {
                            try {
                              await rejectReschedule(a.id);
                              setMessage({ type: 'success', text: 'Reschedule rejected; appointment cancelled.' });
                              setAppointments(await getAppointments());
                            } catch (err) {
                              setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
                            }
                          }}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
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
