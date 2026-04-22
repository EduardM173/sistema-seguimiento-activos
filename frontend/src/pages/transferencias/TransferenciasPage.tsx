import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common';
import { useNotification } from '../../context/NotificationContext';
import { getAreas } from '../../services/catalogs.service';
import { searchAssets, transferAsset } from '../../services/assets.service';
import { HttpError } from '../../services/http.client';
import type { Area, AssetListItem } from '../../types/assets.types';
import '../../styles/modules.css';
import '../../styles/transferencias.css';

export const TransferenciasPage: React.FC = () => {
  const notify = useNotification();
  const PAGE_SIZE = 6;
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activoId, setActivoId] = useState('');
  const [areaDestinoId, setAreaDestinoId] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastTransferResult, setLastTransferResult] = useState<{
    activoCodigo: string;
    activoNombre: string;
    estadoRecepcion: string;
    areaOrigen: { id: string; nombre: string };
    areaDestino: { id: string; nombre: string };
  } | null>(null);

  async function reloadData() {
    const [assetsResponse, availableAreas] = await Promise.all([
      searchAssets({
        soloTransferibles: true,
        page: 1,
        pageSize: 100,
        sortBy: 'nombre',
        sortType: 'ASC',
      }),
      getAreas(),
    ]);

    setAssets(assetsResponse.data ?? []);
    setAreas(availableAreas);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        await reloadData();
      } catch (error) {
        const errorMessage =
          error instanceof HttpError
            ? error.message
            : 'No se pudo cargar la información inicial de transferencias';

        notify.error('No se pudo cargar Transferencias', errorMessage);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [notify]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === activoId) ?? null,
    [activoId, assets],
  );

  const originAreaId = selectedAsset?.area?.id ?? '';
  const originAreaName = selectedAsset?.area?.nombre ?? 'Sin área asignada';
  const destinationArea = areas.find((area) => area.id === areaDestinoId) ?? null;

  const filteredAssets = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();

    if (!normalized) {
      return assets;
    }

    return assets.filter((asset) =>
      `${asset.codigo} ${asset.nombre}`.toLowerCase().includes(normalized),
    );
  }, [assets, searchText]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));

  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAssets.slice(start, start + PAGE_SIZE);
  }, [filteredAssets, currentPage]);

  const destinationOptions = useMemo(
    () => areas.filter((area) => area.id !== originAreaId),
    [areas, originAreaId],
  );

  const activoError =
    submitAttempted && !activoId ? 'Debe seleccionar un activo.' : '';
  const areaDestinoError =
    submitAttempted && !areaDestinoId ? 'Debe seleccionar un área de destino.' : '';
  const sameAreaError =
    activoId && areaDestinoId && originAreaId && areaDestinoId === originAreaId
      ? 'El área de destino no puede ser la misma que el área de origen.'
      : '';

  const hasErrors = Boolean(activoError || areaDestinoError || sameAreaError);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    if (hasErrors) {
      notify.error(
        'Formulario incompleto',
        sameAreaError || activoError || areaDestinoError,
      );
      return;
    }

    if (!selectedAsset) {
      notify.error(
        'Activo inválido',
        'Debe seleccionar un activo válido para registrar la transferencia.',
      );
      return;
    }

    try {
      setSubmitting(true);
      const response = await transferAsset(selectedAsset.id, {
        areaDestinoId,
      });

      setLastTransferResult({
        activoCodigo: selectedAsset.codigo,
        activoNombre: selectedAsset.nombre,
        estadoRecepcion: response.data.transferencia.estado,
        areaOrigen: response.data.transferencia.areaOrigen,
        areaDestino: response.data.transferencia.areaDestino,
      });

      setActivoId('');
      setAreaDestinoId('');
      setSubmitAttempted(false);
      notify.success('Transferencia registrada', response.data.message);
      await reloadData();
    } catch (error) {
      const rawMessage =
        error instanceof HttpError
          ? error.message
          : 'No se pudo registrar la transferencia del activo';

      const friendlyMessage = rawMessage.includes(
        'Solo se puede transferir un activo cuando está en estado Operativo',
      )
        ? 'El activo debe estar en estado Operativo para poder transferirse.'
        : rawMessage.includes(
              'El activo debe tener un área de origen registrada antes de transferirse',
            )
          ? 'El activo seleccionado no tiene un área de origen registrada.'
          : rawMessage.includes(
                'El activo tiene una recepción pendiente y no puede transferirse nuevamente',
              )
            ? 'El activo ya tiene una recepción pendiente y no puede transferirse otra vez todavía.'
            : rawMessage.includes('El área de destino debe ser distinta del área de origen')
              ? 'Debe seleccionar un área de destino diferente al área de origen.'
              : rawMessage;

      notify.error('No se pudo registrar la transferencia', friendlyMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="module-page">
      <div className="module-header transfer-page__header">
        <div>
          <h1>Transferencias</h1>
          <p className="transfer-page__subtitle">
            Seleccione el activo, revise su área actual y registre el traslado hacia el área de destino.
          </p>
        </div>
      </div>

      {lastTransferResult ? (
        <section className="transfer-pending-banner" aria-live="polite">
          <div className="transfer-pending-banner__top">
            <div>
              <p className="transfer-pending-banner__eyebrow">Recepción generada</p>
              <h2>La transferencia dejó una recepción pendiente para el área destino</h2>
            </div>
            <span className="transfer-pending-badge">
              Recepción {lastTransferResult.estadoRecepcion}
            </span>
          </div>

          <div className="transfer-pending-banner__grid">
            <div className="transfer-pending-banner__item">
              <span className="transfer-pending-banner__label">Activo</span>
              <strong>
                {lastTransferResult.activoCodigo} - {lastTransferResult.activoNombre}
              </strong>
            </div>
            <div className="transfer-pending-banner__item">
              <span className="transfer-pending-banner__label">Área de origen</span>
              <strong>{lastTransferResult.areaOrigen.nombre}</strong>
            </div>
            <div className="transfer-pending-banner__item">
              <span className="transfer-pending-banner__label">Área de destino</span>
              <strong>{lastTransferResult.areaDestino.nombre}</strong>
            </div>
            <div className="transfer-pending-banner__item">
              <span className="transfer-pending-banner__label">Estado de recepción</span>
              <strong className="transfer-pending-banner__state">
                {lastTransferResult.estadoRecepcion}
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="transfer-workspace">
        <div className="transfer-workspace__top">
          <section className="transfer-panel transfer-panel--assets">
            <div className="transfer-panel__header">
              <div>
                <h2>1. Seleccionar activo</h2>
                <p>Trabaje con activos operativos y elija cuál será transferido.</p>
              </div>
              <span className="transfer-panel__counter">
                {loading ? '...' : `${filteredAssets.length} activos`}
              </span>
            </div>

            <div className="transfer-search">
              <input
                id="transfer-activo-search"
                type="text"
                placeholder="Buscar por código o nombre..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                disabled={loading || submitting}
              />
            </div>

            {activoError ? (
              <p className="transfer-field-error">{activoError}</p>
            ) : null}

            <div className="transfer-assets-grid">
              {loading ? (
                <div className="transfer-empty-state">
                  Cargando activos operativos disponibles...
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="transfer-empty-state">
                  No se encontraron activos con ese criterio de búsqueda.
                </div>
              ) : (
                paginatedAssets.map((asset) => {
                  const isSelected = asset.id === activoId;
                  const hasOriginArea = Boolean(asset.area?.id);
                  const hasResponsible = Boolean(asset.responsable?.id);
                  const isSelectable = hasOriginArea && hasResponsible;

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={`transfer-asset-card ${isSelected ? 'transfer-asset-card--selected' : ''} ${!isSelectable ? 'transfer-asset-card--disabled' : ''}`}
                      onClick={() => {
                        if (!isSelectable) return;
                        setActivoId(asset.id);
                        setAreaDestinoId('');
                        setSubmitAttempted(false);
                      }}
                      disabled={submitting || !isSelectable}
                    >
                      <div className="transfer-asset-card__top">
                        <span className="transfer-asset-card__code">{asset.codigo}</span>
                        <span
                          className={`transfer-asset-card__status ${isSelected ? 'transfer-asset-card__status--selected' : ''}`}
                        >
                          {isSelected
                            ? 'Seleccionado'
                            : isSelectable
                              ? 'Disponible'
                              : !hasOriginArea
                                ? 'Sin área'
                                : 'Sin responsable'}
                        </span>
                      </div>
                      <strong className="transfer-asset-card__name">{asset.nombre}</strong>
                      <div className="transfer-asset-card__meta">
                        <span>{asset.categoria?.nombre ?? 'Sin categoría'}</span>
                        <span>{asset.area?.nombre ?? 'Área no registrada'}</span>
                        <span>{asset.responsable?.nombreCompleto ?? 'Responsable no asignado'}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {!loading && filteredAssets.length > 0 ? (
              <div className="transfer-pagination">
                <span className="transfer-pagination__info">
                  Mostrando{' '}
                  <strong>
                    {(currentPage - 1) * PAGE_SIZE + 1}-
                    {Math.min(currentPage * PAGE_SIZE, filteredAssets.length)}
                  </strong>{' '}
                  de <strong>{filteredAssets.length}</strong> activos
                </span>
                <div className="transfer-pagination__controls">
                  <button
                    type="button"
                    className="transfer-page-btn"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    &lt; Anterior
                  </button>
                  <span className="transfer-page-indicator">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="transfer-page-btn"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente &gt;
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <div className="transfer-workspace__side">
            <section className="transfer-panel transfer-panel--movement">
              <div className="transfer-panel__header">
                <div>
                  <h2>2. Datos del movimiento</h2>
                  <p>Revise el origen y defina el área de destino.</p>
                </div>
              </div>

              <div className="transfer-details-grid">
                <div className="transfer-detail-card">
                  <span className="transfer-detail-card__label">Activo elegido</span>
                  <strong className="transfer-detail-card__value">
                    {selectedAsset ? `${selectedAsset.codigo} - ${selectedAsset.nombre}` : 'Seleccione un activo'}
                  </strong>
                </div>

                <div className="transfer-detail-card">
                  <span className="transfer-detail-card__label">Área de origen</span>
                  <strong className="transfer-detail-card__value">{originAreaName}</strong>
                </div>
              </div>

              <div className="form-group transfer-field-group">
                <label htmlFor="transfer-area-destino">
                  Área de destino <span className="transfer-required">*</span>
                </label>
                <select
                  id="transfer-area-destino"
                  value={areaDestinoId}
                  onChange={(event) => {
                    setAreaDestinoId(event.target.value);
                    setSubmitAttempted(false);
                  }}
                  disabled={loading || submitting || !activoId}
                  className={areaDestinoError || sameAreaError ? 'transfer-input--error' : ''}
                >
                  <option value="">
                    {!activoId ? 'Primero seleccione un activo' : 'Seleccione un área de destino'}
                  </option>
                  {destinationOptions.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.nombre}
                    </option>
                  ))}
                </select>
                {sameAreaError ? (
                  <span className="transfer-field-error">{sameAreaError}</span>
                ) : areaDestinoError ? (
                  <span className="transfer-field-error">{areaDestinoError}</span>
                ) : null}
              </div>

              <div className="transfer-note">
                La transferencia registrará el movimiento del activo y dejará una recepción pendiente para el área destino.
              </div>
            </section>

            <section className="transfer-panel transfer-panel--summary">
              <div className="transfer-panel__header">
                <div>
                  <h2>3. Resumen</h2>
                  <p>Confirme la operación antes de registrarla.</p>
                </div>
              </div>

              <div className="transfer-summary">
                <div className="transfer-summary__item">
                  <span className="transfer-summary__label">Activo</span>
                  <strong className="transfer-summary__value">
                    {selectedAsset ? selectedAsset.nombre : 'Pendiente de selección'}
                  </strong>
                  <span className="transfer-summary__meta">
                    {selectedAsset ? selectedAsset.codigo : 'Seleccione una tarjeta de activo'}
                  </span>
                </div>

                <div className="transfer-summary__item">
                  <span className="transfer-summary__label">Área de origen</span>
                  <strong className="transfer-summary__value">{originAreaName}</strong>
                </div>

                <div className="transfer-summary__item">
                  <span className="transfer-summary__label">Área de destino</span>
                  <strong className="transfer-summary__value">
                    {destinationArea?.nombre ?? 'Pendiente de selección'}
                  </strong>
                </div>

                {lastTransferResult ? (
                  <div className="transfer-summary__item transfer-summary__item--highlight">
                    <span className="transfer-summary__label">Último registro</span>
                    <strong className="transfer-summary__value">
                      Recepción {lastTransferResult.estadoRecepcion}
                    </strong>
                    <span className="transfer-summary__meta">
                      {lastTransferResult.areaDestino.nombre} debe confirmar la recepción del activo transferido.
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="transfer-summary__footer">
                <Button
                  label={submitting ? 'Registrando...' : 'Registrar transferencia'}
                  type="submit"
                  variant="primary"
                  disabled={loading || submitting || hasErrors}
                  className="transfer-submit-btn"
                />
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TransferenciasPage;
