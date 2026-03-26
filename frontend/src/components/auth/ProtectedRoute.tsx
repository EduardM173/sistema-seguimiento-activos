import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DEV_BYPASS_AUTH = true;

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  if (!DEV_BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}