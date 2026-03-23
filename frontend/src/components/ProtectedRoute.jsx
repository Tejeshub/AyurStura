/**
 * Protects routes that require login. Redirects to /auth if not authenticated.
 * If role is given, redirects to correct dashboard when user has different role.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        Loading...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  if (role && user.role !== role) {
    const dashboard = { patient: '/dashboard/patient', doctor: '/dashboard/doctor', admin: '/dashboard/admin' }[user.role];
    return <Navigate to={dashboard || '/'} replace />;
  }
  return children;
}
