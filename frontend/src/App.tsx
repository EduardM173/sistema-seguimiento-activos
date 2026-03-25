import { Navigate, Route, Routes } from 'react-router-dom';
// importa las rutas

import { AuthProvider } from './context/AuthContext';
// provider global de autenticacion

import ProtectedRoute from './components/auth/ProtectedRoute';
// protege rutas privadas

import PrivateLayout from './components/layout/PrivateLayout';
// layout con navbar

import LoginPage from './pages/LoginPage';
// pagina de login

import DashboardPage from './pages/DashboardPage';
// pagina del dashboard

import AssetsPage from './pages/AssetsPage';
// pagina de activos

export default function App() {
  return (
    <AuthProvider>
      {/* contexto global */}

      <Routes>
        {/* rutas */}

        <Route path="/" element={<LoginPage />} />
        {/* login */}

        <Route element={<ProtectedRoute />}>
          {/* rutas protegidas */}

          <Route element={<PrivateLayout />}>
            {/* layout con navbar */}

            <Route path="/dashboard" element={<DashboardPage />} />
            {/* dashboard */}

            <Route path="/activos" element={<AssetsPage />} />
            {/* hu13 listado de activos */}
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        {/* fallback */}
      </Routes>
    </AuthProvider>
  );
}