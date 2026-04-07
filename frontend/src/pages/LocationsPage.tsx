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
      <div className="assetsFilters">
        <div className="assetsFilters__group">
          <label className="assetsFilters__label">BUSCAR</label>
          <div className="assetsFilters__inputWrap">
            <span className="assetsFilters__searchIcon">🔍</span>
            <input
              type="text"
              className="assetsFilters__input"
              placeholder="Buscar por nombre de ubicación..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>

        <div className="assetsFilters__group">
          <label className="assetsFilters__label">EDIFICIO</label>
          <input
            type="text"
            className="assetsFilters__input"
            placeholder="Filtrar por edificio..."
            value={filterEdificio}
            onChange={(e) => setFilterEdificio(e.target.value)}
          />
        </div>

        <button type="button" className="assetsFilters__clearBtn" onClick={clearFilters}>
          <span>⊘</span> Limpiar Filtros
        </button>
      </div>

      {/* Table Card */}
      <div className="assetsCard">
        {loading ? (
          <div className="assetsState">
            <p className="assetsState__text">Cargando ubicaciones...</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="assetsState">
            <p className="assetsState__text">No se encontraron ubicaciones con los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            <div className="assetsTableWrapper">
              <table className="assetsTable">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Edificio</th>
                    <th>Piso</th>
                    <th>Ambiente</th>
                    <th>Descripción</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id}>
                      <td className="assetsTable__name">{loc.nombre}</td>
                      <td>{loc.edificio ?? '—'}</td>
                      <td>{loc.piso ?? '—'}</td>
                      <td>{loc.ambiente ?? '—'}</td>
                      <td className="locationsTable__desc">{loc.descripcion ?? '—'}</td>
                      <td>
                        <div className="assetsTable__actions">
                          <button
                            type="button"
                            className="actionBtn actionBtn--danger"
                            title="Eliminar"
                            onClick={() => handleDelete(loc.id, loc.nombre)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="assetsPagination">
              <span className="assetsPagination__info">
                Mostrando{' '}
                <strong>
                  {(currentPage - 1) * PAGE_SIZE + 1}-
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
          </>
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
