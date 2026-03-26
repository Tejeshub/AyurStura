/**
 * Landing page - hero, carousel, feature tags, role selection buttons (Patient, Doctor, Admin), and chatbot.
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import Carousel from '../components/Carousel';
import Chatbot from '../components/Chatbot';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [particles, setParticles] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // If already logged in, offer redirect to dashboard
  useEffect(() => {
    if (user) {
      const path = { patient: '/dashboard/patient', doctor: '/dashboard/doctor', admin: '/dashboard/admin' }[user.role];
      if (path) navigate(path, { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 6 + Math.random() * 4,
      }))
    );
  }, []);

  const showAuth = (role) => navigate(`/auth?role=${role}`);

  return (
    <div className="landing-page screen active">
      <div className="particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
     <div className="login-options">

  {/* menu button */}
  <div 
    className="mobile-menu-trigger" 
    onClick={() => setMenuOpen(!menuOpen)}
  >
    ⋮
  </div>

  {/* menu items */}
  <div className={`menu-wrapper ${menuOpen ? 'show' : ''}`}>
    
    <button 
      type="button" 
      className="login-btn support-btn" 
      onClick={() => setChatOpen(true)}
    >
      💬 Support
    </button>

    <button 
      type="button" 
      className="login-btn patient-btn" 
      onClick={() => showAuth('patient')}
    >
      Login as Patient
    </button>

    <button 
      type="button" 
      className="login-btn doctor-btn" 
      onClick={() => showAuth('doctor')}
    >
      Login as Doctor
    </button>

    <button 
      type="button" 
      className="login-btn admin-btn" 
      onClick={() => showAuth('admin')}
    >
      Admin Panel
    </button>

  </div>

</div>

      <div className="landing-content">
        <div className="hero-section">
          <div className="hero-text">
            <h1 className="sanskrit-title">आयुर्सूत्रा</h1>
            <h2 className="clinic-title">AyurSutra Clinic</h2>
            <p className="clinic-subtitle">Ancient Wisdom for Modern Wellness</p>
            <div className="description">
              <p>
                Experience the timeless healing traditions of Ayurveda. Our certified practitioners combine ancient
                wisdom with modern care to restore your natural balance and vitality.
              </p>
              <div className="features-tags">
                <span className="feature-tag">🌿 Natural Healing</span>
                <span className="feature-tag">🧘 Mind-Body Balance</span>
                <span className="feature-tag">💫 Holistic Wellness</span>
              </div>
            </div>
          </div>
        </div>
        <div className="carousel-section">
          <Carousel />
        </div>
      </div>

      <div className="features-cards">
        <div className="feature-card">
          <div className="feature-icon">📅</div>
          <p>Easy Booking</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">👨‍⚕️</div>
          <p>Expert Doctors</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🌱</div>
          <p>Natural Treatment</p>
        </div>
      </div>

      <Chatbot open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
