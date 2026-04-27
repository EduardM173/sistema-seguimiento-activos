import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

type ProtectedRouteProps = {
  requiredPermission?: string;
  allowedRoleNames?: string[];
};

const DEV_BYPASS_AUTH = false;

export default function ProtectedRoute({
  requiredPermission,
  allowedRoleNames,
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

  if (allowedRoleNames?.length) {
    const normalizedRole = normalizeRoleName(user?.rol?.nombre);
    const allowedRoles = new Set(allowedRoleNames.map(normalizeRoleName));

    if (!allowedRoles.has(normalizedRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}

function normalizeRoleName(roleName?: string | null) {
  return (roleName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
}
