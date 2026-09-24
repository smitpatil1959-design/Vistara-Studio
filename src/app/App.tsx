import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './AuthProvider';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RouteErrorBoundary from '../components/RouteErrorBoundary';
import { ErrorBoundary } from '../components/ErrorBoundary';
import Landing from '../pages/Landing';
import AuthPage from '../pages/AuthPage';
import FullScreenLoader from '../components/auth/FullScreenLoader';

/* Heavy routes split into on-demand chunks — the landing stays lean. */
const Gallery = lazy(() => import('../pages/Gallery'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const CreatePage = lazy(() => import('../pages/CreatePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const Studio = lazy(() => import('../pages/Studio'));
const Present = lazy(() => import('../pages/Present'));

const lazyWrap = (node: React.ReactNode) => <Suspense fallback={<FullScreenLoader />}>{node}</Suspense>;

/**
 * Route map — public vs. protected
 * ─────────────────────────────────────────────────────────────
 *  public:    / · /login · /signup · /gallery · /present/:id · /p/:id
 *  protected: /dashboard · /create · /settings · /project/:id[/audit|/presentation]
 *  legacy:    /app → /dashboard · /studio/:id → /project/:id
 * ─────────────────────────────────────────────────────────────
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <RouteErrorBoundary>
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage key="login" mode="login" />} />
            <Route path="/signup" element={<AuthPage key="signup" mode="signup" />} />
            <Route path="/gallery" element={lazyWrap(<Gallery />)} />

            <Route path="/dashboard" element={<ProtectedRoute>{lazyWrap(<Dashboard />)}</ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute>{lazyWrap(<CreatePage />)}</ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute>{lazyWrap(<SettingsPage />)}</ProtectedRoute>} />
            <Route path="/project/:id/:view?" element={<ProtectedRoute>{lazyWrap(<Studio />)}</ProtectedRoute>} />

            {/* share + present links stay public by design */}
            <Route path="/present/:id" element={lazyWrap(<Present />)} />
            <Route path="/p/:id" element={lazyWrap(<Present />)} />

            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route path="/studio/:id" element={<LegacyStudioRedirect />} />
            <Route path="*" element={<Landing />} />
            </Routes>
          </RouteErrorBoundary>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LegacyStudioRedirect() {
  const { id = '' } = useParams();
  return <Navigate to={`/project/${id}`} replace />;
}
