import { useEffect, useState, useCallback, type FormEvent } from 'react';

import {
  createArea,
  searchLocations,
  deleteLocation,
  getAreaResponsibles,
  getAreasForLocations,
  reassignAreaManager,
  type AreaItem,
  type AreaManagerItem,
  type LocationItem,
  type SearchLocationsParams,
} from '../services/locations.service';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { HttpError } from '../services/http.client';
import type { PaginationMeta } from '../types/assets.types';

import OverlayModal from '../components/common/OverlayModal';
import CreateLocationForm from '../components/common/CreateLocationForm';
import { SmartTable } from '../components/common/SmartTable';
import type { ColumnDef, ActionDef } from '../components/common/SmartTable';
import { FilterRow } from '../components/common/FilterRow';
import type { FilterQuery } from '../components/common/FilterRow';

import '../styles/assets.css';
import '../styles/locations.css';

const PAGE_SIZE = 10;

export default function LocationsPage() {
  const notify = useNotification();
  const { error: notifyError, success: notifySuccess } = notify;
  const { hasPermission } = useAuth();
  const canManageAreas = hasPermission('AREA_MANAGE');

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [areaManagers, setAreaManagers] = useState<AreaManagerItem[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [creatingArea, setCreatingArea] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterEdificio, setFilterEdificio] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [areaNombre, setAreaNombre] = useState('');
  const [areaDescripcion, setAreaDescripcion] = useState('');
  const [areaUbicacionId, setAreaUbicacionId] = useState('');
  const [areaEncargadoId, setAreaEncargadoId] = useState('');
  const [areaManagerDrafts, setAreaManagerDrafts] = useState<Record<string, string>>({});
  const [reassigningAreaId, setReassigningAreaId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true);
      const params: SearchLocationsParams = {
        page: currentPage,
        pageSize: PAGE_SIZE,
      };
      if (debouncedSearch) params.pattern = debouncedSearch;
      if (filterEdificio) params.edificio = filterEdificio;

      const result = await searchLocations(params);
      setLocations(result.data ?? []);
      setMeta(result.meta ?? null);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo cargar las ubicaciones';
      notifyError('Error al cargar ubicaciones', message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, filterEdificio, notifyError]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const loadAreas = useCallback(async () => {
    if (!canManageAreas) return;

    try {
      setLoadingAreas(true);
      const [areasResponse, managersResponse] = await Promise.all([
        getAreasForLocations(),
        getAreaResponsibles(),
      ]);
      setAreas(areasResponse.data ?? []);
      setAreaManagers(managersResponse.data ?? []);
      setAreaManagerDrafts(
        Object.fromEntries(
          (areasResponse.data ?? []).map((area) => [
            area.id,
            area.encargado?.id ?? '',
          ]),
        ),
      );
    } catch (err) {
      const message =
        err instanceof HttpError
          ? err.message
          : 'No se pudo cargar la información de áreas';
      notifyError('Error al cargar áreas', message);
    } finally {
      setLoadingAreas(false);
    }
  }, [canManageAreas, notifyError]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterEdificio]);

  function clearFilters() {
    setSearchText('');
    setFilterEdificio('');
    setCurrentPage(1);
  }

  function handleFilterChange(query: FilterQuery) {
    setSearchText(query.search ?? '');
    setFilterEdificio(query.edificio ?? '');
    setCurrentPage(1);
  }

  async function handleDelete(id: string, nombre: string) {
    if (!window.confirm(`¿Está seguro de eliminar la ubicación "${nombre}"?`)) return;
    try {
      await deleteLocation(id);
      notifySuccess('Ubicación eliminada', `"${nombre}" fue eliminada exitosamente.`);
      void loadLocations();
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo eliminar la ubicación';
      notifyError('Error', message);
    }
  }

  async function handleCreateArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!areaNombre.trim()) {
      notifyError('Área incompleta', 'Ingrese el nombre del área para continuar.');
      return;
    }

    try {
      setCreatingArea(true);
      await createArea({
        nombre: areaNombre.trim(),
        descripcion: areaDescripcion.trim() || undefined,
        ubicacionId: areaUbicacionId || undefined,
        encargadoId: areaEncargadoId || undefined,
      });

      notifySuccess('Área creada', `"${areaNombre.trim()}" fue registrada exitosamente.`);
      setAreaNombre('');
      setAreaDescripcion('');
      setAreaUbicacionId('');
      setAreaEncargadoId('');
      await Promise.all([loadAreas(), loadLocations()]);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo crear el área';
      notifyError('Error al crear área', message);
    } finally {
      setCreatingArea(false);
    }
  }

  async function handleReassignAreaManager(area: AreaItem) {
    const nextManagerId = areaManagerDrafts[area.id] ?? '';
    const currentManagerId = area.encargado?.id ?? '';

    if (nextManagerId === currentManagerId) {
      notify.info('Sin cambios', 'Seleccione otro responsable para reasignar el área.');
      return;
    }

    try {
      setReassigningAreaId(area.id);
      await reassignAreaManager(area.id, {
        encargadoId: nextManagerId || undefined,
      });
      notifySuccess('Responsable reasignado', `Se actualizó el responsable de "${area.nombre}".`);
      await loadAreas();
    } catch (err) {
      const message =
        err instanceof HttpError
          ? err.message
          : 'No se pudo reasignar el responsable del área';
      notifyError('Error al reasignar responsable', message);
    } finally {
      setReassigningAreaId(null);
    }
  }

  const totalPages = meta?.totalPages ?? 1;

  function buildPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  const locationColumns: ColumnDef<LocationItem>[] = [
    { id: 'nombre',      header: 'Nombre',      accessor: 'nombre',      primary: true, width: 200 },
    { id: 'edificio',    header: 'Edificio',    accessor: 'edificio',    width: 140 },
    { id: 'piso',        header: 'Piso',        accessor: 'piso',        width: 80 },
    { id: 'ambiente',    header: 'Ambiente',    accessor: 'ambiente',    width: 100 },
    {
      id: 'descripcion',
      header: 'Descripción',
      accessor: 'descripcion',
      width: 280,
      render: (v) => (
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
          {(v as string | null | undefined) ?? '—'}
        </span>
      ),
    },
  ];

  const locationActions: ActionDef<LocationItem>[] = [
    {
      label: 'Eliminar',
      icon: '🗑',
      variant: 'danger',
      onClick: (loc) => handleDelete(loc.id, loc.nombre),
    },
  ];

  return (
    <section className="assetsPage">
      <header className="assetsPage__header">
        <div>
          <h1 className="assetsPage__title">Gestión de Ubicaciones</h1>
          <p className="assetsPage__subtitle">
            Administra las ubicaciones físicas donde se encuentran los activos de la institución.
          </p>
        </div>
        <div className="assetsPage__actions">
          <button type="button" className="btn btn--primary" onClick={() => setShowCreateModal(true)}>
            <span>+</span> Nueva Ubicación
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterRow
        onChange={handleFilterChange}
        elements={[
          {
            type: 'search',
            key: 'search',
            label: 'BUSCAR',
            placeholder: 'Buscar por nombre de ubicación...',
            flex: 2,
          },
          {
            type: 'text',
            key: 'edificio',
            label: 'EDIFICIO',
            placeholder: 'Filtrar por edificio...',
          },
        ]}
      />

      {/* Table Card */}
      <div className="assetsTable__wrap">
        <SmartTable<LocationItem>
          keyExtractor={(loc) => loc.id}
          loading={loading}
          data={locations}
          emptyMessage="No se encontraron ubicaciones con los filtros seleccionados."
          sortable={false}
          columns={locationColumns}
          actions={locationActions}
        />

        {/* Server-side pagination */}
        {!loading && locations.length > 0 && (
          <div className="assetsPagination">
            <span className="assetsPagination__info">
              Mostrando{' '}
              <strong>
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, meta?.total ?? 0)}
              </strong>{' '}
              de <strong>{meta?.total ?? 0}</strong> ubicaciones
            </span>

            <div className="assetsPagination__controls">
              <button
                type="button"
                className="pageBtn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                &lt; Anterior
              </button>

              {buildPageNumbers().map((page, i) =>
                page === '...' ? (
                  <span key={`dots-${i}`} className="pageDots">…</span>
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
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Siguiente &gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {canManageAreas ? (
        <section className="locationsAreas">
          <div className="locationsAreas__header">
            <div>
              <h2 className="locationsAreas__title">Áreas institucionales</h2>
              <p className="locationsAreas__subtitle">
                Cree áreas, vincúlelas a una ubicación y asigne un Responsable de Área.
              </p>
            </div>
            <span className="locationsAreas__badge">Permiso AREA_MANAGE</span>
          </div>

          <div className="locationsAreas__layout">
            <form className="locationsAreas__form" onSubmit={handleCreateArea}>
              <label className="locationsAreas__field">
                <span>Nombre del área</span>
                <input
                  type="text"
                  value={areaNombre}
                  onChange={(event) => setAreaNombre(event.target.value)}
                  placeholder="Ej. Sistemas"
                  disabled={creatingArea}
                  maxLength={100}
                  required
                />
              </label>

              <label className="locationsAreas__field">
                <span>Ubicación</span>
                <select
                  value={areaUbicacionId}
                  onChange={(event) => setAreaUbicacionId(event.target.value)}
                  disabled={creatingArea}
                >
                  <option value="">Sin ubicación específica</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {[location.nombre, location.edificio, location.piso, location.ambiente]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  ))}
                </select>
              </label>

              <label className="locationsAreas__field">
                <span>Responsable</span>
                <select
                  value={areaEncargadoId}
                  onChange={(event) => setAreaEncargadoId(event.target.value)}
                  disabled={creatingArea || areaManagers.length === 0}
                >
                  <option value="">
                    {areaManagers.length ? 'Sin responsable asignado' : 'No hay responsables disponibles'}
                  </option>
                  {areaManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.nombreCompleto} · {manager.correo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="locationsAreas__field locationsAreas__field--full">
                <span>Descripción</span>
                <textarea
                  value={areaDescripcion}
                  onChange={(event) => setAreaDescripcion(event.target.value)}
                  placeholder="Opcional"
                  disabled={creatingArea}
                  rows={3}
                  maxLength={500}
                />
              </label>

              <div className="locationsAreas__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={creatingArea}
                >
                  {creatingArea ? 'Creando...' : 'Crear Área'}
                </button>
              </div>
            </form>

            <div className="locationsAreas__list">
              <div className="locationsAreas__listHeader">
                <strong>Áreas registradas</strong>
                <span>{loadingAreas ? 'Cargando...' : `${areas.length} área(s)`}</span>
              </div>

              {areas.length === 0 && !loadingAreas ? (
                <p className="locationsAreas__empty">Todavía no hay áreas registradas.</p>
              ) : (
                <div className="locationsAreas__items">
                  {areas.slice(0, 6).map((area) => (
                    <article key={area.id} className="locationsAreas__item">
                      <div>
                        <strong>{area.nombre}</strong>
                        <span>
                          {area.ubicacion?.nombre ?? 'Sin ubicación'} ·{' '}
                          {area.encargado
                            ? `${area.encargado.nombres} ${area.encargado.apellidos}`
                            : 'Sin responsable'}
                        </span>
                      </div>
                      <div className="locationsAreas__itemActions">
                        <span className="locationsAreas__count">
                          {area._count?.activos ?? 0} activos
                        </span>
                        <div className="locationsAreas__reassign">
                          <select
                            value={areaManagerDrafts[area.id] ?? ''}
                            onChange={(event) =>
                              setAreaManagerDrafts((prev) => ({
                                ...prev,
                                [area.id]: event.target.value,
                              }))
                            }
                            disabled={reassigningAreaId === area.id}
                          >
                            <option value="">Sin responsable</option>
                            {areaManagers.map((manager) => (
                              <option key={manager.id} value={manager.id}>
                                {manager.nombreCompleto}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn--outline locationsAreas__reassignBtn"
                            disabled={
                              reassigningAreaId === area.id ||
                              (areaManagerDrafts[area.id] ?? '') === (area.encargado?.id ?? '')
                            }
                            onClick={() => void handleReassignAreaManager(area)}
                          >
                            {reassigningAreaId === area.id ? 'Guardando...' : 'Reasignar'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Create Location Modal */}
      <OverlayModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nueva Ubicación"
        subtitle="Registra una nueva ubicación física en el sistema."
      >
        <CreateLocationForm
          onCreated={() => {
            setShowCreateModal(false);
            void loadLocations();
          }}
          onCancel={() => setShowCreateModal(false)}
        />
      </OverlayModal>
    </section>
  );
}
