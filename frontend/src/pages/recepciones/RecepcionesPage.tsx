import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  getPendientesRecepcion,
  confirmarRecepcion,
  rechazarRecepcion,
} from '../../services/assets.service';
import { HttpError } from '../../services/http.client';
import type { PendienteRecepcion } from '../../types/assets.types';
import '../../styles/modules.css';
import '../../styles/recepciones.css';

// ─────────────────────────────────────────────────────────────────
// Modal de rechazo con motivo obligatorio (HU42 PA2)
// ─────────────────────────────────────────────────────────────────
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

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onCancelar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitting, onCancelar]);

  return (
    <div
      className="recep-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recep-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onCancelar(); }}
    >
      <div className="recep-modal">
        <div className="recep-modal__header">
          <h2 id="recep-modal-title">Rechazar recepción</h2>
          <button
            type="button"
            className="recep-modal__close"
            onClick={onCancelar}
            disabled={submitting}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Datos del activo */}
        <div className="recep-modal__activo">
          <span className="recep-modal__activo-codigo">{pendiente.activo.codigo}</span>
          <strong className="recep-modal__activo-nombre">{pendiente.activo.nombre}</strong>
          {(pendiente.activo.marca || pendiente.activo.modelo) && (
            <span className="recep-modal__activo-meta">
              {[pendiente.activo.marca, pendiente.activo.modelo].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Advertencia */}
        <div className="recep-modal__warning">
          <span className="recep-modal__warning-icon">⚠</span>
          <p>
            Al rechazar, el activo <strong>volverá al área de origen</strong>.
            El motivo quedará registrado en el historial del activo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="recep-modal__form">
          <div className="recep-modal__field">
            <label htmlFor="recep-motivo">
              Motivo del rechazo <span className="recep-required">*</span>
            </label>
            <textarea
              id="recep-motivo"
              rows={4}
              maxLength={500}
              placeholder="Describa el motivo del rechazo. Ej: El activo llegó con daños visibles en la pantalla."
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (intentoEnvio) setIntentoEnvio(false);
              }}
              disabled={submitting}
              className={motivoError ? 'recep-textarea--error' : ''}
              autoFocus
            />
            <div className="recep-modal__field-footer">
              {motivoError
                ? <span className="recep-field-error">{motivoError}</span>
                : <span className="recep-char-count">{motivo.length} / 500</span>
              }
            </div>
          </div>

          <div className="recep-modal__actions">
            <button
              type="button"
              className="recep-btn recep-btn--secondary"
              onClick={onCancelar}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="recep-btn recep-btn--danger"
              disabled={submitting}
            >
              {submitting ? (
                <><span className="recep-spinner" />Rechazando...</>
              ) : (
                'Confirmar rechazo'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Toast de confirmación exitosa (PA3 HU21: muestra quién y cuándo)
// ─────────────────────────────────────────────────────────────────
interface ConfirmacionExitosaProps {
  activoCodigo: string;
  activoNombre: string;
  recibidoPor: string;
  recibidoEn: string;
  onClose: () => void;
}

function BannerConfirmacion({ activoCodigo, activoNombre, recibidoPor, recibidoEn, onClose }: ConfirmacionExitosaProps) {
  const fecha = new Date(recibidoEn).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="recep-confirm-banner" role="status" aria-live="polite">
      <div className="recep-confirm-banner__icon">✓</div>
      <div className="recep-confirm-banner__content">
        <strong>{activoCodigo} — {activoNombre}</strong>
        <span>Confirmado por <strong>{recibidoPor}</strong> el {fecha}</span>
      </div>
      <button
        type="button"
        className="recep-confirm-banner__close"
        onClick={onClose}
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tarjeta de pendiente
// ─────────────────────────────────────────────────────────────────
interface TarjetaPendienteProps {
  pendiente: PendienteRecepcion;
  onConfirmar: () => void;
  onRechazar: () => void;
  submitting: boolean;
}

function TarjetaPendiente({ pendiente, onConfirmar, onRechazar, submitting }: TarjetaPendienteProps) {
  const fecha = new Date(pendiente.fechaEnvio).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="recep-card">
      <div className="recep-card__body">
        <div className="recep-card__top">
          <span className="recep-card__codigo">{pendiente.activo.codigo}</span>
          <span className="recep-card__badge recep-card__badge--pendiente">Pendiente</span>
        </div>

        <strong className="recep-card__nombre">{pendiente.activo.nombre}</strong>

        {(pendiente.activo.marca || pendiente.activo.modelo) && (
          <span className="recep-card__subtitulo">
            {[pendiente.activo.marca, pendiente.activo.modelo].filter(Boolean).join(' · ')}
          </span>
        )}

        {pendiente.activo.categoria && (
          <span className="recep-card__categoria">{pendiente.activo.categoria.nombre}</span>
        )}

        <div className="recep-card__meta">
          {pendiente.areaOrigen && (
            <div className="recep-card__meta-item">
              <span className="recep-card__meta-label">Desde</span>
              <span className="recep-card__meta-value">{pendiente.areaOrigen.nombre}</span>
            </div>
          )}
          <div className="recep-card__meta-item">
            <span className="recep-card__meta-label">Fecha envío</span>
            <span className="recep-card__meta-value">{fecha}</span>
          </div>
          {pendiente.registradoPor && (
            <div className="recep-card__meta-item">
              <span className="recep-card__meta-label">Registrado por</span>
              <span className="recep-card__meta-value">{pendiente.registradoPor.nombreCompleto}</span>
            </div>
          )}
          {pendiente.observaciones && (
            <div className="recep-card__meta-item recep-card__meta-item--full">
              <span className="recep-card__meta-label">Observaciones</span>
              <span className="recep-card__meta-value recep-card__meta-value--italic">
                {pendiente.observaciones}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PA1 HU21: botones de acción — Solo visibles para el Responsable del área destino */}
      <div className="recep-card__actions">
        <button
          type="button"
          className="recep-btn recep-btn--success recep-btn--full"
          onClick={onConfirmar}
          disabled={submitting}
        >
          {submitting ? <span className="recep-spinner" /> : null}
          Confirmar
        </button>
        <button
          type="button"
          className="recep-btn recep-btn--danger-outline recep-btn--full"
          onClick={onRechazar}
          disabled={submitting}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────
export const RecepcionesPage: React.FC = () => {
  const { user } = useAuth();
  const notify = useNotification();

  const [pendientes, setPendientes] = useState<PendienteRecepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [modalRechazo, setModalRechazo] = useState<PendienteRecepcion | null>(null);
  const [ultimaConfirmacion, setUltimaConfirmacion] = useState<{
    activoCodigo: string;
    activoNombre: string;
    recibidoPor: string;
    recibidoEn: string;
  } | null>(null);

  const cargarPendientes = useCallback(async () => {
    if (!user?.area?.id) return;
    try {
      const response = await getPendientesRecepcion(user.area.id);
      setPendientes(response.data ?? []);
    } catch {
      // silencioso — el componente mostrará vacío
    }
  }, [user?.area?.id]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await cargarPendientes();
      } catch (error) {
        const msg = error instanceof HttpError
          ? error.message
          : 'No se pudo cargar las recepciones pendientes';
        notify.error('Error al cargar', msg);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [cargarPendientes, notify]);

  // PA1/PA2/PA3 HU21 — Confirmar recepción
  async function handleConfirmar(pendiente: PendienteRecepcion) {
    setSubmittingId(pendiente.id);
    try {
      const response = await confirmarRecepcion(pendiente.id);
      const { recibidoPor, recibidoEn } = response.data;

      // PA3: mostrar quién y cuándo confirmó
      setUltimaConfirmacion({
        activoCodigo: pendiente.activo.codigo,
        activoNombre: pendiente.activo.nombre,
        recibidoPor: recibidoPor.nombreCompleto,
        recibidoEn,
      });

      notify.success('Recepción confirmada', response.data.message);
      await cargarPendientes();
    } catch (error) {
      const msg = error instanceof HttpError
        ? error.message
        : 'No se pudo confirmar la recepción';
      notify.error('Error al confirmar', msg);
    } finally {
      setSubmittingId(null);
    }
  }

  // PA1/PA2/PA3/PA4 HU42 — Rechazar con motivo
  async function handleRechazar(motivo: string) {
    if (!modalRechazo) return;
    setSubmittingId(modalRechazo.id);
    try {
      const response = await rechazarRecepcion(modalRechazo.id, motivo);
      notify.success('Recepción rechazada', response.data.message);
      setModalRechazo(null);
      await cargarPendientes();
    } catch (error) {
      const msg = error instanceof HttpError
        ? error.message
        : 'No se pudo rechazar la recepción';
      notify.error('Error al rechazar', msg);
    } finally {
      setSubmittingId(null);
    }
  }

  const sinArea = !user?.area?.id;

  return (
    <div className="module-page">
      {/* Modal de rechazo (HU42) */}
      {modalRechazo && (
        <ModalRechazo
          pendiente={modalRechazo}
          onConfirmar={handleRechazar}
          onCancelar={() => setModalRechazo(null)}
          submitting={submittingId === modalRechazo.id}
        />
      )}

      {/* Header */}
      <div className="module-header">
        <div>
          <h1>Recepciones de transferencias</h1>
          <p>Revise las transferencias enviadas a su área y confirme o rechace la recepción.</p>
        </div>
        {!loading && !sinArea && (
          <span className="recep-counter">
            {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* PA3 HU21: Banner de última confirmación exitosa */}
      {ultimaConfirmacion && (
        <BannerConfirmacion
          {...ultimaConfirmacion}
          onClose={() => setUltimaConfirmacion(null)}
        />
      )}

      {/* Sin área asignada */}
      {sinArea && (
        <div className="recep-empty-state recep-empty-state--warning">
          <span className="recep-empty-state__icon">⚠</span>
          <p>Su usuario no tiene un área asignada. Contacte al administrador para poder gestionar recepciones.</p>
        </div>
      )}

      {/* Cargando */}
      {!sinArea && loading && (
        <div className="recep-loading">
          <span className="recep-spinner recep-spinner--lg" />
          <span>Cargando recepciones pendientes...</span>
        </div>
      )}

      {/* Sin pendientes */}
      {!sinArea && !loading && pendientes.length === 0 && (
        <div className="recep-empty-state">
          <span className="recep-empty-state__icon">✓</span>
          <strong>Sin recepciones pendientes</strong>
          <p>No hay activos transferidos a su área que requieran confirmación.</p>
        </div>
      )}

      {/* Lista de pendientes — PA1 HU21 */}
      {!sinArea && !loading && pendientes.length > 0 && (
        <section className="recep-section">
          <div className="recep-section__header">
            <h2>Pendientes de recepción</h2>
            <p>Activos transferidos a su área que requieren confirmación o rechazo.</p>
          </div>

          <div className="recep-grid">
            {pendientes.map((p) => (
              <TarjetaPendiente
                key={p.id}
                pendiente={p}
                onConfirmar={() => handleConfirmar(p)}
                onRechazar={() => setModalRechazo(p)}
                submitting={submittingId === p.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RecepcionesPage;
