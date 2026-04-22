import { useEffect, useState, useCallback } from 'react';

import {
  searchLocations,
  deleteLocation,
  type LocationItem,
  type SearchLocationsParams,
} from '../services/locations.service';
import { useNotification } from '../context/NotificationContext';
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

  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterEdificio, setFilterEdificio] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);

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
