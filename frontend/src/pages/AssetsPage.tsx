import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import EditAssetModal from '../components/activos/EditAssetModal';
import ViewAssetModal from '../components/activos/ViewAssetModal';
import AssetDetailPanel from '../components/assets/AssetDetailPanel';
import { useNotification } from '../context/NotificationContext';
import { getAreas, getCategorias, getUbicaciones, getUsuarios } from '../services/catalogs.service';
import { assignAsset, deleteAsset, getAssetById, searchAssets } from '../services/assets.service';
import { HttpError } from '../services/http.client';
import type {
  Area,
  AssetDetail,
  AssetListItem,
  Categoria,
  EstadoActivo,
  PaginationMeta,
  SearchAssetsParams,
  Ubicacion,
  UsuarioResumen,
} from '../types/assets.types';

import '../styles/assets.css';

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

const PAGE_SIZE = 6;

export default function AssetsPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const { error: notifyError, success: notifySuccess } = notify;

  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([]);

  const [searchText, setSearchText] = useState('');
  const [filterEstado, setFilterEstado] = useState<EstadoActivo | ''>('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterUbicacion, setFilterUbicacion] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<AssetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [assigningAsset, setAssigningAsset] = useState<AssetListItem | null>(null);
  const [assignmentType, setAssignmentType] = useState<'usuario' | 'area'>('usuario');
  const [assignmentTargetId, setAssignmentTargetId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params: SearchAssetsParams = {
        page: currentPage,
        pageSize: PAGE_SIZE,
      };

      if (debouncedSearch) params.q = debouncedSearch;
      if (filterEstado) params.estado = filterEstado;
      if (filterCategoria) params.categoriaId = filterCategoria;
      if (filterUbicacion) params.ubicacionId = filterUbicacion;

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
  }, [currentPage, debouncedSearch, filterEstado, filterCategoria, filterUbicacion, notifyError]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterEstado, filterCategoria, filterUbicacion]);

  function clearFilters() {
    setSearchText('');
    setFilterEstado('');
    setFilterCategoria('');
    setFilterUbicacion('');
    setCurrentPage(1);
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
            className="btn btn--outline"
            onClick={() => notify.info('Exportar', 'Funcionalidad en desarrollo')}
          >
            <span>↓</span> Exportar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate('/activos/nuevo')}
          >
            <span>+</span> Nuevo Activo
          </button>
        </div>
      </header>

      <div className="assetsFilters">
        <div className="assetsFilters__group">
          <label className="assetsFilters__label">BUSCAR</label>
          <div className="assetsFilters__inputWrap">
            <span className="assetsFilters__searchIcon">🔍</span>
            <input
              type="text"
              className="assetsFilters__input"
              placeholder="Código, nombre, responsable, categoría o ubicación..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
        </div>

        <div className="assetsFilters__group">
          <label className="assetsFilters__label">CATEGORÍA</label>
          <select
            className="assetsFilters__select"
            value={filterCategoria}
            onChange={(event) => setFilterCategoria(event.target.value)}
          >
            <option value="">Todas</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="assetsFilters__group">
          <label className="assetsFilters__label">UBICACIÓN</label>
          <select
            className="assetsFilters__select"
            value={filterUbicacion}
            onChange={(event) => setFilterUbicacion(event.target.value)}
          >
            <option value="">Cualquiera</option>
            {ubicaciones.map((ubi) => (
              <option key={ubi.id} value={ubi.id}>
                {[ubi.nombre, ubi.edificio].filter(Boolean).join(' — ')}
              </option>
            ))}
          </select>
        </div>

        <div className="assetsFilters__group">
          <label className="assetsFilters__label">ESTADO</label>
          <select
            className="assetsFilters__select"
            value={filterEstado}
            onChange={(event) => setFilterEstado(event.target.value as EstadoActivo | '')}
          >
            <option value="">Todos</option>
            {ESTADO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="assetsFilters__clearBtn" onClick={clearFilters}>
          <span>⊘</span> Limpiar Filtros
        </button>
      </div>

      <div className={`assetsWorkspace ${selectedAssetId ? 'assetsWorkspace--detailOpen' : ''}`}>
        <aside
          className={`assetsWorkspace__panel ${selectedAssetId ? 'assetsWorkspace__panel--open' : ''}`}
        >
          <AssetDetailPanel
            asset={selectedAssetDetail}
            loading={detailLoading}
            errorMessage={detailError}
            onClose={closeDetailPanel}
            compact
          />
        </aside>

        <div className="assetsWorkspace__content">
          <div className="assetsCard">
            {loading ? (
              <div className="assetsState">
                <p className="assetsState__text">Cargando activos registrados...</p>
              </div>
            ) : assets.length === 0 ? (
              <div className="assetsState">
                <p className="assetsState__text">
                  No se encontraron activos con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <>
                <div className="assetsTableWrapper">
                  <table className="assetsTable">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Activo</th>
                        <th>Categoría</th>
                        <th>Ubicación</th>
                        <th>Responsable</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => (
                        <tr
                          key={asset.id}
                          className={
                            selectedAssetId === asset.id ? 'assetsTable__row--selected' : ''
                          }
                          onClick={() => openDetailPanel(asset.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="assetsTable__code">{asset.codigo}</td>
                          <td className="assetsTable__name">{asset.nombre}</td>
                          <td>
                            {asset.categoria ? (
                              <span className="assetsTable__category">
                                <span className="assetsTable__catIcon">◫</span>
                                {asset.categoria.nombre}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{asset.ubicacion?.nombre ?? '—'}</td>
                          <td>
                            <div className="assetsResponsible">
                              <span>{asset.responsable?.nombreCompleto ?? '—'}</span>
                              {asset.area?.nombre ? (
                                <span className="assetsResponsible__meta">
                                  Área: {asset.area.nombre}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <span className={`statusBadge ${ESTADO_CLASS[asset.estado] ?? ''}`}>
                              {asset.estadoLabel}
                            </span>
                          </td>
                          <td>
                            <div className="assetsTable__actions">
                              <button
                                type="button"
                                className="actionBtn"
                                title="Ver detalle completo"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setViewingAssetId(asset.id);
                                }}
                              >
                                👁
                              </button>

                              <button
                                type="button"
                                className="actionBtn"
                                title="Editar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingAssetId(asset.id);
                                }}
                              >
                                ✏️
                              </button>

                              <button
                                type="button"
                                className="actionBtn"
                                title="Asignar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openAssignModal(asset);
                                }}
                              >
                                👤
                              </button>

                              <button
                                type="button"
                                className="actionBtn actionBtn--danger"
                                title="Dar de baja"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDelete(asset.id, asset.nombre);
                                }}
                              >
                                ⋯
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="assetsPagination">
                  <span className="assetsPagination__info">
                    Mostrando{' '}
                    <strong>
                      {(currentPage - 1) * PAGE_SIZE + 1}-
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
                        <span key={`dots-${index}`} className="pageDots">
                          …
                        </span>
                      ) : (
                        <button
                          key={page}
                          type="button"
                          className={`pageBtn pageBtn--num ${
                            page === currentPage ? 'pageBtn--active' : ''
                          }`}
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
              </>
            )}
          </div>
        </div>
      </div>

      {assigningAsset ? (
        <div className="assetsModalBackdrop" role="presentation" onClick={closeAssignModal}>
          <div
            className="assetsModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-asset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="assetsModal__header">
              <div>
                <h2 id="assign-asset-title" className="assetsModal__title">
                  Asignar activo
                </h2>
                <p className="assetsModal__subtitle">
                  {assigningAsset.codigo} · {assigningAsset.nombre}
                </p>
              </div>
              <button
                type="button"
                className="actionBtn"
                onClick={closeAssignModal}
                disabled={submittingAssignment}
              >
                ✕
              </button>
            </div>

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

              <div className="assetsModal__actions">
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
          </div>
        </div>
      ) : null}

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
    </section>
  );
}
