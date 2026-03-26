import React from 'react';
import { LoadingSpinner, Badge } from '../common';
import type { Auditoria } from '../../types';
import '../../styles/dashboard.css';

interface RecentActivityProps {
  loading?: boolean;
  activities?: Auditoria[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  loading = false,
  activities = [],
}) => {
  const getActionColor = (accion: string): 'primary' | 'success' | 'warning' | 'danger' => {
    switch (accion) {
      case 'crear':
        return 'success';
      case 'eliminar':
        return 'danger';
      case 'actualizar':
        return 'warning';
      default:
        return 'primary';
    }
  };

  const getActionLabel = (accion: string): string => {
    const labels: Record<string, string> = {
      crear: 'Creado',
      actualizar: 'Actualizado',
      eliminar: 'Eliminado',
      descargar: 'Descargado',
      acceder: 'Acceso',
      exportar: 'Exportado',
    };
    return labels[accion] || accion;
  };

  return (
    <div className="recent-activity">
      <h3 className="activity-title">Actividad Reciente</h3>
      {loading ? (
        <LoadingSpinner />
      ) : activities.length === 0 ? (
        <div className="activity-empty">No hay actividad reciente</div>
      ) : (
        <div className="activity-list">
          {activities.slice(0, 5).map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-avatar">
                {activity.usuario?.nombres.charAt(0)}
              </div>
              <div className="activity-content">
                <p className="activity-text">
                  <strong>{activity.usuario?.nombres} {activity.usuario?.apellidos}</strong>{' '}
                  {activity.descripcion}
                </p>
                <span className="activity-time">
                  {new Date(activity.fechaHora).toLocaleDateString('es-ES')}
                </span>
              </div>
              <Badge
                label={getActionLabel(activity.accion)}
                variant={getActionColor(activity.accion)}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
