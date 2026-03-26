import React, { useState, useEffect } from 'react';
import { DataTable, SearchBar, Button, Badge, Alert } from '../../components/common';
import type { Auditoria } from '../../types/auditoria.types';
import { auditoriaService } from '../../services/auditoria.service';
import '../../styles/modules.css';

export const AuditoriaPage: React.FC = () => {
  const [registros, setRegistros] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    cargarRegistros();
  }, []);

  const cargarRegistros = async () => {
    try {
      setLoading(true);
      const resultado = await auditoriaService.obtenerRegistros();
      setRegistros(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar auditoría' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (accion: string): any => {
    const colores: Record<string, any> = {
      'crear': 'success',
      'actualizar': 'warning',
      'eliminar': 'danger',
      'descargar': 'info',
      'acceder': 'primary',
      'exportar': 'info',
    };
    return colores[accion] || 'secondary';
  };

  const getResultadoColor = (resultado: string): any => {
    return resultado === 'exitoso' ? 'success' : 'danger';
  };

  const columns = [
    {
      header: 'Usuario',
      accessor: (row: Auditoria) => row.usuario ? `${row.usuario.nombres} ${row.usuario.apellidos}` : 'N/A',
    },
    {
      header: 'Acción',
      accessor: 'accion',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getActionColor(value)} size="sm" />
      ),
    },
    { header: 'Módulo', accessor: 'modulo' },
    { header: 'Recurso', accessor: 'recursoTipo' },
    { header: 'Descripción', accessor: 'descripcion' },
    {
      header: 'Resultado',
      accessor: 'resultado',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getResultadoColor(value)} size="sm" />
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fechaHora',
      render: (value: Date) => new Date(value).toLocaleDateString('es-ES'),
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Auditoría del Sistema</h1>
        <Button label="Exportar" variant="secondary" />
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
            placeholder="Buscar en auditoría..."
            showFilters
          />
        </div>
        <DataTable<Auditoria>
          columns={columns}
          data={registros}
          loading={loading}
          emptyMessage="No hay registros de auditoría"
          striped
          hover
          paginated
          pageSize={20}
        />
      </div>
    </div>
  );
};

export default AuditoriaPage;
