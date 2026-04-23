import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isResponsibleAreaRoleName } from '../../utils/roles';

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
    const currentRoleName = user?.rol?.nombre ?? '';
    const normalizedAllowedRoleNames = new Set(
      allowedRoleNames.map((roleName) =>
        roleName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[_\s]+/g, ' ')
          .trim()
          .toUpperCase(),
      ),
    );

    const isAllowed =
      normalizedAllowedRoleNames.has(
        currentRoleName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[_\s]+/g, ' ')
          .trim()
          .toUpperCase(),
      ) ||
      (allowedRoleNames.includes('RESPONSABLE_DE_AREA') &&
        isResponsibleAreaRoleName(currentRoleName));

    if (!isAllowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
