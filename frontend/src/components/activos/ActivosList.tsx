import React, { useState, useEffect } from 'react';
import { DataTable, SearchBar, Button, Badge, LoadingSpinner } from '../common';
import type { Activo, FiltrosActivos, EstadoActivo } from '../../types/activos.types';
import { estadoActivoDisplay } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import BajaActivoModal from './BajaActivoModal';
import '../../styles/modules.css';

interface ActivosListProps {
  onDetails?: (activo: Activo) => void;
  onEdit?: (activo: Activo) => void;
  onDelete?: (activo: Activo) => void;
  onBaja?: (activo: Activo) => void;
}

export const ActivosList: React.FC<ActivosListProps> = ({
  onDetails,
  onEdit,
  onDelete,
  onBaja,
}) => {
  const [activos, setActivos] = useState<Activo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState<FiltrosActivos>({
    pagina: 1,
    limite: 10,
  });
  const [bajaModalOpen, setBajaModalOpen] = useState(false);
  const [selectedActivo, setSelectedActivo] = useState<Activo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    cargarActivos();
  }, [filtros, refreshKey]);

  const cargarActivos = async () => {
    try {
      setLoading(true);
      const resultado = await activosService.obtenerTodos(filtros);
      setActivos(resultado.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los activos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (termino: string) => {
    setBusqueda(termino);
    setFiltros({ ...filtros, busqueda: termino, pagina: 1 });
  };

  const handleOpenBajaModal = (activo: Activo) => {
    setSelectedActivo(activo);
    setBajaModalOpen(true);
  };

  const handleBajaConfirm = async () => {
    setBajaModalOpen(false);
    setSelectedActivo(null);
    setRefreshKey(prev => prev + 1);
    if (onBaja && selectedActivo) {
      onBaja(selectedActivo);
    }
  };

  // Función para obtener color según estado
  const getEstadoColor = (estado: EstadoActivo): any => {
    const colores: Record<EstadoActivo, any> = {
      'OPERATIVO': 'success',
      'MANTENIMIENTO': 'warning',
      'FUERA_DE_SERVICIO': 'danger',
      'DADO_DE_BAJA': 'secondary',
    };
    return colores[estado] || 'secondary';
  };

  // Obtener texto amigable del estado
  const getEstadoDisplay = (estado: EstadoActivo): string => {
    return estadoActivoDisplay[estado] || estado;
  };

  const columns = [
    { header: 'Código', accessor: 'codigoActivo', width: '100px', sortable: true },
    { header: 'Nombre', accessor: 'nombre', sortable: true },
    { header: 'Categoría', accessor: (row: Activo) => row.categoriaActivo?.nombre || 'N/A' },
    { header: 'Ubicación', accessor: (row: Activo) => row.ubicacion?.nombre || 'N/A' },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value: EstadoActivo) => (
        <Badge 
          label={getEstadoDisplay(value)} 
          variant={getEstadoColor(value)} 
          size="sm" 
        />
      ),
    },
    {
      header: 'Valor',
      accessor: 'valorAdquisicion',
      render: (value: number) => `$${value.toLocaleString()}`,
    },
    {
      header: 'Acciones',
      accessor: (row: Activo) => row.id,
      render: (id: string, row: Activo) => (
        <div className="actions-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onDetails && (
            <button
              className="btn-action btn-view"
              onClick={() => onDetails(row)}
              title="Ver detalles"
              style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
            >
              👁️
            </button>
          )}
          {onEdit && row.estado !== 'DADO_DE_BAJA' && (
            <button
              className="btn-action btn-edit"
              onClick={() => onEdit(row)}
              title="Editar"
              style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
            >
              ✏️
            </button>
          )}
          {/* Botón Dar de Baja - solo si no está dado de baja */}
          {row.estado !== 'DADO_DE_BAJA' && (
            <button
              className="btn-action btn-baja"
              onClick={() => handleOpenBajaModal(row)}
              title="Dar de Baja"
              style={{ 
                cursor: 'pointer', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                background: '#fee2e2', 
                color: '#dc2626',
                border: 'none'
              }}
            >
              🗑️ Dar de Baja
            </button>
          )}
          {onDelete && row.estado === 'DADO_DE_BAJA' && (
            <button
              className="btn-action btn-delete"
              onClick={() => onDelete(row)}
              title="Eliminar"
              style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
            >
              🗑️
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="module-list">
      <div className="list-header">
        <SearchBar
          onSearch={handleSearch}
          placeholder="Buscar por código, nombre, ubicación..."
          showFilters
        />
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={cargarActivos} className="btn btn-primary btn-sm">
            Reintentar
          </button>
        </div>
      )}

      <DataTable<Activo>
        columns={columns}
        data={activos}
        loading={loading}
        emptyMessage="No hay activos registrados"
        striped
        hover
      />

      {/* Modal para solicitar motivo de baja */}
      <BajaActivoModal
        isOpen={bajaModalOpen}
        activo={selectedActivo}
        onClose={() => {
          setBajaModalOpen(false);
          setSelectedActivo(null);
        }}
        onConfirm={handleBajaConfirm}
      />
    </div>
  );
};

export default ActivosList;