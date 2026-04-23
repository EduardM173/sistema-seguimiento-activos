import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

type ProtectedRouteProps = {
  requiredPermission?: string;
};

const DEV_BYPASS_AUTH = false;

export default function ProtectedRoute({
  requiredPermission,
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!DEV_BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission) {
    const userPermissions = new Set(
      user?.permisos?.map((permission) => permission.codigo) ?? [],
    );

    if (!userPermissions.has(requiredPermission)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
