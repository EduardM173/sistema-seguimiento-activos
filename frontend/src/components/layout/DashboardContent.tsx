import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatWidget } from './StatWidget';
import { RecentActivity } from './RecentActivity';
import { QuickAction } from './QuickAction';
import { Card, LoadingSpinner } from '../common';
import { useAuth } from '../../hooks';
import {
  IconPackage,
  IconAlertTriangle,
  IconArrowsLeftRight,
  IconShield,
  IconPlus,
  IconBarChart,
  IconUsers,
  IconClipboard,
  IconSearch,
} from '../common/Icon';
import '../../styles/dashboard.css';

export const DashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [stats, setStats] = React.useState({
    totalActivos: 1284,
    stockBajo: 18,
    transferenciasEspera: 42,
    alertasSeguridad: 3,
    usuariosActivos: 12,
  });

  const handleNavigate = (ruta: string) => {
    navigate(`/${ruta}`);
  };

  return (
    <div className="dashboard-content">
      {/* Bienvenida */}
      <div className="dashboard-header">
        <h1>Bienvenido, {usuario?.nombres}</h1>
        <p className="dashboard-subtitle">Panel de Control — Sistema de Gestión de Activos</p>
      </div>

      {/* Widgets de estadísticas */}
      <div className="stats-grid">
        <StatWidget
          title="Total de Activos"
          value={stats.totalActivos}
          icon={<IconPackage size={18} />}
          trend={2.5}
          onClick={() => handleNavigate('activos')}
        />
        <StatWidget
          title="Stock Bajo"
          value={stats.stockBajo}
          icon={<IconAlertTriangle size={18} />}
          trend={-1.2}
          onClick={() => handleNavigate('inventario')}
        />
        <StatWidget
          title="Transferencias en Espera"
          value={stats.transferenciasEspera}
          icon={<IconArrowsLeftRight size={18} />}
          trend={5.3}
          onClick={() => handleNavigate('transferencias')}
        />
        <StatWidget
          title="Alertas de Seguridad"
          value={stats.alertasSeguridad}
          icon={<IconShield size={18} />}
          trend={0.8}
          onClick={() => handleNavigate('auditoria')}
        />
      </div>

      {/* Acciones rápidas y actividad */}
      <div className="dashboard-grid">
        {/* Acciones rápidas */}
        <Card title="Acciones Rápidas" padding="lg">
          <div className="quick-actions-grid">
            <QuickAction
              icon={<IconPlus size={20} />}
              label="Nuevo Activo"
              onClick={() => handleNavigate('activos')}
            />
            <QuickAction
              icon={<IconArrowsLeftRight size={20} />}
              label="Transferencia"
              onClick={() => handleNavigate('transferencias')}
            />
            <QuickAction
              icon={<IconBarChart size={20} />}
              label="Generar Reporte"
              onClick={() => handleNavigate('reportes')}
            />
            <QuickAction
              icon={<IconUsers size={20} />}
              label="Gestionar Usuarios"
              onClick={() => handleNavigate('usuarios')}
            />
            <QuickAction
              icon={<IconClipboard size={20} />}
              label="Inventario"
              onClick={() => handleNavigate('inventario')}
            />
            <QuickAction
              icon={<IconSearch size={20} />}
              label="Auditoría"
              onClick={() => handleNavigate('auditoria')}
            />
          </div>
        </Card>

        {/* Actividad reciente */}
        <RecentActivity
          activities={[
            {
              id: '1',
              usuarioId: '1',
              usuario: { id: '1', nombres: 'Admin', apellidos: 'Usuario', correo: 'admin@uni.edu' },
              accion: 'crear',
              modulo: 'activos',
              recursoTipo: 'Activo',
              recursoId: 'ACT-001',
              descripcion: 'creó un nuevo activo',
              fechaHora: new Date(),
              resultado: 'exitoso',
            },
            {
              id: '2',
              usuarioId: '2',
              usuario: { id: '2', nombres: 'Juan', apellidos: 'Pérez', correo: 'juan@uni.edu' },
              accion: 'actualizar',
              modulo: 'inventario',
              recursoTipo: 'Material',
              recursoId: 'MAT-005',
              descripcion: 'actualizó stock de materiales',
              fechaHora: new Date(Date.now() - 3600000),
              resultado: 'exitoso',
            },
          ]}
        />
      </div>

      {/* Información del usuario */}
      <div className="dashboard-footer">
        <Card padding="md">
          <div className="user-info">
            <h3>Mi Perfil</h3>
            <p><strong>Nombre:</strong> {usuario?.nombres} {usuario?.apellidos}</p>
            <p><strong>Correo:</strong> {usuario?.correo}</p>
            <p><strong>Área:</strong> {usuario?.area?.nombre ?? 'N/A'}</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardContent;
