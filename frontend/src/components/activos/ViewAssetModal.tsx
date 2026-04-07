import { useState, useEffect } from 'react';

import { getAssetById } from '../../services/assets.service';
import { useNotification } from '../../context/NotificationContext';
import { HttpError } from '../../services/http.client';
import type { AssetDetail, EstadoActivo } from '../../types/assets.types';

import OverlayModal from '../common/OverlayModal';

const ESTADO_LABEL: Record<EstadoActivo, string> = {
  OPERATIVO: 'Operativo',
  MANTENIMIENTO: 'Mantenimiento',
  FUERA_DE_SERVICIO: 'Fuera de Servicio',
  DADO_DE_BAJA: 'Dado de baja',
};

type Props = {
  assetId: string;
  open: boolean;
  onClose: () => void;
};

export default function ViewAssetModal({ assetId, open, onClose }: Props) {
  const notify = useNotification();
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<AssetDetail | null>(null);

  useEffect(() => {
    if (!open || !assetId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await getAssetById(assetId);
        if (!cancelled) setAsset(res.data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof HttpError ? err.message : 'No se pudo cargar el activo';
          notify.error('Error', message);
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetId]);

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#6b7280',
    letterSpacing: '0.5px',
  };
  const valueStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#1f2937',
    padding: '8px 12px',
    background: '#f9fafb',
    borderRadius: '6px',
    border: '1px solid #e5e7eb',
    minHeight: '38px',
    display: 'flex',
    alignItems: 'center',
  };
  const emptyValue = '—';

  function ubicacionLabel() {
    if (!asset?.ubicacion) return emptyValue;
    const parts = [asset.ubicacion.nombre];
    // ubicacion only has id + nombre from AssetDetail
    return parts.filter(Boolean).join(' — ');
  }

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      title="Detalle del Activo"
      subtitle={loading ? 'Cargando...' : `${asset?.codigo ?? ''} · ${asset?.nombre ?? ''}`}
      width="680px"
    >
      {loading || !asset ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          Cargando información del activo...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Código + Nombre */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <span style={labelStyle}>Código</span>
              <div style={valueStyle}>{asset.codigo || emptyValue}</div>
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Nombre</span>
              <div style={valueStyle}>{asset.nombre || emptyValue}</div>
            </div>
          </div>

          {/* Marca + Modelo + Serie */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <span style={labelStyle}>Marca</span>
              <div style={valueStyle}>{asset.marca || emptyValue}</div>
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Modelo</span>
              <div style={valueStyle}>{asset.modelo || emptyValue}</div>
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>N° Serie</span>
              <div style={valueStyle}>{asset.numeroSerie || emptyValue}</div>
            </div>
          </div>

          {/* Categoría + Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <span style={labelStyle}>Categoría</span>
              <div style={valueStyle}>{asset.categoria?.nombre || emptyValue}</div>
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Estado</span>
              <div style={valueStyle}>{ESTADO_LABEL[asset.estado as EstadoActivo] ?? asset.estado}</div>
            </div>
          </div>

          {/* Ubicación + Área */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <span style={labelStyle}>Ubicación</span>
              <div style={valueStyle}>{ubicacionLabel()}</div>
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Área</span>
              <div style={valueStyle}>{asset.area?.nombre || emptyValue}</div>
            </div>
          </div>

          {/* Responsable */}
          <div style={fieldStyle}>
            <span style={labelStyle}>Responsable</span>
            <div style={valueStyle}>
              {asset.responsableActual?.nombreCompleto ?? asset.responsable?.nombreCompleto ?? emptyValue}
            </div>
          </div>

          {/* Costo + Fecha */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <span style={labelStyle}>Valor de Adquisición ($)</span>
              <div style={valueStyle}>
                {asset.costoAdquisicion != null ? Number(asset.costoAdquisicion).toLocaleString('es-BO', { minimumFractionDigits: 2 }) : emptyValue}
              </div>
            </div>
            <div style={fieldStyle}>
              <span style={labelStyle}>Fecha de Adquisición</span>
              <div style={valueStyle}>
                {asset.fechaAdquisicion ? new Date(asset.fechaAdquisicion).toLocaleDateString('es-BO') : emptyValue}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div style={fieldStyle}>
            <span style={labelStyle}>Observaciones</span>
            <div style={{ ...valueStyle, minHeight: '52px', alignItems: 'flex-start', whiteSpace: 'pre-wrap' }}>
              {asset.descripcion || emptyValue}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </OverlayModal>
  );
}
