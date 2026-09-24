import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { SESSION_EXPIRED_FLAG } from '../../lib/auth';
import FullScreenLoader from './FullScreenLoader';

/**
 * Wraps authenticated routes. Shows a branded loader while the session
 * restores; redirects guests to /login, preserving the intended destination.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    const expired = sessionStorage.getItem(SESSION_EXPIRED_FLAG) === '1';
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}${expired ? '&expired=1' : ''}`} replace />;
  }

  return <>{children}</>;
}
