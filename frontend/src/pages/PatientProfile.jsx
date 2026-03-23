/**
 * Patient profile page - accessible by clicking the user name/avatar in the header.
 */
import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { getMe, updateMe } from '../services/api';
import './PatientDashboard.css';

export default function PatientProfile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setProfile(me);
        setForm({ name: me.name, email: me.email, phone: me.phone || '' });
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
      const updated = await updateMe(form);
      setProfile(updated);
      setMessage({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <div className="dashboard-loading">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      {message.text && <div className={`message-banner ${message.type}`}>{message.text}</div>}
      <div className="profile-card">
        <h3>Profile Information</h3>
        <div className="profile-form">
          <div className="profile-header">
            <div className="avatar large">{profile?.name?.charAt(0).toUpperCase()}</div>
            <div>
              <h3>{profile?.name}</h3>
              <p>Patient</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="profile-grid">
              <div className="field-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Email</label>
                <input type="email" value={form.email} readOnly disabled />
              </div>
              <div className="field-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="update-btn" disabled={saving}>
              Update Profile
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

