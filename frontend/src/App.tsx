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
import ActivosPage from './pages/activos/ActivosPage';
import InventarioPage from './pages/inventario/InventarioPage';
import TransferenciasPage from './pages/transferencias/TransferenciasPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';
import AuditoriaPage from './pages/auditoria/AuditoriaPage';
import ReportesPage from './pages/reportes/ReportesPage';
import './App.css';

function getToken() {
  return (
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('accessToken')
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

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
              <Route element={<ProtectedRoute requiredPermission="ASSET_VIEW" />}>
                <Route path="/activos" element={<AssetsPage />} />
                <Route path="/assets" element={<AssetsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="ASSET_CREATE" />}>
                <Route path="/activos/nuevo" element={<CreateAssetPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="INVENTORY_MANAGE" />}>
                <Route path="/inventario" element={<InventarioPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="USER_MANAGE" />}>
                <Route path="/users" element={<UserList />} />
                <Route path="/users/create" element={<CreateUser />} />
                <Route path="/users/:id/edit" element={<CreateUser />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}
