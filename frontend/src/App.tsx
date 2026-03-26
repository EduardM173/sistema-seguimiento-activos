import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ActivosPage from './pages/activos/ActivosPage';
import InventarioPage from './pages/inventario/InventarioPage';
import TransferenciasPage from './pages/transferencias/TransferenciasPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';
import AuditoriaPage from './pages/auditoria/AuditoriaPage';
import ReportesPage from './pages/reportes/ReportesPage';
import './App.css';
import PrivateLayout from './components/layout/PrivateLayout';

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
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <DashboardPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/activos"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <ActivosPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <InventarioPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/transferencias"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <TransferenciasPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <UsuariosPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/auditoria"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <AuditoriaPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <PrivateRoute>
              <PrivateLayout>
                <ReportesPage />
              </PrivateLayout>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}