import React, { useState, useEffect } from 'react';
import { SearchBar, Badge } from '../common';
import { SmartTable } from '../common/SmartTable';
import type { ColumnDef, ActionDef } from '../common/SmartTable';
import type { Activo, FiltrosActivos, EstadoActivo } from '../../types/activos.types';
import { estadoActivoDisplay } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import { BajaActivoModal } from './BajaActivoModal';
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

  // PROSIN-185: Función para obtener color según estado (alineado con backend)
  const getEstadoColor = (estado: EstadoActivo): 'success' | 'warning' | 'danger' | 'secondary' => {
    const colores: Record<EstadoActivo, 'success' | 'warning' | 'danger' | 'secondary'> = {
      'OPERATIVO': 'success',
      'MANTENIMIENTO': 'warning',
      'FUERA_DE_SERVICIO': 'danger',
      'DADO_DE_BAJA': 'secondary',
    };
    return colores[estado] ?? 'secondary';
  };

  // Obtener texto amigable del estado
  const getEstadoDisplay = (estado: EstadoActivo): string => {
    return estadoActivoDisplay[estado] || estado;
  };

  // ========== NUEVO: Manejar baja de activo ==========
  const handleBajaClick = (activo: Activo) => {
    setSelectedActivo(activo);
    setBajaModalOpen(true);
  };

  const handleBajaSuccess = () => {
    setBajaModalOpen(false);
    setSelectedActivo(null);
    setRefreshKey(prev => prev + 1);
    if (onBaja) onBaja(selectedActivo!);
  };
  // ==================================================

  const columns: ColumnDef<Activo>[] = [
    { id: 'codigoActivo', header: 'Código',    accessor: 'codigoActivo',  width: 110, sortable: true },
    { id: 'nombre',       header: 'Nombre',    accessor: 'nombre',         width: 200, sortable: true, primary: true },
    { id: 'categoria',    header: 'Categoría', accessor: (row) => row.categoriaActivo?.nombre ?? 'N/A', width: 150 },
    { id: 'ubicacion',    header: 'Ubicación', accessor: (row) => row.ubicacion?.nombre ?? 'N/A',        width: 150 },
    {
      id: 'estado',
      header: 'Estado',
      accessor: 'estado',
      width: 140,
      render: (value) => (
        <Badge
          label={getEstadoDisplay(value as EstadoActivo)}
          variant={getEstadoColor(value as EstadoActivo)}
          size="sm"
        />
      ),
    },
    {
      id: 'valor',
      header: 'Valor',
      accessor: 'valorAdquisicion',
      width: 120,
      render: (value) => `$${(value as number).toLocaleString()}`,
    },
  ];

  // ========== NUEVO: Acciones con botón Dar de baja ==========
  // Filtrar acciones según estado del activo (no mostrar "Dar de baja" si ya está DADO_DE_BAJA)
  const getActionsForActivo = (activo: Activo): ActionDef<Activo>[] => {
    const actions: ActionDef<Activo>[] = [];
    
    if (onDetails) {
      actions.push({ label: 'Ver detalles', icon: '👁️', onClick: onDetails });
    }
    if (onEdit) {
      actions.push({ label: 'Editar', icon: '✏️', onClick: onEdit });
    }
    // Solo mostrar "Dar de baja" si el activo NO está dado de baja
    if (activo.estado !== 'DADO_DE_BAJA') {
      actions.push({ 
        label: 'Dar de baja', 
        icon: '🗑️', 
        variant: 'danger' as const, 
        onClick: (a) => handleBajaClick(a) 
      });
    }
    if (onDelete && activo.estado === 'DADO_DE_BAJA') {
      actions.push({ label: 'Eliminar', icon: '❌', variant: 'danger' as const, onClick: onDelete });
    }
    
    return actions;
  };
  // =======================================================

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

      <div className="assetsTable__wrap">
        <SmartTable<Activo>
          columns={columns}
          data={activos}
          loading={loading}
          keyExtractor={(a) => a.id}
          emptyMessage="No hay activos registrados"
          onRowClick={onDetails}
          actions={(row) => getActionsForActivo(row)}
        />
      </div>

      {/* Modal de baja - ya existe */}
      {selectedActivo && (
        <BajaActivoModal
          isOpen={bajaModalOpen}
          activo={selectedActivo}
          onClose={() => {
            setBajaModalOpen(false);
            setSelectedActivo(null);
          }}
          onSuccess={handleBajaSuccess}
        />
      )}
    </div>
  );
};

export default ActivosList;