/**
 * Doctor profile/settings page - accessible by clicking the user name/avatar in the header.
 */
import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { getDoctorMe, updateDoctorMe, updateMe } from '../services/api';
import './DoctorDashboard.css';

export default function DoctorProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    specialization: '',
    license_number: '',
    bio: '',
    consultation_duration_min: 30,
    consultation_fee: '',
    break_minutes: 15,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    (async () => {
      try {
        const doctor = await getDoctorMe();
        setProfile(doctor);
        setForm({
          name: doctor.user_name || '',
          specialization: doctor.specialization || '',
          license_number: doctor.license_number || '',
          bio: doctor.bio || '',
          consultation_duration_min: doctor.consultation_duration_min ?? 30,
          consultation_fee: doctor.consultation_fee ?? '',
          break_minutes: doctor.break_minutes ?? 15,
        });
      } catch (_) {
        setMessage({ type: 'error', text: 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { name, ...doctorFields } = form;
      if (name) {
        await updateMe({ name });
      }
      await updateDoctorMe(doctorFields);
      setMessage({ type: 'success', text: 'Settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="doctor">
        <div className="dashboard-loading">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="doctor">
      {message.text && <div className={`message-banner ${message.type}`}>{message.text}</div>}
      <div className="settings-grid">
        <div className="settings-card">
          <h3>Profile & Consultation Settings</h3>
          <form className="settings-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label>Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <label>Specialization</label>
              <input
                value={form.specialization}
                onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <label>License Number</label>
              <input
                value={form.license_number}
                onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <label>Bio</label>
              <textarea
                rows={4}
                placeholder="Brief description..."
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <label>Consultation Duration (min)</label>
              <select
                value={form.consultation_duration_min}
                onChange={(e) => setForm((f) => ({ ...f, consultation_duration_min: parseInt(e.target.value, 10) }))}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
            <div className="field-group">
              <label>Consultation Fee (₹)</label>
              <input
                type="text"
                placeholder="500"
                value={form.consultation_fee}
                onChange={(e) => setForm((f) => ({ ...f, consultation_fee: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <label>Break Between Appointments (min)</label>
              <select
                value={form.break_minutes}
                onChange={(e) => setForm((f) => ({ ...f, break_minutes: parseInt(e.target.value, 10) }))}
              >
                <option value={0}>No break</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
            <button type="submit" className="update-btn" disabled={saving}>
              Save Settings
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

