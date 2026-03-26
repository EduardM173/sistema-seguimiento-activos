import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import ProtectedRoute from './components/auth/ProtectedRoute';

import PrivateLayout from './components/layout/PrivateLayout';
import ToastContainer from './components/notifications/ToastContainer';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AssetsPage from './pages/AssetsPage';
import CreateAssetPage from './pages/CreateAssetPage';
import UserList from './pages/users/UserList';
import CreateUser from './components/users/CreateUser';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<LoginPage />} />

          {/* Rutas Protegidas y Layout Privado */}
          <Route element={<ProtectedRoute />}>
            <Route element={<PrivateLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Gestión de Activos con Permisos */}
              <Route element={<ProtectedRoute/>}>
                <Route path="/assets" element={<AssetsPage />} />
                <Route path="/assets/new" element={<CreateAssetPage />} />
              </Route>

              {/* Gestión de Usuarios con Permisos */}
              <Route element={<ProtectedRoute/>}>
                <Route path="/users" element={<UserList />} />
                <Route path="/users/create" element={<CreateUser />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}