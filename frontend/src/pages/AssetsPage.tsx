import { useCallback, useEffect, useState } from 'react';

import EditAssetModal from '../components/activos/EditAssetModal';
import ViewAssetModal from '../components/activos/ViewAssetModal';
import OverlayModal from '../components/common/OverlayModal';
import CreateAssetPage from './CreateAssetPage';
import AssetDetailPanel from '../components/assets/AssetDetailPanel';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { getAreas, getCategorias, getUbicaciones, getUsuarios } from '../services/catalogs.service';
import {
  assignAsset,
  createFakeAssets,
  deleteFakeAssets,
  deleteAsset,
  getAssetById,
  searchAssets,
} from '../services/assets.service';
import { HttpError } from '../services/http.client';
import type {
  Area,
  AssetDetail,
  AssetListItem,
  AssetSortBy,
  Categoria,
  EstadoActivo,
  PaginationMeta,
  SearchAssetsParams,
  SortType,
  Ubicacion,
  UsuarioResumen,
} from '../types/assets.types';
import { SmartTable } from '../components/common/SmartTable';
import type { ColumnDef, ActionDef } from '../components/common/SmartTable';
import { FilterRow } from '../components/common/FilterRow';
import type { FilterQuery } from '../components/common/FilterRow';

import '../styles/assets.css';
import { IconInfo, IconEdit, IconGrid } from '@/components/common/Icon';

const ESTADO_OPTIONS: { value: EstadoActivo; label: string }[] = [
  { value: 'OPERATIVO', label: 'Operativo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'FUERA_DE_SERVICIO', label: 'Fuera de servicio' },
  { value: 'DADO_DE_BAJA', label: 'Dado de baja' },
];

const ESTADO_CLASS: Record<string, string> = {
  OPERATIVO: 'statusBadge--activo',
  MANTENIMIENTO: 'statusBadge--mantenimiento',
  FUERA_DE_SERVICIO: 'statusBadge--fuera',
  DADO_DE_BAJA: 'statusBadge--baja',
};

const PAGE_SIZE = 10;

export default function AssetsPage() {
  const { hasPermission } = useAuth();
  const notify = useNotification();
  const { error: notifyError, success: notifySuccess } = notify;

  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([]);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoActivo | ''>('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterUbicacion, setFilterUbicacion] = useState('');
  const [sortBy, setSortBy] = useState<AssetSortBy>('creadoEn');
  const [sortType, setSortType] = useState<SortType>('DESC');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<AssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [assigningAsset, setAssigningAsset] = useState<AssetListItem | null>(null);
  const [assignmentType, setAssignmentType] = useState<'usuario' | 'area'>('usuario');
  const [assignmentTargetId, setAssignmentTargetId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [creatingFakeAssets, setCreatingFakeAssets] = useState(false);
  const [deletingFakeAssets, setDeletingFakeAssets] = useState(false);

  const [showCreateAssetModal, setShowCreateAssetModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [cats, ubis, loadedAreas, loadedUsuarios] = await Promise.all([
          getCategorias(),
          getUbicaciones(),
          getAreas(),
          getUsuarios(),
        ]);
        setCategorias(cats);
        setUbicaciones(ubis);
        setAreas(loadedAreas);
        setUsuarios(loadedUsuarios);
      } catch {
        // Ignore catalog load failures so the page can still render the table.
      }
    }

    void loadCatalogs();
  }, []);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params: SearchAssetsParams = {
        page: currentPage,
        pageSize: PAGE_SIZE,
      };

      if (filterSearch) params.q = filterSearch;
      if (filterEstado) params.estado = filterEstado;
      if (filterCategoria) params.categoriaId = filterCategoria;
      if (filterUbicacion) params.ubicacionId = filterUbicacion;
      params.sortBy = sortBy;
      params.sortType = sortType;

      const result = await searchAssets(params);
      setAssets(result.data ?? []);
      setMeta(result.meta ?? null);
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : 'No se pudo cargar la lista de activos';
      notifyError('Error al cargar activos', message);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    filterSearch,
    filterEstado,
    filterCategoria,
    filterUbicacion,
    sortBy,
    sortType,
    notifyError,
  ]);

  const refreshAssetDetail = useCallback(
    async (assetId: string) => {
      try {
        setDetailLoading(true);
        setDetailError('');
        const response = await getAssetById(assetId);
        setSelectedAssetDetail(response.data);
      } catch (error) {
        const message =
          error instanceof HttpError ? error.message : 'No se pudo cargar el detalle del activo';
        setSelectedAssetDetail(null);
        setDetailError(message);
        notifyError('Error al cargar detalle', message);
      } finally {
        setDetailLoading(false);
      }
    },
    [notifyError],
  );

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (!selectedAssetId) {
      setSelectedAssetDetail(null);
      setDetailError('');
      setDetailLoading(false);
      return;
    }

    void refreshAssetDetail(selectedAssetId);
  }, [selectedAssetId, refreshAssetDetail]);

  function handleFilterChange(query: FilterQuery) {
    setFilterSearch(query.search ?? '');
    setFilterEstado((query.estado ?? '') as EstadoActivo | '');
    setFilterCategoria(query.categoria ?? '');
    setFilterUbicacion(query.ubicacion ?? '');
    setCurrentPage(1);
  }

  function getDefaultSortType(column: AssetSortBy): SortType {
    return column === 'codigo' ||
      column === 'nombre' ||
      column === 'categoria' ||
      column === 'ubicacion' ||
      column === 'responsable'
      ? 'ASC'
      : 'DESC';
  }

  function handleSort(column: AssetSortBy) {
    setCurrentPage(1);

    if (sortBy === column) {
      setSortType((currentSortType) => (currentSortType === 'ASC' ? 'DESC' : 'ASC'));
      return;
    }

    setSortBy(column);
    setSortType(getDefaultSortType(column));
  }

  function renderSortLabel(label: string, column: AssetSortBy) {
    const isActive = sortBy === column;
    const direction = isActive ? sortType : null;

    return (
      <button
        type="button"
        className={`assetsTable__sortButton ${isActive ? 'assetsTable__sortButton--active' : ''}`}
        onClick={() => handleSort(column)}
      >
        <span>{label}</span>
        <span
          className={`assetsTable__sortIcon ${
            direction === 'ASC'
              ? 'assetsTable__sortIcon--asc'
              : direction === 'DESC'
                ? 'assetsTable__sortIcon--desc'
                : ''
          }`}
        >
          {direction === 'ASC' ? '▲' : direction === 'DESC' ? '▼' : '↕'}
        </span>
      </button>
    );
  }

  function openDetailPanel(assetId: string) {
    setSelectedAssetId(assetId);
  }

  function closeDetailPanel() {
    setSelectedAssetId(null);
    setSelectedAssetDetail(null);
    setDetailError('');
    setDetailLoading(false);
  }

  async function handleDelete(id: string, nombre: string) {
    if (!window.confirm(`¿Está seguro de dar de baja el activo "${nombre}"?`)) return;

    try {
      await deleteAsset(id);
      notifySuccess('Activo dado de baja', `"${nombre}" fue dado de baja exitosamente.`);

      if (selectedAssetId === id) {
        closeDetailPanel();
      }

      await loadAssets();
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo dar de baja el activo';
      notifyError('Error', message);
    }
  }

  function openAssignModal(asset: AssetListItem) {
    setAssigningAsset(asset);

    if (asset.responsable?.id) {
      setAssignmentType('usuario');
      setAssignmentTargetId(asset.responsable.id);
    } else if (asset.area?.id) {
      setAssignmentType('area');
      setAssignmentTargetId(asset.area.id);
    } else {
      setAssignmentType('usuario');
      setAssignmentTargetId('');
    }

    setAssignmentNotes('');
  }

  function closeAssignModal() {
    if (submittingAssignment) return;
    setAssigningAsset(null);
    setAssignmentType('usuario');
    setAssignmentTargetId('');
    setAssignmentNotes('');
  }

  async function handleAssignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!assigningAsset || !assignmentTargetId) {
      notifyError('Asignación incompleta', 'Seleccione un usuario o un área para continuar.');
      return;
    }

    try {
      setSubmittingAssignment(true);

      const payload =
        assignmentType === 'usuario'
          ? {
              usuarioAsignadoId: assignmentTargetId,
              observaciones: assignmentNotes.trim() || undefined,
            }
          : {
              areaAsignadaId: assignmentTargetId,
              observaciones: assignmentNotes.trim() || undefined,
            };

      const response = await assignAsset(assigningAsset.id, payload);
      notifySuccess('Activo asignado', response.data.message);

      const assignedAssetId = assigningAsset.id;
      setAssigningAsset(null);
      setAssignmentType('usuario');
      setAssignmentTargetId('');
      setAssignmentNotes('');

      await loadAssets();

      if (selectedAssetId === assignedAssetId) {
        await refreshAssetDetail(assignedAssetId);
      }
    } catch (err) {
      const message =
        err instanceof HttpError ? err.message : 'No se pudo asignar el responsable del activo';
      notifyError('Error al asignar activo', message);
    } finally {
      setSubmittingAssignment(false);
    }
  }

  async function handleCreateFakeAssets() {
    const confirmed = window.confirm(
      'Esto insertará 1000 activos ficticios para pruebas de filtros y ordenación. ¿Desea continuar?',
    );

    if (!confirmed) return;

    try {
      setCreatingFakeAssets(true);
      const response = await createFakeAssets(1000);
      notifySuccess(
        'Carga demo completada',
        `Se insertaron ${response.data.inserted} activos ficticios.`,
      );
      setCurrentPage(1);
      await loadAssets();
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : 'No se pudieron generar los activos ficticios';
      notifyError('Error al cargar datos demo', message);
    } finally {
      setCreatingFakeAssets(false);
    }
  }

  async function handleDeleteFakeAssets() {
    const confirmed = window.confirm(
      'Esto eliminará únicamente los activos demo generados con el botón rápido. ¿Desea continuar?',
    );

    if (!confirmed) return;

    try {
      setDeletingFakeAssets(true);
      const response = await deleteFakeAssets();
      notifySuccess(
        'Limpieza demo completada',
        `Se eliminaron ${response.data.deleted} activos ficticios.`,
      );
      closeDetailPanel();
      setCurrentPage(1);
      await loadAssets();
    } catch (error) {
      const message =
        error instanceof HttpError
          ? error.message
          : 'No se pudieron eliminar los activos ficticios';
      notifyError('Error al limpiar datos demo', message);
    } finally {
      setDeletingFakeAssets(false);
    }
  }

  const assignmentOptions =
    assignmentType === 'usuario'
      ? usuarios.map((usuario) => ({
          id: usuario.id,
          label:
            usuario.nombreCompleto ||
            [usuario.nombres, usuario.apellidos].filter(Boolean).join(' '),
          helper: usuario.correo,
        }))
      : areas.map((area) => ({
          id: area.id,
          label: area.nombre,
          helper: 'Área',
        }));

  const totalPages = meta?.totalPages ?? 1;
  const canCreateAssets = hasPermission('ASSET_CREATE');
  const canUpdateAssets = hasPermission('ASSET_UPDATE');
  const canAssignAssets = hasPermission('ASSET_ASSIGN');

  function buildPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i += 1) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');

    pages.push(totalPages);
    return pages;
  }

  return (
    <section className="assetsPage">
      <header className="assetsPage__header">
        <div>
          <h1 className="assetsPage__title">Gestión de Activos</h1>
          <p className="assetsPage__subtitle">
            Consulta, filtra y administra todo el inventario de la institución.
          </p>
        </div>
        <div className="assetsPage__actions">
          <button
            type="button"
            className="assetsPage__ghostAction"
            onClick={() => void handleCreateFakeAssets()}
            disabled={creatingFakeAssets}
            title="Carga rápida de activos demo"
          >
            {creatingFakeAssets ? 'Cargando demo...' : 'demo x1000'}
          </button>
          <button
            type="button"
            className="assetsPage__ghostAction assetsPage__ghostAction--danger"
            onClick={() => void handleDeleteFakeAssets()}
            disabled={deletingFakeAssets}
            title="Eliminar activos demo"
          >
            {deletingFakeAssets ? 'Limpiando...' : 'limpiar demo'}
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => notify.info('Exportar', 'Funcionalidad en desarrollo')}
          >
            <span>↓</span> Exportar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowCreateAssetModal(true)}
            disabled={!canCreateAssets}
            title={!canCreateAssets ? 'No tienes permiso para registrar activos' : undefined}
          >
            <span>+</span> Nuevo Activo
          </button>
        </div>
      </header>

      <FilterRow
        onChange={handleFilterChange}
        elements={[
          {
            type: 'search',
            key: 'search',
            label: 'BUSCAR',
            placeholder: 'Código, nombre, responsable, categoría o ubicación...',
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
            key: 'ubicacion',
            label: 'UBICACIÓN',
            placeholder: 'Cualquiera',
            options: ubicaciones.map((u) => ({
              value: u.id,
              label: [u.nombre, u.edificio].filter(Boolean).join(' — '),
            })),
          },
          {
            type: 'select',
            key: 'estado',
            label: 'ESTADO',
            placeholder: 'Todos',
            options: ESTADO_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          },
        ]}
      />

      <div className={`assetsWorkspace ${selectedAssetId ? 'assetsWorkspace--detailOpen' : ''}`}>
        <aside
          className={`assetsWorkspace__panel ${selectedAssetId ? 'assetsWorkspace__panel--open' : ''}`}
        >

        </aside>

        <div className="assetsWorkspace__content">
          {/* ── Column definitions ────────────────────────────── */}
          {(() => {
            const assetColumns: ColumnDef<AssetListItem>[] = [
              {
                id: 'codigo',
                header: 'Código',
                accessor: 'codigo',
                width: 110,
                headerContent: renderSortLabel('Código', 'codigo'),
              },
              {
                id: 'nombre',
                header: 'Nombre',
                accessor: 'nombre',
                primary: true,
                width: 200,
                headerContent: renderSortLabel('Activo', 'nombre'),
              },
              {
                id: 'categoria',
                header: 'Categoría',
                accessor: (row) => row.categoria?.nombre ?? null,
                width: 150,
                headerContent: renderSortLabel('Categoría', 'categoria'),
                render: (value, row) =>
                  row.categoria ? (
                    <span className="assetsTable__category">
                      {row.categoria.nombre}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                id: 'ubicacion',
                header: 'Ubicación',
                accessor: (row) => row.ubicacion?.nombre ?? '—',
                width: 150,
                headerContent: renderSortLabel('Ubicación', 'ubicacion'),
              },
              {
                id: 'responsable',
                header: 'Responsable',
                accessor: (row) => row.responsable?.nombreCompleto ?? '—',
                width: 180,
                headerContent: renderSortLabel('Responsable', 'responsable'),
                render: (_value, row) => (
                  <div className="assetsResponsible">
                    <span>{row.responsable?.nombreCompleto ?? '—'}</span>
                    {row.area?.nombre ? (
                      <span className="assetsResponsible__meta">Área: {row.area.nombre}</span>
                    ) : null}
                  </div>
                ),
              },
              {
                id: 'estado',
                header: 'Estado',
                accessor: 'estado',
                width: 150,
                headerContent: renderSortLabel('Estado', 'estado'),
                render: (value, row) => (
                  <span className={`statusBadge ${ESTADO_CLASS[value as string] ?? ''}`}>
                    {row.estadoLabel}
                  </span>
                ),
              },
            ];

            const assetActions: ActionDef<AssetListItem>[] = [
              {
                label: 'Ver detalle',
                icon: <IconInfo/>,
                onClick: (asset) => setViewingAssetId(asset.id),
              },
            ];

            if (canUpdateAssets) {
              assetActions.push({
                label: 'Editar',
                icon: <IconEdit/>,
                onClick: (asset) => setEditingAssetId(asset.id),
              });
            }

            if (canAssignAssets) {
              assetActions.push({
                label: 'Asignar',
                icon: <IconGrid/>,
                onClick: (asset) => openAssignModal(asset),
              });
            }

            if (canUpdateAssets) {
              assetActions.push({
                label: 'Dar de baja',
                icon: '⋯',
                variant: 'danger',
                onClick: (asset) => void handleDelete(asset.id, asset.nombre),
              });
            }

            return (
              <div className="assetsTable__wrap">
                <SmartTable<AssetListItem>
                  columns={assetColumns}
                  data={assets}
                  loading={loading}
                  keyExtractor={(a) => a.id}
                  emptyMessage="No se encontraron activos con los filtros seleccionados."
                  sortable={false}
                  onRowClick={(asset) => openDetailPanel(asset.id)}
                  actions={assetActions}
                />

                {/* Server-side pagination */}
                {!loading && assets.length > 0 && (
                  <div className="assetsPagination">
                    <span className="assetsPagination__info">
                      Mostrando{' '}
                      <strong>
                        {(currentPage - 1) * PAGE_SIZE + 1}–
                        {Math.min(currentPage * PAGE_SIZE, meta?.total ?? 0)}
                      </strong>{' '}
                      de <strong>{meta?.total ?? 0}</strong> activos registrados
                    </span>

                    <div className="assetsPagination__controls">
                      <button
                        type="button"
                        className="pageBtn"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((page) => page - 1)}
                      >
                        &lt; Anterior
                      </button>

                      {buildPageNumbers().map((page, index) =>
                        page === '...' ? (
                          <span key={`dots-${index}`} className="pageDots">…</span>
                        ) : (
                          <button
                            key={page}
                            type="button"
                            className={`pageBtn pageBtn--num ${page === currentPage ? 'pageBtn--active' : ''}`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        ),
                      )}

                      <button
                        type="button"
                        className="pageBtn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((page) => page + 1)}
                      >
                        Siguiente &gt;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <OverlayModal
        open={Boolean(assigningAsset)}
        onClose={closeAssignModal}
        title="Asignar activo"
        subtitle={assigningAsset ? `${assigningAsset.codigo} · ${assigningAsset.nombre}` : ''}
        disabled={submittingAssignment}
        width="560px"
      >
        {assigningAsset ? (
          <form className="assetsModal__form" onSubmit={handleAssignSubmit}>
              <label className="assetsModal__field">
                <span className="assetsFilters__label">Tipo de asignación</span>
                <select
                  className="assetsFilters__select"
                  value={assignmentType}
                  onChange={(event) => {
                    setAssignmentType(event.target.value as 'usuario' | 'area');
                    setAssignmentTargetId('');
                  }}
                  disabled={submittingAssignment}
                >
                  <option value="usuario">Usuario</option>
                  <option value="area">Área</option>
                </select>
              </label>

              <label className="assetsModal__field">
                <span className="assetsFilters__label">
                  {assignmentType === 'usuario' ? 'Usuario responsable' : 'Área responsable'}
                </span>
                <select
                  className="assetsFilters__select"
                  value={assignmentTargetId}
                  onChange={(event) => setAssignmentTargetId(event.target.value)}
                  disabled={submittingAssignment}
                  required
                >
                  <option value="">
                    {assignmentType === 'usuario'
                      ? 'Seleccione un usuario'
                      : 'Seleccione un área'}
                  </option>
                  {assignmentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                      {option.helper ? ` · ${option.helper}` : ''}
                    </option>
                  ))}
                </select>

                {!assignmentTargetId ? (
                  <span className="assetsModal__hint assetsModal__hint--error">
                    Debe seleccionar un responsable o un área antes de guardar la asignación.
                  </span>
                ) : null}
              </label>

              <label className="assetsModal__field">
                <span className="assetsFilters__label">Observaciones</span>
                <textarea
                  className="assetsModal__textarea"
                  rows={3}
                  value={assignmentNotes}
                  onChange={(event) => setAssignmentNotes(event.target.value)}
                  placeholder="Opcional"
                  disabled={submittingAssignment}
                />
              </label>

              <div className="overlayModal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={closeAssignModal}
                  disabled={submittingAssignment}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submittingAssignment || !assignmentTargetId}
                >
                  {submittingAssignment ? 'Asignando...' : 'Confirmar asignación'}
                </button>
              </div>
            </form>
        ) : null}
      </OverlayModal>

      {viewingAssetId ? (
        <ViewAssetModal
          assetId={viewingAssetId}
          open={Boolean(viewingAssetId)}
          onClose={() => setViewingAssetId(null)}
        />
      ) : null}

      {editingAssetId ? (
        <EditAssetModal
          assetId={editingAssetId}
          open={Boolean(editingAssetId)}
          onClose={() => setEditingAssetId(null)}
          onUpdated={async () => {
            await loadAssets();

            if (selectedAssetId) {
              await refreshAssetDetail(selectedAssetId);
            }
          }}
        />
      ) : null}

      <CreateAssetPage
        open={showCreateAssetModal}
        onClose={() => {
          setShowCreateAssetModal(false);
          void loadAssets();
        }}
      />
    </section>
  );
}
