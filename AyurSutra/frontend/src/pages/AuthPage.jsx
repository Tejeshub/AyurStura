/**
 * Auth page - login and signup by role (patient, doctor, admin). Redirects to role dashboard on success.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import './AuthPage.css';

const ROLE_CONFIG = {
  patient: { title: '🌿 Patient Portal', subtitle: 'Book your Ayurvedic consultation' },
  doctor: { title: '👨‍⚕️ Doctor Portal', subtitle: 'Manage your practice' },
  admin: { title: '🛡️ Admin Panel', subtitle: 'System administration' },
};

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role') || 'patient';
  const role = ['patient', 'doctor', 'admin'].includes(roleParam) ? roleParam : 'patient';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [license_number, setLicense_number] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user, login, register } = useAuth();
  const config = ROLE_CONFIG[role];

  useEffect(() => {
    if (user) {
      const path = { patient: '/dashboard/patient', doctor: '/dashboard/doctor', admin: '/dashboard/admin' }[user.role];
      navigate(path || '/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (!isLogin) {
      if (!name) {
        setError('Name is required');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (role === 'doctor' && !license_number) {
        setError('License number is required for doctors');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login({ email, password, role });
        const path = { patient: '/dashboard/patient', doctor: '/dashboard/doctor', admin: '/dashboard/admin' }[role];
        navigate(path, { replace: true });
      } else {
        await register({
          email,
          password,
          name,
          phone: phone || undefined,
          role: role === 'admin' ? 'patient' : role,
          specialization: role === 'doctor' ? specialization : undefined,
          license_number: role === 'doctor' ? license_number : undefined,
        });
        const path = { patient: '/dashboard/patient', doctor: '/dashboard/doctor' }[role];
        navigate(path || '/dashboard/patient', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const showName = !isLogin;
  const showPhone = !isLogin && role === 'patient';
  const showDoctorExtra = !isLogin && role === 'doctor';
  const showConfirmPassword = !isLogin;
  const showAuthToggle = role !== 'admin';

  return (
    <div className="auth-page screen">
      <div className="auth-background" />
      <div className="auth-container">
        <button type="button" className="back-btn" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
        <div className="auth-card">
          <div className="auth-header">
            <h2>{config.title}</h2>
            <p>{config.subtitle}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {showName && (
              <div className="field-group">
                <label htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {showPhone && (
              <div className="field-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            )}
            {showDoctorExtra && (
              <>
                <div className="field-group">
                  <label htmlFor="specialization">Specialization</label>
                  <input
                    id="specialization"
                    type="text"
                    placeholder="e.g., Panchakarma, Rasayana"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="license">License Number</label>
                  <input
                    id="license"
                    type="text"
                    placeholder="Medical license number"
                    value={license_number}
                    onChange={(e) => setLicense_number(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={role === 'admin' ? 'admin@1234' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {showConfirmPassword && (
              <div className="field-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {isLogin ? 'Login' : 'Sign Up'}
            </button>
            {showAuthToggle && (
              <div className="auth-toggle">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                >
                  {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
