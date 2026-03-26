import React, { useState, useEffect } from 'react';
import { DataTable, SearchBar, Button, Badge, LoadingSpinner } from '../common';
import type { Activo, FiltrosActivos } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import '../../styles/modules.css';

interface ActivosListProps {
  onDetails?: (activo: Activo) => void;
  onEdit?: (activo: Activo) => void;
  onDelete?: (activo: Activo) => void;
}

export const ActivosList: React.FC<ActivosListProps> = ({
  onDetails,
  onEdit,
  onDelete,
}) => {
  const [activos, setActivos] = useState<Activo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState<FiltrosActivos>({
    pagina: 1,
    limite: 10,
  });

  useEffect(() => {
    cargarActivos();
  }, [filtros]);

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

  const getEstadoColor = (estado: string): any => {
    const colores: Record<string, any> = {
      'Operacional': 'success',
      'Mantenimiento': 'warning',
      'Reparación': 'warning',
      'Baja': 'danger',
      'Robado': 'danger',
      'Perdido': 'danger',
    };
    return colores[estado] || 'secondary';
  };

  const columns = [
    { header: 'Código', accessor: 'codigoActivo', width: '100px', sortable: true },
    { header: 'Nombre', accessor: 'nombre', sortable: true },
    { header: 'Categoría', accessor: (row: Activo) => row.categoriaActivo?.nombre || 'N/A' },
    { header: 'Ubicación', accessor: (row: Activo) => row.ubicacion?.nombre || 'N/A' },
    {
      header: 'Estado',
      accessor: 'estado',
      render: (value: string) => (
        <Badge label={value} variant={getEstadoColor(value)} size="sm" />
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
        <div className="actions-group">
          {onDetails && (
            <button
              className="btn-action btn-view"
              onClick={() => onDetails(row)}
              title="Ver detalles"
            >
              👁️
            </button>
          )}
          {onEdit && (
            <button
              className="btn-action btn-edit"
              onClick={() => onEdit(row)}
              title="Editar"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              className="btn-action btn-delete"
              onClick={() => onDelete(row)}
              title="Eliminar"
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
    </div>
  );
};

export default ActivosList;
