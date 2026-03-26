import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';

import ProtectedRoute from './components/auth/ProtectedRoute';

import PrivateLayout from './components/layout/PrivateLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ActivosPage from './pages/activos/ActivosPage';
import InventarioPage from './pages/inventario/InventarioPage';
import TransferenciasPage from './pages/transferencias/TransferenciasPage';
import UsuariosPage from './pages/usuarios/UsuariosPage';
import AuditoriaPage from './pages/auditoria/AuditoriaPage';
import ReportesPage from './pages/reportes/ReportesPage';
import UserList from './pages/users/UserList';
import CreateUser from './components/users/CreateUser';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<PrivateLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/activos" element={<ActivosPage />} />
            <Route path="/inventario" element={<InventarioPage />} />
            <Route path="/transferencias" element={<TransferenciasPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/users/create" element={<CreateUser />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}