import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

/** Compact auth control rendered inside the workspace TopNav. */
export default function SessionActions() {
  const { user, loading, isAuthenticated, signOut } = useAuth();
  const nav = useNavigate();

  if (loading) {
    return <span className="w-8 h-8 rounded-full shimmer-line inline-block" aria-hidden />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Link to="/login" className="btn-quiet rounded-full px-4 py-2 text-[12.5px] font-medium">
        Sign in
      </Link>
    );
  }

  const signOutAndLeave = async () => {
    await signOut();
    nav('/login');
  };

  return (
    <span className="flex items-center gap-2">
      <span
        className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center font-display font-semibold text-[13px]"
        title={user.email ?? 'Signed in'}
      >
        {(user.email ?? 'V').charAt(0).toUpperCase()}
      </span>
      <button
        onClick={signOutAndLeave}
        className="btn-quiet rounded-full p-2 text-fog hover:text-ink"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut size={14} />
      </button>
    </span>
  );
}
