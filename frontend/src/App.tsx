import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PrivateLayout from './components/layout/PrivateLayout';
import ToastContainer from './components/notifications/ToastContainer';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UserList from './pages/users/UserList';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AssetTransferHistoryPage from './pages/AssetTransferHistoryPage';
import LocationsPage from './pages/LocationsPage';
import ActivosPage from './pages/activos/ActivosPage';
import InventarioPage from './pages/inventario/InventarioPage';
import TransferenciasPage from './pages/transferencias/TransferenciasPage';
import RecepcionesPage from './pages/recepciones/RecepcionesPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';
import AuditoriaPage from './pages/auditoria/AuditoriaPage';
import ReportesPage from './pages/reportes/ReportesPage';
import NotificacionesPage from './pages/notificaciones/NotificacionesPage';
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
              <Route element={<ProtectedRoute requiredPermission="NOTIFICATION_VIEW" />}>
                <Route path="/notificaciones" element={<NotificacionesPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="ASSET_VIEW" />}>
                <Route path="/activos" element={<AssetsPage />} />
                <Route path="/activos/:id" element={<AssetDetailPage />} />
                <Route path="/activos/:id/historial" element={<AssetTransferHistoryPage />} />
                <Route path="/assets" element={<AssetsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="TRANSFER_MANAGE" />}>
                <Route path="/transferencias" element={<TransferenciasPage />} />
              </Route>
              {/*
                HU21 — Recepciones: accesible para cualquier usuario autenticado
                con ASSET_VIEW (incluye el Responsable de Área que solo tiene ese permiso).
                PA4: el backend ya valida que solo el responsable del área destino pueda confirmar.
              */}
              <Route element={<ProtectedRoute requiredPermission="ASSET_VIEW" />}>
                <Route path="/transferencias/recepciones" element={<RecepcionesPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="ASSET_VIEW" />}>
                <Route path="/locations" element={<LocationsPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="INVENTORY_MANAGE" />}>
                <Route path="/inventario" element={<InventarioPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="REPORT_VIEW" />}>
                <Route path="/reportes" element={<ReportesPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="AUDIT_VIEW" />}>
                <Route path="/auditoria" element={<AuditoriaPage />} />
              </Route>
              <Route element={<ProtectedRoute requiredPermission="USER_MANAGE" />}>
                <Route path="/users" element={<UserList />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NotificationProvider>
    </AuthProvider>
  );
}
