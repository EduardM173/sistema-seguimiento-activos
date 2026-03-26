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

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<PrivateLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/activos" element={<AssetsPage />} />
              <Route path="/activos/nuevo" element={<CreateAssetPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}