/**
 * Admin dashboard - tabs: Appointments, Doctors, Patients, Analytics, Settings.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  getAdminAppointments,
  getAdminDoctors,
  createAdminDoctor,
  updateAdminDoctor,
  deleteAdminDoctor,
  getAdminPatients,
  getAdminAnalytics,
  getAdminSettings,
  updateAdminSettings,
} from '../services/api';
import './AdminDashboard.css';

const TABS = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'patients', label: 'Patients' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('appointments');
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [newDoctorForm, setNewDoctorForm] = useState({ email: '', password: '', name: '', specialization: '', license_number: '' });
  const [settingsForm, setSettingsForm] = useState({});

  // Load stats (appointments, doctors, patients) on mount
  useEffect(() => {
    (async () => {
      try {
        const [appts, docs, pats] = await Promise.all([
          getAdminAppointments(),
          getAdminDoctors(),
          getAdminPatients(),
        ]);
        setAppointments(appts);
        setDoctors(docs);
        setPatients(pats);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab]);

  async function loadTab(tab) {
    setLoading(true);
    try {
      if (tab === 'appointments') {
        const data = await getAdminAppointments();
        setAppointments(data);
      } else if (tab === 'doctors') {
        const data = await getAdminDoctors();
        setDoctors(data);
      } else if (tab === 'patients') {
        const data = await getAdminPatients();
        setPatients(data);
      } else if (tab === 'analytics') {
        const data = await getAdminAnalytics();
        setAnalytics(data);
      } else if (tab === 'settings') {
        const data = await getAdminSettings();
        setSettings(data);
        setSettingsForm(data || {});
      }
    } catch (_) {
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    if (!newDoctorForm.email || !newDoctorForm.password || !newDoctorForm.name) {
      setMessage({ type: 'error', text: 'Email, password, name required' });
      return;
    }
    try {
      await createAdminDoctor(newDoctorForm);
      setMessage({ type: 'success', text: 'Doctor added.' });
      setNewDoctorForm({ email: '', password: '', name: '', specialization: '', license_number: '' });
      const data = await getAdminDoctors();
      setDoctors(data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await updateAdminSettings(settingsForm);
      setMessage({ type: 'success', text: 'Settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed' });
    }
  };

  if (loading && (appointments.length === 0 && doctors.length === 0 && patients.length === 0 && !analytics && Object.keys(settings).length === 0)) {
    return (
      <DashboardLayout role="admin">
        <div className="dashboard-loading">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="stats-grid admin-stats">
        <div className="stat-card">
          <div className="stat-info">
            <p>Total Appointments</p>
            <h3>{appointments.length}</h3>
          </div>
          <div className="stat-icon">📅</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>Doctors</p>
            <h3>{doctors.length}</h3>
          </div>
          <div className="stat-icon">👨‍⚕️</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <p>Patients</p>
            <h3>{patients.length}</h3>
          </div>
          <div className="stat-icon">👥</div>
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
        <div className="admin-card">
          <h3>All Appointments</h3>
          <div className="admin-table">
            <div className="table-header">
              <div>Patient</div>
              <div>Doctor</div>
              <div>Date & Time</div>
              <div>Type</div>
              <div>Status</div>
            </div>
            {appointments.length === 0 ? (
              <p className="muted">No appointments.</p>
            ) : (
              appointments.map((a) => (
                <div key={a.id} className="table-row">
                  <div>{a.patient_name}</div>
                  <div>{a.doctor_name}</div>
                  <div>{a.confirmed_date || a.appointment_date} {a.confirmed_time ? a.confirmed_time.slice(0, 5) : (a.appointment_time ? a.appointment_time.slice(0, 5) : 'TBD')}</div>
                  <div>{a.type}</div>
                  <div><span className={`status-badge ${a.status}`}>{a.status}</span></div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'doctors' && (
        <div className="admin-card">
          <div className="card-header">
            <h3>Doctor Management</h3>
            <form onSubmit={handleAddDoctor} className="add-doctor-form">
              <input
                placeholder="Name"
                value={newDoctorForm.name}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="email"
                placeholder="Email"
                value={newDoctorForm.email}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, email: e.target.value }))}
              />
              <input
                type="password"
                placeholder="Password"
                value={newDoctorForm.password}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, password: e.target.value }))}
              />
              <input
                placeholder="Specialization"
                value={newDoctorForm.specialization}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, specialization: e.target.value }))}
              />
              <input
                placeholder="License"
                value={newDoctorForm.license_number}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, license_number: e.target.value }))}
              />
              <button type="submit" className="add-btn">Add Doctor</button>
            </form>
          </div>
          <div className="admin-table">
            <div className="table-header">
              <div>Doctor</div>
              <div>Specialization</div>
              <div>Patients</div>
              <div>Status</div>
              <div>Action</div>
            </div>
            {doctors.map((d) => (
              <div key={d.id} className="table-row">
                <div>
                  <div>Dr. {d.name}</div>
                  <small>{d.email}</small>
                </div>
                <div>{d.specialization || '-'}</div>
                <div>{d.patient_count ?? 0}</div>
                <div><span className={`status-badge ${d.is_available ? 'active' : 'inactive'}`}>{d.is_available ? 'Active' : 'Inactive'}</span></div>
                <div>
                  <button
                    type="button"
                    className="manage-btn"
                    onClick={() => navigate(`/dashboard/admin/doctors/${d.id}`)}
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="admin-card">
          <h3>Patient Management</h3>
          <div className="admin-table">
            <div className="table-header">
              <div>Patient</div>
              <div>Contact</div>
              <div>Last Visit</div>
              <div>Total Visits</div>
            </div>
            {patients.length === 0 ? (
              <p className="muted">No patients.</p>
            ) : (
              patients.map((p) => (
                <div key={p.id} className="table-row">
                  <div>
                    <div>{p.name}</div>
                    <small>{p.email}</small>
                  </div>
                  <div>{p.phone || '-'}</div>
                  <div>{p.last_visit ? new Date(p.last_visit).toLocaleDateString() : '-'}</div>
                  <div>{p.total_visits ?? 0}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && analytics && (
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Appointment Types</h3>
            <div className="analytics-content">
              {(analytics.byType || []).map((t, i) => (
                <div key={i} className="type-item">
                  <span>{t.type}</span>
                  <span className="percentage">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="analytics-card">
            <h3>Totals</h3>
            <div className="analytics-content">
              <div className="type-item">
                <span>Doctors</span>
                <span>{analytics.totals?.doctors_count ?? 0}</span>
              </div>
              <div className="type-item">
                <span>Patients</span>
                <span>{analytics.totals?.patients_count ?? 0}</span>
              </div>
              <div className="type-item">
                <span>Pending</span>
                <span>{analytics.totals?.pending_count ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="settings-grid">
          <div className="settings-card">
            <h3>Clinic Settings</h3>
            <form onSubmit={handleSaveSettings} className="settings-form">
              <div className="field-group">
                <label>Clinic Name</label>
                <input
                  value={settingsForm.clinic_name ?? ''}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, clinic_name: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={settingsForm.contact_email ?? ''}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, contact_email: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Phone</label>
                <input
                  value={settingsForm.phone ?? ''}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Address</label>
                <input
                  value={settingsForm.address ?? ''}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="field-group">
                <label>Email Notifications</label>
                <input
                  type="checkbox"
                  checked={!!settingsForm.email_notifications}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, email_notifications: e.target.checked }))}
                />
              </div>
              <div className="field-group">
                <label>SMS Reminders</label>
                <input
                  type="checkbox"
                  checked={!!settingsForm.sms_reminders}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, sms_reminders: e.target.checked }))}
                />
              </div>
              <button type="submit" className="update-btn">Save Settings</button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
