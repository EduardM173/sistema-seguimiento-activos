import React, { useState, useEffect } from 'react';
import { DataTable, Button, Badge } from '../../components/common';
import type { CategoriaMaterial, Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import MaterialForm from '../../components/inventario/MaterialForm';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/modules.css';
import '../../styles/assets.css';
import IngresoStockModal from '../../components/inventario/IngresoStockModal';
import { FilterRow } from '../../components/common/FilterRow';
import type { FilterQuery } from '../../components/common/FilterRow';

export const InventarioPage: React.FC = () => {
  const notify = useNotification();
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error'; text: string } | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIngresoModalOpen, setIsIngresoModalOpen] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaMaterial[]>([]);
  const [searchText, setSearchText] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [estado, setEstado] = useState<'CRITICO' | 'NORMAL' | ''>('');
  const [sortBy, setSortBy] = useState<'codigo' | 'nombre' | 'categoria' | 'stockActual' | 'stockMinimo' | 'unidad' | 'creadoEn'>('creadoEn');
  const [sortType, setSortType] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageSize: 10, totalPages: 1 });
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [deletingDemo, setDeletingDemo] = useState(false);

  useEffect(() => {
    cargarMateriales();
  }, [refreshKey, searchText, categoriaId, estado, sortBy, sortType, currentPage]);

  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const data = await inventarioService.obtenerCategorias();
        setCategorias(data);
      } catch {
        // noop
      }
    };

    void cargarCategorias();
  }, []);

  const cargarMateriales = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const resultado = await inventarioService.obtenerTodos({
        q: searchText || undefined,
        categoriaId: categoriaId || undefined,
        estado: estado || undefined,
        page: currentPage,
        pageSize: 10,
        sortBy,
        sortType,
      });
      setMateriales(resultado.data);
      setMeta({
        total: resultado.total,
        pageSize: resultado.pageSize,
        totalPages: resultado.totalPages,
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar inventario' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialCreated = async () => {
    setCurrentPage(1);
    setRefreshKey(prev => prev + 1);
  };

  const handleEdit = (material: Material) => {
    setMaterialToEdit(material);
    setIsMaterialModalOpen(true);
  };

  const handleDelete = async (material: Material) => {
    if (confirm(`¿Está seguro de eliminar el material "${material.nombre}"?`)) {
      try {
        await inventarioService.eliminar(material.id);
        notify.success('Material eliminado correctamente');
        setRefreshKey(prev => prev + 1);
      } catch (err) {
        notify.error('Error', 'No se pudo eliminar el material');
      }
    }
  };

  const handleCloseModal = () => {
    setIsMaterialModalOpen(false);
    setMaterialToEdit(null);
  };

  const handleFilterChange = (query: FilterQuery) => {
    setSearchText(query.search ?? '');
    setCategoriaId(query.categoria ?? '');
    setEstado((query.estado ?? '') as 'CRITICO' | 'NORMAL' | '');
    setSortBy((query.sortBy || 'creadoEn') as typeof sortBy);
    setSortType((query.sortType || 'DESC') as 'ASC' | 'DESC');
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchText('');
    setCategoriaId('');
    setEstado('');
    setSortBy('creadoEn');
    setSortType('DESC');
    setCurrentPage(1);
  };

  const handleCreateDemo = async () => {
    const confirmed = window.confirm(
      'Esto insertará 100 materiales ficticios para pruebas de filtros, paginación y ordenación. ¿Desea continuar?',
    );

    if (!confirmed) return;

    try {
      setCreatingDemo(true);
      const response = await inventarioService.crearDemo(100);
      notify.success('Carga demo completada', `Se insertaron ${response.data?.inserted ?? 100} materiales ficticios.`);
      setCurrentPage(1);
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudieron generar materiales demo');
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleDeleteDemo = async () => {
    const confirmed = window.confirm(
      'Esto eliminará únicamente los materiales demo generados con el botón rápido. ¿Desea continuar?',
    );

    if (!confirmed) return;

    try {
      setDeletingDemo(true);
      const response = await inventarioService.eliminarDemo();
      notify.success('Limpieza demo completada', `Se eliminaron ${response.data?.deleted ?? 0} materiales ficticios.`);
      setCurrentPage(1);
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudieron eliminar materiales demo');
    } finally {
      setDeletingDemo(false);
    }
  };

  const getStockColor = (stockActual: number, stockMinimo: number): string => {
    if (stockActual <= 0) return '#dc2626';
    if (stockActual < stockMinimo) return '#dc2626';
    return '#10b981';
  };

  const getStockStatus = (
    stockActual: number,
    stockMinimo: number
  ): { label: string; variant: 'danger' | 'warning' | 'success' } => {
    if (stockActual <= 0) return { label: 'SIN STOCK', variant: 'danger' };
    if (stockActual < stockMinimo) return { label: 'CRÍTICO', variant: 'danger' };
    return { label: 'NORMAL', variant: 'success' };
  };

  const columns = [
    { header: 'Código', accessor: 'codigo' as keyof Material, width: '100px' },
    { header: 'Nombre', accessor: 'nombre' as keyof Material },
    { header: 'Categoría', accessor: (row: Material) => row.categoria?.nombre || 'N/A' },
    {
      header: 'Disponible',
      accessor: (row: Material) => row.stockActual,
      render: (value: number, row: Material) => (
        <strong style={{ color: getStockColor(row.stockActual, row.stockMinimo) }}>
          {value.toFixed(2)}
        </strong>
      ),
    },
    {
      header: 'Mínimo',
      accessor: 'stockMinimo' as keyof Material,
      render: (value: number) => value.toFixed(2),
    },
    { header: 'Un. Medida', accessor: 'unidad' as keyof Material, width: '100px' },
    {
      header: 'Estado',
      accessor: (row: Material) => row,
      render: (row: Material) => {
        const status = getStockStatus(row.stockActual, row.stockMinimo);
        return <Badge label={status.label} variant={status.variant} size="sm" />;
      },
    },
    {
      header: 'Acciones',
      accessor: (row: Material) => row.id,
      render: (_id: string, row: Material) => (
        <div className="actions-group" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-action btn-edit"
            onClick={() => handleEdit(row)}
            title="Editar"
            style={{
              cursor: 'pointer',
              padding: '4px 8px',
              background: '#e0e7ff',
              borderRadius: '4px',
              border: 'none',
            }}
          >
            ✏️ Editar
          </button>
          <button
            className="btn-action btn-delete"
            onClick={() => handleDelete(row)}
            title="Eliminar"
            style={{
              cursor: 'pointer',
              padding: '4px 8px',
              background: '#fee2e2',
              borderRadius: '4px',
              border: 'none',
              color: '#dc2626',
            }}
          >
            🗑️ Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Inventario</h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => void handleCreateDemo()}
            disabled={creatingDemo}
            title="Carga rápida de materiales demo"
            style={{
              border: '1px dashed rgba(100, 116, 139, 0.45)',
              background: 'rgba(255,255,255,0.7)',
              color: '#64748b',
              borderRadius: '999px',
              padding: '6px 10px',
              fontSize: '0.73rem',
              fontWeight: 700,
              opacity: 0.55,
              cursor: creatingDemo ? 'wait' : 'pointer',
            }}
          >
            {creatingDemo ? 'cargando...' : 'demo x100'}
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteDemo()}
            disabled={deletingDemo}
            title="Eliminar materiales demo"
            style={{
              border: '1px dashed rgba(220, 38, 38, 0.35)',
              background: 'rgba(255,255,255,0.7)',
              color: '#991b1b',
              borderRadius: '999px',
              padding: '6px 10px',
              fontSize: '0.73rem',
              fontWeight: 700,
              opacity: 0.5,
              cursor: deletingDemo ? 'wait' : 'pointer',
            }}
          >
            {deletingDemo ? 'limpiando...' : 'limpiar demo'}
          </button>
          <Button
            label="+ Nuevo Material"
            variant="primary"
            onClick={() => {
              setMaterialToEdit(null);
              setIsMaterialModalOpen(true);
            }}
          />

          <Button
            label="+ Registrar ingreso"
            variant="primary"
            onClick={() => {
              setIsIngresoModalOpen(true);
            }}
          />
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: '12px', color: '#dc2626' }}>
          {message.text}
        </div>
      )}

      <FilterRow
        onChange={handleFilterChange}
        elements={[
          {
            type: 'search',
            key: 'search',
            label: 'BUSCAR',
            placeholder: 'Código o nombre...',
            flex: 2,
          },
          {
            type: 'select',
            key: 'categoria',
            label: 'CATEGORÍA',
            placeholder: 'Todas',
            options: categorias.map((c) => ({ value: c.id, label: c.nombre })),
          },
          {
            type: 'select',
            key: 'estado',
            label: 'ESTADO',
            placeholder: 'Todos',
            options: [
              { value: 'NORMAL', label: 'Normal' },
              { value: 'CRITICO', label: 'Crítico' },
            ],
          },
          {
            type: 'select',
            key: 'sortBy',
            label: 'ORDENAR POR',
            placeholder: 'Más recientes',
            options: [
              { value: 'creadoEn', label: 'Más recientes' },
              { value: 'codigo', label: 'Código' },
              { value: 'nombre', label: 'Nombre' },
              { value: 'categoria', label: 'Categoría' },
              { value: 'stockActual', label: 'Stock actual' },
              { value: 'stockMinimo', label: 'Stock mínimo' },
              { value: 'unidad', label: 'Unidad' },
            ],
          },
          {
            type: 'select',
            key: 'sortType',
            label: 'DIRECCIÓN',
            placeholder: 'Descendente',
            options: [
              { value: 'ASC', label: 'Ascendente' },
              { value: 'DESC', label: 'Descendente' },
            ],
          },
        ]}
      />

      <div className="module-list">
        <DataTable<Material>
          columns={columns}
          data={materiales}
          loading={loading}
          emptyMessage="📦 No hay materiales registrados en el inventario"
          striped
          hover
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginTop: '12px',
          color: '#6b7280',
        }}
      >
        <span>
          Mostrando <strong>{materiales.length === 0 ? 0 : (currentPage - 1) * meta.pageSize + 1}-{Math.min(currentPage * meta.pageSize, meta.total)}</strong> de <strong>{meta.total}</strong> materiales
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff' }}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(prev => Math.min(meta.totalPages, prev + 1))}
            disabled={currentPage >= meta.totalPages}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff' }}
          >
            Siguiente
          </button>
        </div>
      </div>

      <MaterialForm
        isOpen={isMaterialModalOpen}
        onClose={handleCloseModal}
        onCreated={handleMaterialCreated}
        materialToEdit={materialToEdit}
      />

      <IngresoStockModal
        isOpen={isIngresoModalOpen}
        onClose={() => setIsIngresoModalOpen(false)}
        materiales={materiales}
        onSuccess={handleMaterialCreated}
      />
    </div>
  );
};

export default InventarioPage;
