import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getAreas } from '../../services/catalogs.service';
import {
  getSolicitudesEnviadas,
  searchAssets,
  transferAsset,
  getPendientesRecepcion,
  confirmarRecepcion,
  rechazarRecepcion,
} from '../../services/assets.service';
import { HttpError } from '../../services/http.client';
import type { Area, AssetListItem, SolicitudEnviada, PendienteRecepcion } from '../../types/assets.types';
import '../../styles/modules.css';
import '../../styles/transferencias.css';

// ─────────────────────────────────────────────
// Modal de rechazo HU42
// ─────────────────────────────────────────────
interface ModalRechazoProps {
  pendiente: PendienteRecepcion;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  submitting: boolean;
}

function ModalRechazo({ pendiente, onConfirmar, onCancelar, submitting }: ModalRechazoProps) {
  const [motivo, setMotivo] = useState('');
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const motivoError = intentoEnvio && !motivo.trim()
    ? 'El motivo del rechazo es obligatorio'
    : '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIntentoEnvio(true);
    if (!motivo.trim()) return;
    onConfirmar(motivo.trim());
  }

  return (
    <div className="rechazo-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rechazo-modal-title">
      <div className="rechazo-modal">
        <div className="rechazo-modal__header">
          <h2 id="rechazo-modal-title">Rechazar recepción</h2>
          <button
            type="button"
            className="rechazo-modal__close"
            onClick={onCancelar}
            disabled={submitting}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="rechazo-modal__activo">
          <span className="rechazo-modal__activo-codigo">{pendiente.activo.codigo}</span>
          <strong className="rechazo-modal__activo-nombre">{pendiente.activo.nombre}</strong>
        </div>

        <div className="rechazo-modal__info">
          <p>
            Al rechazar, el activo <strong>volverá al área de origen</strong> y el motivo
            quedará visible en el historial del activo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rechazo-modal__form">
          <div className="rechazo-modal__field">
            <label htmlFor="rechazo-motivo">
              Motivo del rechazo <span className="rechazo-required">*</span>
            </label>
            <textarea
              id="rechazo-motivo"
              rows={4}
              maxLength={500}
              placeholder="Ej: El activo llegó con daños visibles. La pantalla presenta una fisura en la esquina inferior derecha."
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (intentoEnvio) setIntentoEnvio(false);
              }}
              disabled={submitting}
              className={motivoError ? 'rechazo-textarea--error' : ''}
            />
            <div className="rechazo-modal__field-footer">
              {motivoError
                ? <span className="rechazo-field-error">{motivoError}</span>
                : <span className="rechazo-char-count">{motivo.length}/500</span>
              }
            </div>
          </div>

          <div className="rechazo-modal__actions">
            <Button
              label="Cancelar"
              type="button"
              variant="secondary"
              onClick={onCancelar}
              disabled={submitting}
            />
            <Button
              label={submitting ? 'Rechazando...' : 'Confirmar rechazo'}
              type="submit"
              variant="danger"
              disabled={submitting}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────
export const TransferenciasPage: React.FC = () => {
  const { user } = useAuth();
  const notify = useNotification();
  const PAGE_SIZE = 6;

  // ── Estado: registrar transferencia ──
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

  // ── Estado: pendientes de recepción (HU42) ──
  const [pendientes, setPendientes] = useState<PendienteRecepcion[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [submittingPendienteId, setSubmittingPendienteId] = useState<string | null>(null);
  const [pendienteParaRechazar, setPendienteParaRechazar] = useState<PendienteRecepcion | null>(null);

  function mapSolicitudToLastTransferResult(
    solicitud: SolicitudEnviada | null | undefined,
  ) {
    if (!solicitud || !solicitud.areaOrigen || !solicitud.areaDestino) {
      return null;
    }

    return {
      activoCodigo: solicitud.activo.codigo,
      activoNombre: solicitud.activo.nombre,
      estadoRecepcion: solicitud.estado,
      areaOrigen: solicitud.areaOrigen,
      areaDestino: solicitud.areaDestino,
    };
  }

  async function reloadData() {
    const [assetsResponse, availableAreas, sentRequestsResponse] = await Promise.all([
      searchAssets({
        soloTransferibles: true,
        page: 1,
        pageSize: 100,
        sortBy: 'nombre',
        sortType: 'ASC',
      }),
      getAreas(),
      user?.id ? getSolicitudesEnviadas(user.id, user.area?.id) : Promise.resolve(null),
    ]);

    setAssets(assetsResponse.data ?? []);
    setAreas(availableAreas);

    const latestPendingRequest = sentRequestsResponse?.data?.[0] ?? null;
    setLastTransferResult(mapSolicitudToLastTransferResult(latestPendingRequest));
  }

  async function reloadPendientes() {
    if (!user?.area?.id) return;
    setLoadingPendientes(true);
    try {
      const response = await getPendientesRecepcion(user.area.id);
      setPendientes(response.data ?? []);
    } catch {
      // silencioso — el panel mostrará vacío
    } finally {
      setLoadingPendientes(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        await Promise.all([reloadData(), reloadPendientes()]);
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
  }, [notify, user?.id, user?.area?.id]);

  // ── Confirmar recepción ──
  async function handleConfirmar(asignacionId: string) {
    setSubmittingPendienteId(asignacionId);
    try {
      const response = await confirmarRecepcion(asignacionId);
      notify.success('Recepción confirmada', response.data.message);
      await reloadPendientes();
    } catch (error) {
      const msg = error instanceof HttpError ? error.message : 'No se pudo confirmar la recepción';
      notify.error('Error al confirmar', msg);
    } finally {
      setSubmittingPendienteId(null);
    }
  }

  // ── Rechazar recepción (HU42) ──
  async function handleRechazar(motivo: string) {
    if (!pendienteParaRechazar) return;
    setSubmittingPendienteId(pendienteParaRechazar.id);
    try {
      const response = await rechazarRecepcion(pendienteParaRechazar.id, motivo);
      notify.success('Recepción rechazada', response.data.message);
      setPendienteParaRechazar(null);
      await reloadPendientes();
    } catch (error) {
      const msg = error instanceof HttpError ? error.message : 'No se pudo rechazar la recepción';
      notify.error('Error al rechazar', msg);
    } finally {
      setSubmittingPendienteId(null);
    }
  }

  // ── Cálculos de tabla de transferencia ──
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === activoId) ?? null,
    [activoId, assets],
  );

  const originAreaId = selectedAsset?.area?.id ?? '';
  const originAreaName = selectedAsset?.area?.nombre ?? 'Sin área asignada';
  const destinationArea = areas.find((area) => area.id === areaDestinoId) ?? null;

  const filteredAssets = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) return assets;
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

  // ── Registrar transferencia ──
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

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="module-page">
      {/* Modal de rechazo HU42 */}
      {pendienteParaRechazar && (
        <ModalRechazo
          pendiente={pendienteParaRechazar}
          onConfirmar={handleRechazar}
          onCancelar={() => setPendienteParaRechazar(null)}
          submitting={submittingPendienteId === pendienteParaRechazar.id}
        />
      )}

      <div className="module-header transfer-page__header">
        <div>
          <h1>Transferencias</h1>
          <p className="transfer-page__subtitle">
            Seleccione el activo, revise su área actual y registre el traslado hacia el área de destino.
          </p>
        </div>
      </div>

      {/* ── Banner última transferencia ── */}
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

      {/* ── Sección HU42: Pendientes de recepción ── */}
      {user?.area?.id && (
        <section className="transfer-panel recepcion-panel">
          <div className="transfer-panel__header">
            <div>
              <h2>Pendientes de recepción</h2>
              <p>Activos transferidos a su área que requieren confirmación o rechazo.</p>
            </div>
            <span className="transfer-panel__counter">
              {loadingPendientes ? '...' : `${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}`}
            </span>
          </div>

          {loadingPendientes ? (
            <div className="recepcion-empty">Cargando recepciones pendientes...</div>
          ) : pendientes.length === 0 ? (
            <div className="recepcion-empty">No hay recepciones pendientes para su área.</div>
          ) : (
            <div className="recepcion-list">
              {pendientes.map((p) => {
                const isActivo = submittingPendienteId === p.id;
                return (
                  <div key={p.id} className="recepcion-card">
                    <div className="recepcion-card__info">
                      <div className="recepcion-card__top">
                        <span className="recepcion-card__codigo">{p.activo.codigo}</span>
                        <span className="recepcion-card__badge">Pendiente</span>
                      </div>
                      <strong className="recepcion-card__nombre">{p.activo.nombre}</strong>
                      <div className="recepcion-card__meta">
                        {p.areaOrigen && (
                          <span>Desde: <strong>{p.areaOrigen.nombre}</strong></span>
                        )}
                        <span>
                          Fecha:{' '}
                          <strong>
                            {new Date(p.fechaEnvio).toLocaleDateString('es-BO', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </strong>
                        </span>
                        {p.observaciones && (
                          <span>Obs: <em>{p.observaciones}</em></span>
                        )}
                      </div>
                    </div>

                    <div className="recepcion-card__actions">
                      {/* PA1: botón confirmar */}
                      <Button
                        label={isActivo && !pendienteParaRechazar ? 'Confirmando...' : 'Confirmar'}
                        variant="success"
                        size="sm"
                        onClick={() => handleConfirmar(p.id)}
                        disabled={isActivo || Boolean(submittingPendienteId)}
                      />
                      {/* PA1: botón rechazar — abre el modal con campo de motivo (PA2) */}
                      <Button
                        label="Rechazar"
                        variant="danger"
                        size="sm"
                        onClick={() => setPendienteParaRechazar(p)}
                        disabled={isActivo || Boolean(submittingPendienteId)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Formulario: Registrar transferencia ── */}
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
