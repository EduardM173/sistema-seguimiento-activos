import React, { useState, useEffect } from 'react';
import { DataTable, Badge, Button } from '../../components/common';
import { asignacionesService } from '../../services/asignaciones.service';
import { useAuth } from '../../context/AuthContext';
import ModalConfirmarRecepcion from '../../components/asignaciones/ModalConfirmarRecepcion';
import ModalRechazarRecepcion from '../../components/asignaciones/ModalRechazarRecepcion';
import type { AsignacionActivo, EstadoAsignacion } from '../../types/asignaciones.types';
import '../../styles/modules.css';

export const AsignacionesPendientesPage: React.FC = () => {
  const { user } = useAuth();
  const [asignaciones, setAsignaciones] = useState<AsignacionActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmarModalOpen, setConfirmarModalOpen] = useState(false);
  const [rechazarModalOpen, setRechazarModalOpen] = useState(false);
  const [selectedAsignacion, setSelectedAsignacion] = useState<AsignacionActivo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarAsignacionesPendientes();
  }, [refreshKey]);

  const cargarAsignacionesPendientes = async () => {
    try {
      setLoading(true);
      setError(null);
      const resultado = await asignacionesService.obtenerPendientesPorArea({
        page: 1,
        pageSize: 100,
      });
      setAsignaciones(resultado.data);
    } catch (err) {
      console.error('Error al cargar asignaciones pendientes:', err);
      setError('Error al cargar las asignaciones pendientes');
      setAsignaciones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarClick = (asignacion: AsignacionActivo) => {
    setSelectedAsignacion(asignacion);
    setConfirmarModalOpen(true);
  };

  const handleRechazarClick = (asignacion: AsignacionActivo) => {
    setSelectedAsignacion(asignacion);
    setRechazarModalOpen(true);
  };

  const handleConfirmarSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setConfirmarModalOpen(false);
    setSelectedAsignacion(null);
  };

  const handleRechazarSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setRechazarModalOpen(false);
    setSelectedAsignacion(null);
  };

  const getEstadoColor = (estado: EstadoAsignacion): any => {
    const colores: Record<EstadoAsignacion, any> = {
      'PENDIENTE': 'warning',
      'RECIBIDO': 'success',
      'RECHAZADO': 'danger',
      'DEVUELTO': 'secondary',
    };
    return colores[estado] || 'secondary';
  };

  const getEstadoDisplay = (estado: EstadoAsignacion): string => {
    const display: Record<EstadoAsignacion, string> = {
      'PENDIENTE': 'Pendiente',
      'RECIBIDO': 'Recibido',
      'RECHAZADO': 'Rechazado',
      'DEVUELTO': 'Devuelto',
    };
    return display[estado] || estado;
  };

  const columns = [
    { 
      header: 'Código', 
      accessor: (row: AsignacionActivo) => row.activo?.codigoActivo || 'N/A', 
      width: '100px' 
    },
    { 
      header: 'Nombre', 
      accessor: (row: AsignacionActivo) => row.activo?.nombre || 'N/A' 
    },
    { 
      header: 'Marca', 
      accessor: (row: AsignacionActivo) => row.activo?.marca || 'N/A' 
    },
    { 
      header: 'Modelo', 
      accessor: (row: AsignacionActivo) => row.activo?.modelo || 'N/A' 
    },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value: EstadoAsignacion) => (
        <Badge label={getEstadoDisplay(value)} variant={getEstadoColor(value)} size="sm" />
      ),
    },
    {
      header: 'Asignado el',
      accessor: 'asignadoEn',
      render: (value: Date) => new Date(value).toLocaleDateString(),
    },
    {
      header: 'Acciones',
      accessor: (row: AsignacionActivo) => row.id,
      render: (_id: string, row: AsignacionActivo) => (
        <div className="actions-group" style={{ display: 'flex', gap: '8px' }}>
          {row.estado === 'PENDIENTE' && (
            <>
              <button
                className="btn-action btn-confirm"
                onClick={() => handleConfirmarClick(row)}
                title="Confirmar Recepción"
                style={{
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  fontSize: '12px',
                }}
              >
                ✓ Aceptar
              </button>
              <button
                className="btn-action btn-reject"
                onClick={() => handleRechazarClick(row)}
                title="Rechazar Recepción"
                style={{
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  fontSize: '12px',
                }}
              >
                ✗ Rechazar
              </button>
            </>
          )}
          {row.estado === 'RECIBIDO' && (
            <Badge label="Recibido" variant="success" size="sm" />
          )}
          {row.estado === 'RECHAZADO' && (
            <Badge label="Rechazado" variant="danger" size="sm" />
          )}
        </div>
      ),
    },
  ];

  const areaNombre = user?.area?.nombre || user?.area || 'tu área';

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Recepción de Activos</h1>
        <p style={{ color: '#6b7280', marginTop: '4px' }}>
          Activos pendientes de recepción para <strong>{areaNombre}</strong>
        </p>
      </div>

      {error && (
        <div style={{ 
          background: '#fee2e2', 
          color: '#dc2626', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px' 
        }}>
          {error}
          <button 
            onClick={cargarAsignacionesPendientes}
            style={{ marginLeft: '12px', padding: '4px 8px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="module-list">
        <DataTable<AsignacionActivo>
          columns={columns}
          data={asignaciones}
          loading={loading}
          emptyMessage="📦 No hay activos pendientes de recepción para tu área"
          striped
          hover
        />
      </div>

      {/* Modal para confirmar recepción */}
      <ModalConfirmarRecepcion
        isOpen={confirmarModalOpen}
        asignacion={selectedAsignacion}
        onClose={() => {
          setConfirmarModalOpen(false);
          setSelectedAsignacion(null);
        }}
        onConfirm={handleConfirmarSuccess}
      />

      {/* Modal para rechazar recepción */}
      <ModalRechazarRecepcion
        isOpen={rechazarModalOpen}
        asignacion={selectedAsignacion}
        onClose={() => {
          setRechazarModalOpen(false);
          setSelectedAsignacion(null);
        }}
        onConfirm={handleRechazarSuccess}
      />
    </div>
  );
};

export default AsignacionesPendientesPage;