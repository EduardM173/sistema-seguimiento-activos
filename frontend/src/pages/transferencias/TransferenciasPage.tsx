import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/common';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { getAreas, } from '../../services/catalogs.service';
import {
  searchAssets,
  transferAsset,
  getPendientesRecepcion,
  confirmarRecepcion,
  rechazarRecepcion,
  getSolicitudesEnviadas,
} from '../../services/assets.service';
import { HttpError } from '../../services/http.client';
import type {
  Area,
  AssetListItem,
  PendienteRecepcion,
  SolicitudEnviada,
} from '../../types/assets.types';
import '../../styles/modules.css';
import '../../styles/transferencias.css';

export const TransferenciasPage: React.FC = () => {
  const notify = useNotification();
  const { user } = useAuth();
  const PAGE_SIZE = 6;
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activoId, setActivoId] = useState('');
  const [areaDestinoId, setAreaDestinoId] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pendientes, setPendientes] = useState<PendienteRecepcion[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudEnviada[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [accionandoId, setAccionandoId] = useState<string | null>(null);
  const [rechazoModal, setRechazoModal] = useState<{
    open: boolean;
    asignacionId: string | null;
    activoLabel: string;
  }>({
    open: false,
    asignacionId: null,
    activoLabel: '',
  });
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

  async function cargarPendientes(areaId: string) {
    try {
      setLoadingPendientes(true);
      const res = await getPendientesRecepcion(areaId);
      setPendientes(res.data ?? []);
    } catch (err) {
      console.error('[HU41] Error cargando pendientes de recepción:', err);
    } finally {
      setLoadingPendientes(false);
    }
  }

  async function cargarSolicitudes(areaId: string, userId: string) {
    try {
      setLoadingSolicitudes(true);
      const res = await getSolicitudesEnviadas(userId, areaId);
      setSolicitudes(res.data ?? []);
    } catch (err) {
      console.error('[HU41] Error cargando solicitudes enviadas:', err);
    } finally {
      setLoadingSolicitudes(false);
    }
  }

  async function handleConfirmar(asignacionId: string) {
    try {
      setAccionandoId(asignacionId);
      await confirmarRecepcion(asignacionId);
      notify.success('Recepción confirmada', 'El activo ha sido recibido correctamente.');
      if (user?.area?.id && user?.id) {
        await Promise.all([
          cargarPendientes(user.area.id),
          cargarSolicitudes(user.area.id, user.id),
        ]);
      }
    } catch (err) {
      notify.error('Error', err instanceof HttpError ? err.message : 'No se pudo confirmar la recepción');
    } finally {
      setAccionandoId(null);
    }
  }

  function handleRechazar(asignacionId: string, activoLabel: string) {
    setRechazoModal({
      open: true,
      asignacionId,
      activoLabel,
    });
  }

  function cerrarModalRechazo() {
    setRechazoModal({
      open: false,
      asignacionId: null,
      activoLabel: '',
    });
  }

  async function confirmarRechazo() {
    if (!rechazoModal.asignacionId) return;

    try {
      setAccionandoId(rechazoModal.asignacionId);
      await rechazarRecepcion(rechazoModal.asignacionId);
      notify.success('Recepción rechazada', 'La transferencia fue rechazada.');
      if (user?.area?.id && user?.id) {
        await Promise.all([
          cargarPendientes(user.area.id),
          cargarSolicitudes(user.area.id, user.id),
        ]);
      }
      cerrarModalRechazo();
    } catch (err) {
      notify.error('Error', err instanceof HttpError ? err.message : 'No se pudo rechazar la recepción');
    } finally {
      setAccionandoId(null);
    }
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
  }, []);

  useEffect(() => {
    if (user?.area?.id && user?.id) {
      void Promise.all([
        cargarPendientes(user.area.id),
        cargarSolicitudes(user.area.id, user.id),
      ]);
    }
  }, [user?.area?.id, user?.id]);

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
  }, [filteredAssets, currentPage, PAGE_SIZE]);

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

      setActivoId('');
      setAreaDestinoId('');
      setSubmitAttempted(false);
      notify.success('Transferencia registrada', response.data.message);
      await reloadData();
      if (user?.area?.id && user?.id) {
        await Promise.all([
          cargarPendientes(user.area.id),
          cargarSolicitudes(user.area.id, user.id),
        ]);
      }
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

      {/* HU41 – Panel de pendientes de recepción del área del usuario */}
      {user?.area && (
        <section style={{
          background: '#fffbeb',
          border: '1px solid #f59e0b',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#78350f' }}>
                ⏳ Pendientes de recepción — {user.area.nombre}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#92400e' }}>
                Activos transferidos a tu área que aún no han sido confirmados.
              </p>
            </div>
            {!loadingPendientes && (
              <span style={{
                background: pendientes.length > 0 ? '#fef3c7' : '#f0fdf4',
                color: pendientes.length > 0 ? '#78350f' : '#14532d',
                border: `1px solid ${pendientes.length > 0 ? '#f59e0b' : '#86efac'}`,
                borderRadius: '999px',
                padding: '3px 12px',
                fontWeight: 700,
                fontSize: '0.82rem',
              }}>
                {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loadingPendientes ? (
            <p style={{ color: '#92400e', fontSize: '0.85rem' }}>Cargando...</p>
          ) : pendientes.length === 0 ? (
            <p style={{ color: '#57534e', fontSize: '0.85rem', margin: 0 }}>
              No hay transferencias pendientes de recepción para tu área.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendientes.map((p) => (
                <div key={p.id} style={{
                  background: '#fff',
                  border: '1px solid #fcd34d',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px, 2fr) repeat(3, minmax(120px, 1fr)) auto',
                  columnGap: '10px',
                  rowGap: '6px',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Activo</span>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.86rem', color: '#1c1917', lineHeight: 1.25 }}>
                      {p.activo.codigo} — {p.activo.nombre}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Área de origen</span>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#292524', lineHeight: 1.2 }}>{p.areaOrigen?.nombre ?? '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Registrado por</span>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#292524', lineHeight: 1.2 }}>{p.registradoPor?.nombreCompleto ?? '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Fecha de envío</span>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: '#292524', lineHeight: 1.2 }}>
                      {new Date(p.fechaEnvio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      disabled={accionandoId === p.id}
                      onClick={() => void handleConfirmar(p.id)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '7px',
                        border: 'none',
                        background: accionandoId === p.id ? '#d1fae5' : '#10b981',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: accionandoId === p.id ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {accionandoId === p.id ? '...' : '✓ Confirmar'}
                    </button>
                    <button
                      type="button"
                      disabled={accionandoId === p.id}
                      onClick={() => handleRechazar(p.id, `${p.activo.codigo} — ${p.activo.nombre}`)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '7px',
                        border: '1px solid #fca5a5',
                        background: '#fff',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: accionandoId === p.id ? 'wait' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {user?.area && (
        <section style={{
          background: '#f0f9ff',
          border: '1px solid #7dd3fc',
          borderRadius: '14px',
          padding: '16px 18px',
          marginBottom: '18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0c4a6e' }}>
                📤 Solicitudes enviadas — {user.area.nombre}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#075985' }}>
                Transferencias que registraste y siguen pendientes de aprobación en el área destino.
              </p>
            </div>
            {!loadingSolicitudes && (
              <span style={{
                background: solicitudes.length > 0 ? '#e0f2fe' : '#f0fdf4',
                color: solicitudes.length > 0 ? '#0c4a6e' : '#14532d',
                border: `1px solid ${solicitudes.length > 0 ? '#7dd3fc' : '#86efac'}`,
                borderRadius: '999px',
                padding: '3px 12px',
                fontWeight: 700,
                fontSize: '0.82rem',
              }}>
                {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {loadingSolicitudes ? (
            <p style={{ color: '#075985', fontSize: '0.85rem' }}>Cargando...</p>
          ) : solicitudes.length === 0 ? (
            <p style={{ color: '#334155', fontSize: '0.85rem', margin: 0 }}>
              No tienes solicitudes de transferencia pendientes.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {solicitudes.map((s) => (
                <div key={s.id} style={{
                  background: '#fff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '8px',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Activo</span>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      {s.activo.codigo} — {s.activo.nombre}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Área destino</span>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a' }}>{s.areaDestino?.nombre ?? '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Estado</span>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#0369a1', fontWeight: 700 }}>{s.estado}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fecha de envío</span>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a' }}>
                      {new Date(s.fechaEnvio).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
                        <span className={`transfer-asset-card__status ${isSelected ? 'transfer-asset-card__status--selected' : ''}`}>
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

      {rechazoModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 999,
          }}
          onClick={cerrarModalRechazo}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #fecaca',
              boxShadow: '0 18px 48px rgba(15, 23, 42, 0.22)',
              padding: '18px 18px 14px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1rem' }}>Confirmar rechazo</h3>
            <p style={{ margin: '8px 0 0', color: '#374151', fontSize: '0.9rem', lineHeight: 1.4 }}>
              ¿Está seguro de rechazar la recepción del activo:
            </p>
            <p style={{ margin: '6px 0 0', color: '#111827', fontWeight: 700, fontSize: '0.9rem' }}>
              {rechazoModal.activoLabel}
            </p>
            <p style={{ margin: '8px 0 0', color: '#b91c1c', fontSize: '0.82rem' }}>
              Esta acción marcará la solicitud como rechazada.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={cerrarModalRechazo}
                disabled={Boolean(accionandoId)}
                style={{
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontWeight: 600,
                  cursor: Boolean(accionandoId) ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarRechazo()}
                disabled={Boolean(accionandoId)}
                style={{
                  border: '1px solid #fca5a5',
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '7px 12px',
                  fontWeight: 700,
                  cursor: Boolean(accionandoId) ? 'wait' : 'pointer',
                }}
              >
                {Boolean(accionandoId) ? 'Procesando...' : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferenciasPage;
