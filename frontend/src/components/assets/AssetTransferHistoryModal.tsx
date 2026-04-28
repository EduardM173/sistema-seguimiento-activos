import { useEffect, useMemo, useState } from 'react';

import { getAssetById } from '../../services/assets.service';
import { HttpError } from '../../services/http.client';
import { useNotification } from '../../context/NotificationContext';
import type { AssetDetail } from '../../types/assets.types';
import OverlayModal from '../common/OverlayModal';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function startOfDay(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

type Props = {
  assetId: string;
  open: boolean;
  onClose: () => void;
};

export default function AssetTransferHistoryModal({
  assetId,
  open,
  onClose,
}: Props) {
  const { error: notifyError } = useNotification();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    if (!open || !assetId) return;

    let cancelled = false;

    async function loadAsset() {
      try {
        setLoading(true);
        setErrorMessage('');
        const response = await getAssetById(assetId);
        if (!cancelled) {
          setAsset(response.data);
        }
      } catch (error) {
        const message =
          error instanceof HttpError
            ? error.message
            : 'No se pudo cargar el historial del activo';

        if (!cancelled) {
          setErrorMessage(message);
          notifyError('Error al cargar historial', message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAsset();

    return () => {
      cancelled = true;
    };
  }, [assetId, open, notifyError]);

  useEffect(() => {
    if (!open) {
      setFechaDesde('');
      setFechaHasta('');
    }
  }, [open]);

  const filteredHistory = useMemo(() => {
    if (!asset) return [];

    const from = startOfDay(fechaDesde);
    const to = endOfDay(fechaHasta);

    return asset.historialTransferencias.filter((transferencia) => {
      const transferDate = new Date(transferencia.fecha);

      if (Number.isNaN(transferDate.getTime())) return true;
      if (from && transferDate < from) return false;
      if (to && transferDate > to) return false;

      return true;
    });
  }, [asset, fechaDesde, fechaHasta]);

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      title="Historial del Activo"
      subtitle={
        asset
          ? `${asset.codigo} · ${asset.nombre}`
          : 'Consulta los movimientos de transferencia del activo seleccionado.'
      }
      width="980px"
    >
      <div className="assetHistoryFilters">
        <label className="assetHistoryFilters__field">
          <span className="assetsFilters__label">Desde</span>
          <input
            type="date"
            className="assetsFilters__input"
            value={fechaDesde}
            onChange={(event) => setFechaDesde(event.target.value)}
          />
        </label>

        <label className="assetHistoryFilters__field">
          <span className="assetsFilters__label">Hasta</span>
          <input
            type="date"
            className="assetsFilters__input"
            value={fechaHasta}
            onChange={(event) => setFechaHasta(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setFechaDesde('');
            setFechaHasta('');
          }}
        >
          Limpiar filtros
        </button>
      </div>

      <div className="assetHistoryCard">
        {loading ? (
          <div className="assetsState">
            <p className="assetsState__text">Cargando historial del activo...</p>
          </div>
        ) : errorMessage ? (
          <div className="assetsState assetsState--error">
            <p className="assetsState__text">{errorMessage}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="assetDetailHistory__empty">
            {asset?.historialTransferencias.length
              ? 'No hay movimientos en el rango de fechas seleccionado.'
              : 'No hay movimientos registrados para este activo.'}
          </div>
        ) : (
          <div className="assetDetailHistory__table">
            <div className="assetDetailHistory__row assetDetailHistory__row--head">
              <span>Fecha</span>
              <span>Tipo</span>
              <span>Área de origen</span>
              <span>Área de destino</span>
              <span>Registrado por</span>
              <span>Detalle</span>
            </div>

            {filteredHistory.map((transferencia) => (
              <div key={transferencia.id} className="assetDetailHistory__row">
                <span>{formatDateTime(transferencia.fecha)}</span>
                <span>{transferencia.tipo === 'BAJA' ? 'Baja' : 'Transferencia'}</span>
                <span>{transferencia.areaOrigen?.nombre ?? 'No registrada'}</span>
                <span>{transferencia.areaDestino?.nombre ?? 'No registrada'}</span>
                <span>{transferencia.realizadoPor?.nombreCompleto ?? 'No registrado'}</span>
                <span>{transferencia.detalle ?? 'Sin detalle'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </OverlayModal>
  );
}
