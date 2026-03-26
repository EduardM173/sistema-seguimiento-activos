import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PrivateLayout from './components/layout/PrivateLayout';
import ToastContainer from './components/notifications/ToastContainer';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UserList from './pages/users/UserList';
import CreateUser from './components/users/CreateUser';
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
          
        <Route element={<ProtectedRoute />}>
          <Route element={<PrivateLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route element={<ProtectedRoute requiredPermission="ASSET_VIEW" />}>
              <Route path="/assets" element={<AssetsPage />} />
            </Route>

            <Route element={<ProtectedRoute requiredPermission="USER_MANAGE" />}>
              <Route path="/users" element={<UserList />} />
              <Route path="/users/create" element={<CreateUser />} />
            </Route>
          </Route>
        </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}