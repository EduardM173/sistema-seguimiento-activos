import React, { useState, useEffect } from 'react';
import { SmartTable, Badge, Button } from '../../components/common';
import type { ColumnDef } from '../../components/common';
import { IconCheck, IconX } from '../../components/common/Icon';
import { asignacionesService } from '../../services/asignaciones.service';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import ModalConfirmarRecepcion from '../../components/asignaciones/ModalConfirmarRecepcion';
import ModalRechazarRecepcion from '../../components/asignaciones/ModalRechazarRecepcion';
import type { AsignacionActivo, EstadoAsignacion } from '../../types/asignaciones.types';
import '../../styles/modules.css';

export const AsignacionesPendientesPage: React.FC = () => {
  const { user } = useAuth();
  const notify = useNotification();
  const [asignaciones, setAsignaciones] = useState<AsignacionActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmarModalOpen, setConfirmarModalOpen] = useState(false);
  const [rechazarModalOpen, setRechazarModalOpen] = useState(false);
  const [selectedAsignacion, setSelectedAsignacion] = useState<AsignacionActivo | null>(null);

  useEffect(() => {
    cargarAsignacionesPendientes();
  }, [refreshKey]);

  const cargarAsignacionesPendientes = async () => {
    try {
      setLoading(true);
      const resultado = await asignacionesService.obtenerPendientesPorArea({
        page: 1,
        pageSize: 100,
      });
      setAsignaciones(resultado.data);
    } catch (err) {
      console.error('Error al cargar asignaciones pendientes:', err);
      notify.error('Error al cargar las asignaciones pendientes');
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

  const columns: ColumnDef<AsignacionActivo>[] = [
    {
      id: 'codigo',
      header: 'Código',
      accessor: (row) => row.activo?.codigoActivo || 'N/A',
      width: 110,
    },
    {
      id: 'nombre',
      header: 'Nombre',
      accessor: (row) => row.activo?.nombre || 'N/A',
      primary: true,
      width: 200,
    },
    {
      id: 'marca',
      header: 'Marca',
      accessor: (row) => row.activo?.marca || 'N/A',
      width: 120,
    },
    {
      id: 'modelo',
      header: 'Modelo',
      accessor: (row) => row.activo?.modelo || 'N/A',
      width: 120,
    },
    {
      id: 'estado',
      header: 'Estado',
      accessor: 'estado',
      width: 120,
      render: (value) => (
        <Badge
          label={getEstadoDisplay(value as EstadoAsignacion)}
          variant={getEstadoColor(value as EstadoAsignacion)}
          size="sm"
        />
      ),
    },
    {
      id: 'asignadoEn',
      header: 'Asignado el',
      accessor: 'asignadoEn',
      width: 140,
      render: (value) => new Date(String(value)).toLocaleDateString(),
    },
    {
      id: 'acciones',
      header: 'Acciones',
      accessor: (row) => row.id,
      sortable: false,
      width: 220,
      render: (_id, row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {row.estado === 'PENDIENTE' && (
            <>
              <Button
                label="Aceptar"
                variant="success"
                size="sm"
                icon={<IconCheck size={12} />}
                onClick={() => handleConfirmarClick(row)}
              />
              <Button
                label="Rechazar"
                variant="danger"
                size="sm"
                icon={<IconX size={12} />}
                onClick={() => handleRechazarClick(row)}
              />
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
      <div>
        <h1>Recepción de Activos</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
          Activos pendientes de recepción para <strong>{areaNombre}</strong>
        </p>
      </div>

      <div className="module-list">
        <SmartTable<AsignacionActivo>
          columns={columns}
          data={asignaciones}
          loading={loading}
          emptyMessage="No hay activos pendientes de recepción para tu área"
          keyExtractor={(row) => row.id}
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