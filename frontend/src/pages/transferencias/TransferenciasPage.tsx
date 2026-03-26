import React, { useState, useEffect } from 'react';
import { DataTable, SearchBar, Button, Badge, Alert } from '../../components/common';
import type { TransferenciaActivo } from '../../types/transferencias.types';
import { transferenciasService } from '../../services/transferencias.service';
import '../../styles/modules.css';

export const TransferenciasPage: React.FC = () => {
  const [transferencias, setTransferencias] = useState<TransferenciaActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    cargarTransferencias();
  }, []);

  const cargarTransferencias = async () => {
    try {
      setLoading(true);
      const resultado = await transferenciasService.obtenerTransferencias();
      setTransferencias(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar transferencias' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: string): any => {
    const colores: Record<string, any> = {
      'pendiente': 'warning',
      'aprobada': 'success',
      'rechazada': 'danger',
      'completada': 'info',
    };
    return colores[estado] || 'secondary';
  };

  const columns = [
    {
      header: 'Activo',
      accessor: (row: TransferenciaActivo) => row.activo?.nombre || 'N/A',
    },
    { header: 'Área Origen', accessor: 'areaOrigenNombre' },
    { header: 'Área Destino', accessor: 'areaDestinoNombre' },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getEstadoColor(value)} size="sm" />
      ),
    },
    { header: 'Motivo', accessor: 'motivo' },
    {
      header: 'Fecha',
      accessor: 'fechaSolicitud',
      render: (value: Date) => new Date(value).toLocaleDateString('es-ES'),
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (id: string) => (
        <div className="actions-group">
          <button className="btn-action btn-view" title="Ver detalles">👁️</button>
          <button className="btn-action btn-edit" title="Editar">✏️</button>
        </div>
      ),
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Asignaciones y Transferencias</h1>
        <Button label="+ Nueva Transferencia" variant="primary" />
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      <div className="module-list">
        <div className="list-header">
          <SearchBar
            onSearch={() => {}}
            placeholder="Buscar transferencias..."
            showFilters
          />
        </div>
        <DataTable<TransferenciaActivo>
          columns={columns}
          data={transferencias}
          loading={loading}
          emptyMessage="No hay transferencias registradas"
          striped
          hover
        />
      </div>
    </div>
  );
};

export default TransferenciasPage;
