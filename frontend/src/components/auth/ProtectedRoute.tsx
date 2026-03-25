import { Navigate, Outlet } from 'react-router-dom';
// importa componentes para redirigir y renderizar rutas hijas

import { useAuth } from '../../context/AuthContext';
// importa el contexto global de auth

export default function ProtectedRoute() {
  // componente que protege las rutas privadas

  const { isAuthenticated } = useAuth();
  // lee si el usuario tiene sesion activa

  if (!isAuthenticated) {
    // si no hay sesion
    return <Navigate to="/" replace />;
    // lo manda al login
  }

  return <Outlet />;
  // si hay sesion deja pasar a la pagina
}