import React, { useEffect, useState } from 'react';
import { Button, Badge, SmartTable } from '../../components/common';
import type { ColumnDef, ActionDef } from '../../components/common';
import type { CategoriaMaterial, Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import MaterialForm from '../../components/inventario/MaterialForm';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/modules.css';
import '../../styles/assets.css';
import IngresoStockModal from '../../components/inventario/IngresoStockModal';
import AjusteInventarioModal from '../../components/inventario/AjusteInventarioModal';
import SalidaStockModal from '../../components/inventario/SalidaStockModal';
import { FilterRow } from '../../components/common/FilterRow';
import type { FilterQuery } from '../../components/common/FilterRow';
import { IconClock, IconEdit, IconX } from '@/components/common/Icon';
import OverlayModal from '../../components/common/OverlayModal';
import { useModalUrlSync } from '@/deeplink';

export const InventarioPage: React.FC = () => {
  const notify = useNotification();

  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error'; text: string } | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIngresoModalOpen, setIsIngresoModalOpen] = useState(false);
  const [isSalidaModalOpen, setIsSalidaModalOpen] = useState(false);
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaMaterial[]>([]);
  const [searchText, setSearchText] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [estado, setEstado] = useState<'CRITICO' | 'NORMAL' | ''>('');
  const [sortBy, setSortBy] = useState<
    'codigo' | 'nombre' | 'categoria' | 'stockActual' | 'stockMinimo' | 'unidad' | 'creadoEn'
  >('creadoEn');
  const [sortType, setSortType] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageSize: 10, totalPages: 1 });
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [deletingDemo, setDeletingDemo] = useState(false);

  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [materialSeleccionado, setMaterialSeleccionado] = useState<Material | null>(null);

  // Deeplink URL sync — keeps `?modal=<id>` aligned with each modal's flag.
  useModalUrlSync('material-form', isMaterialModalOpen, setIsMaterialModalOpen);
  useModalUrlSync('ingreso-stock', isIngresoModalOpen, setIsIngresoModalOpen);
  useModalUrlSync('salida-stock', isSalidaModalOpen, setIsSalidaModalOpen);
  useModalUrlSync('ajuste-inventario', isAjusteModalOpen, setIsAjusteModalOpen);
  useModalUrlSync('historial-material', showHistorialModal, setShowHistorialModal);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    void cargarMateriales();
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
    setRefreshKey((prev) => prev + 1);
  };

  const handleEdit = (material: Material) => {
    setMaterialToEdit(material);
    setIsMaterialModalOpen(true);
  };

  const handleDelete = async (material: Material) => {
    const confirmed = window.confirm(
      `¿Está seguro de eliminar el material "${material.nombre}"?`,
    );

    if (!confirmed) return;

    try {
      await inventarioService.eliminar(material.id);
      notify.success('Material eliminado correctamente');
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      notify.error('Error', 'No se pudo eliminar el material');
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

  const cargarHistorial = async (
    material: Material,
    filtros?: { startDate?: string; endDate?: string },
  ) => {
    setLoadingHistorial(true);

    try {
      const data = await inventarioService.obtenerHistorialMaterial(
        material.id,
        filtros,
      );
      setHistorial(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando historial', error);
      setMessage({ type: 'error', text: 'Error al cargar historial' });
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const abrirHistorial = async (material: Material) => {
    setMaterialSeleccionado(material);
    setFechaInicio('');
    setFechaFin('');
    setShowHistorialModal(true);
    await cargarHistorial(material);
  };

  const aplicarFiltroHistorial = async () => {
    if (!materialSeleccionado) return;

    await cargarHistorial(materialSeleccionado, {
      startDate: fechaInicio || undefined,
      endDate: fechaFin || undefined,
    });
  };

  const limpiarFiltroHistorial = async () => {
    if (!materialSeleccionado) return;

    setFechaInicio('');
    setFechaFin('');
    await cargarHistorial(materialSeleccionado);
  };

  const handleCreateDemo = async () => {
    const confirmed = window.confirm(
      'Esto insertará 100 materiales ficticios para pruebas de filtros, paginación y ordenación. ¿Desea continuar?',
    );

    if (!confirmed) return;

    try {
      setCreatingDemo(true);
      const response = await inventarioService.crearDemo(100);
      notify.success(
        'Carga demo completada',
        `Se insertaron ${response.data?.inserted ?? 100} materiales ficticios.`,
      );
      setCurrentPage(1);
      setRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      notify.error(
        'Error',
        err?.message || 'No se pudieron generar materiales demo',
      );
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
      notify.success(
        'Limpieza demo completada',
        `Se eliminaron ${response.data?.deleted ?? 0} materiales ficticios.`,
      );
      setCurrentPage(1);
      setRefreshKey((prev) => prev + 1);
    } catch (err: any) {
      notify.error(
        'Error',
        err?.message || 'No se pudieron eliminar materiales demo',
      );
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
      stockMinimo: number,
    ): { label: string; variant: 'danger' | 'warning' | 'success' } => {
      if (stockActual <= 0) return { label: 'SIN STOCK', variant: 'danger' };
      if (stockActual < stockMinimo) return { label: 'CRÍTICO', variant: 'danger' };
      return { label: 'NORMAL', variant: 'success' };
    };

  const materialActions: ActionDef<Material>[] = [
    {
      label: 'Editar',
      icon: <IconEdit />,
      onClick: (material: Material) => handleEdit(material),
    },
    {
      label: 'Historial',
      icon: <IconClock/>,
      onClick: (material: Material) => void abrirHistorial(material),
    },
    {
      label: 'Eliminar',
      icon: <IconX />,
      variant: 'danger' as const,
      onClick: (material: Material) => void handleDelete(material),
    }
  ];

  const columns: ColumnDef<Material>[] = [
  { id: 'codigo', header: 'Código', accessor: 'codigo', width: 100 },
  { id: 'nombre', header: 'Nombre', primary: true, accessor: 'nombre' },
  {
    id: 'categoria',
    header: 'Categoría',
    accessor: (row: Material) => row.categoria?.nombre || 'N/A',
  },
    {
      id: 'stockActual',
      header: 'Disponible',
      accessor: (row: Material) => row.stockActual,
      render: (value: unknown, row: Material) => (
        <strong style={{ color: getStockColor(row.stockActual, row.stockMinimo) }}>
          {(value as number).toFixed(2)}
        </strong>
      ),
    },
    {
      id: 'stockMinimo',
      header: 'Mínimo',
      accessor: 'stockMinimo',
      render: (value: unknown) => (value as number).toFixed(2),
    },

    { id: 'unidad', header: 'Un. Medida', accessor: 'unidad', width: 100 },

    {
      id: 'estado',
      header: 'Estado',
      accessor: (row: Material) => row.stockActual,
      render: (_value: unknown, row: Material) => {
        const status = getStockStatus(row.stockActual, row.stockMinimo);
        return <Badge label={status.label} variant={status.variant} size="sm" />;
      },
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Gestión de Inventario</h1>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleCreateDemo()}
            disabled={creatingDemo}
            title="Carga rápida de materiales demo"
            style={{ opacity: 0.7 }}
          >
            {creatingDemo ? 'cargando…' : 'demo x100'}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleDeleteDemo()}
            disabled={deletingDemo}
            title="Eliminar materiales demo"
            style={{ opacity: 0.7, color: 'var(--color-danger)' }}
          >
            {deletingDemo ? 'limpiando…' : 'limpiar demo'}
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

          <Button
            label="+ Registrar salida"
            variant="secondary"
            onClick={() => {
              setIsSalidaModalOpen(true);
            }}
          />

          <Button
            label="+ Registrar ajuste"
            variant="secondary"
            onClick={() => {
              setIsAjusteModalOpen(true);
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
        <SmartTable<Material>
          columns={columns}
          data={materiales}
          loading={loading}
          emptyMessage="📦 No hay materiales registrados en el inventario"
          keyExtractor={(m) => m.id}
          actions={materialActions}
          onRowClick={(m) => handleEdit(m)}
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
          color: 'var(--color-text-muted)',
        }}
      >
        <span>
          Mostrando{' '}
          <strong>
            {materiales.length === 0 ? 0 : (currentPage - 1) * meta.pageSize + 1}-
            {Math.min(currentPage * meta.pageSize, meta.total)}
          </strong>{' '}
          de <strong>{meta.total}</strong> materiales
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
            }}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage((prev) => Math.min(meta.totalPages, prev + 1))
            }
            disabled={currentPage >= meta.totalPages}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: '#fff',
            }}
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

      <SalidaStockModal
        isOpen={isSalidaModalOpen}
        onClose={() => setIsSalidaModalOpen(false)}
        materiales={materiales}
        onSuccess={handleMaterialCreated}
      />

      <AjusteInventarioModal
        isOpen={isAjusteModalOpen}
        onClose={() => setIsAjusteModalOpen(false)}
        materiales={materiales}
        onSuccess={handleMaterialCreated}
      />

      <OverlayModal
        open={showHistorialModal && !!materialSeleccionado}
        onClose={() => setShowHistorialModal(false)}
        title="Historial de movimientos"
        subtitle={materialSeleccionado ? `${materialSeleccionado.nombre} (${materialSeleccionado.codigo})` : ''}
        width="900px"
      >
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fecha inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                padding: '9px 12px',
                border: 'var(--input-border)',
                borderRadius: 'var(--input-radius)',
                background: 'var(--input-bg)',
                color: 'var(--color-text-bright)',
                fontFamily: 'var(--font-family)',
                colorScheme: 'dark',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Fecha fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{
                padding: '9px 12px',
                border: 'var(--input-border)',
                borderRadius: 'var(--input-radius)',
                background: 'var(--input-bg)',
                color: 'var(--color-text-bright)',
                fontFamily: 'var(--font-family)',
                colorScheme: 'dark',
              }}
            />
          </div>
          <button
            onClick={() => void aplicarFiltroHistorial()}
            className="btn btn-primary"
          >
            Aplicar filtro
          </button>
          <button
            onClick={() => void limpiarFiltroHistorial()}
            className="btn btn-secondary"
          >
            Limpiar filtro
          </button>
        </div>

        {/* Table */}
        {loadingHistorial ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Cargando historial...</p>
        ) : historial.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No hay movimientos registrados para este material.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)' }}>
                  {['Fecha', 'Tipo', 'Cantidad', 'Responsable', 'Observación'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: '1px solid var(--table-row-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((item, index) => (
                  <tr key={item.id ?? index} style={{ borderBottom: '1px solid var(--table-row-border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text)', fontSize: '0.88rem' }}>
                      {item.fecha ? new Date(item.fecha).toLocaleString('es-BO') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-bright)', fontWeight: 600, fontSize: '0.85rem' }}>{item.tipo ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text)', fontSize: '0.88rem' }}>{item.cantidad ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text)', fontSize: '0.88rem' }}>
                      {item.responsable ?? item.usuario?.nombreCompleto ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      {item.observacion ?? item.motivo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OverlayModal>
    </div>
  );
};

export default InventarioPage;