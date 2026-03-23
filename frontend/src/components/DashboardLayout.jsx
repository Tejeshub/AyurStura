/**
 * Shared dashboard layout - header with logo, user badge, Support button, Logout.
 * Renders children (tab content) below. Used by Patient, Doctor, Admin dashboards.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import Chatbot from './Chatbot';
import './DashboardLayout.css';

const BADGE_CLASS = {
  patient: 'user-badge patient-badge',
  doctor: 'user-badge doctor-badge',
  admin: 'user-badge admin-badge',
};

const HEADER_CLASS = {
  patient: 'dashboard-header patient-header',
  doctor: 'dashboard-header doctor-header',
  admin: 'dashboard-header admin-header',
};

const BADGE_LABEL = {
  patient: 'Patient Portal',
  doctor: 'Doctor Portal',
  admin: 'Admin Panel',
};

export default function DashboardLayout({ children, role, onProfileClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = user?.name || 'User';
  const displaySub = role === 'doctor' ? user?.doctor?.specialization || user?.email : user?.email;
  const initial = (user?.name || 'U').charAt(0).toUpperCase();

  const handleProfileClick = () => {
    if (onProfileClick) {
      onProfileClick();
    }
  };

  return (
    <div className={`dashboard ${role}-dashboard`}>
      <header className={HEADER_CLASS[role]}>
        <div className="header-content">
          <div className="header-left">
            <h1>🌿 AyurVeda Clinic</h1>
            <span className={BADGE_CLASS[role]}>{BADGE_LABEL[role]}</span>
          </div>
          <div className="header-right">
            <button type="button" className="help-btn" onClick={() => setChatOpen((o) => !o)}>
              💬 Support
            </button>
            <div className="user-info" onClick={handleProfileClick}>
              <div className="avatar">{initial}</div>
              <div className="user-details">
                <span className="user-name">{displayName}</span>
                <span className="user-email">{displaySub}</span>
              </div>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout} title="Logout">
              🚪
            </button>
          </div>
        </div>
      </header>
      <div className="dashboard-content">
        {children}
      </div>
      <Chatbot open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
