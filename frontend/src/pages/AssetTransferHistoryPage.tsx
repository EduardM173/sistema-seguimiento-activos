import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getAssetById } from '../services/assets.service';
import { HttpError } from '../services/http.client';
import { useNotification } from '../context/NotificationContext';
import type { AssetDetail } from '../types/assets.types';

import '../styles/assets.css';

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

export default function AssetTransferHistoryPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { error: notifyError } = useNotification();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  useEffect(() => {
    async function loadAsset() {
      if (!id) {
        setErrorMessage('No se recibió el identificador del activo.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage('');
        const response = await getAssetById(id);
        setAsset(response.data);
      } catch (error) {
        const message =
          error instanceof HttpError
            ? error.message
            : 'No se pudo cargar el historial del activo';
        setErrorMessage(message);
        notifyError('Error al cargar historial', message);
      } finally {
        setLoading(false);
      }
    }

    void loadAsset();
  }, [id, notifyError]);

  const filteredHistory = useMemo(() => {
    if (!asset) return [];

    const from = startOfDay(fechaDesde);
    const to = endOfDay(fechaHasta);

    return asset.historialTransferencias.filter((transferencia) => {
      const transferDate = new Date(transferencia.fecha);

      if (Number.isNaN(transferDate.getTime())) {
        return true;
      }

      if (from && transferDate < from) return false;
      if (to && transferDate > to) return false;

      return true;
    });
  }, [asset, fechaDesde, fechaHasta]);

  return (
    <section className="assetHistoryPage">
      <div className="assetHistoryPage__topbar">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate('/activos')}
        >
          Volver a activos
        </button>
      </div>

      <div className="assetHistoryPage__header">
        <div>
          <h1 className="assetHistoryPage__title">Historial de Transferencias</h1>
          <p className="assetHistoryPage__subtitle">
            {asset
              ? `${asset.codigo} · ${asset.nombre}`
              : 'Consulta los movimientos de transferencia del activo seleccionado.'}
          </p>
        </div>
      </div>

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
            <p className="assetsState__text">Cargando historial de transferencias...</p>
          </div>
        ) : errorMessage ? (
          <div className="assetsState assetsState--error">
            <p className="assetsState__text">{errorMessage}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="assetDetailHistory__empty">
            {asset?.historialTransferencias.length
              ? 'No hay transferencias en el rango de fechas seleccionado.'
              : 'No hay transferencias registradas para este activo.'}
          </div>
        ) : (
          <div className="assetDetailHistory__table">
            <div className="assetDetailHistory__row assetDetailHistory__row--head">
              <span>Fecha</span>
              <span>Área de origen</span>
              <span>Área de destino</span>
              <span>Registrado por</span>
            </div>

            {filteredHistory.map((transferencia) => (
              <div key={transferencia.id} className="assetDetailHistory__row">
                <span>{formatDateTime(transferencia.fecha)}</span>
                <span>{transferencia.areaOrigen?.nombre ?? 'No registrada'}</span>
                <span>{transferencia.areaDestino?.nombre ?? 'No registrada'}</span>
                <span>{transferencia.realizadoPor?.nombreCompleto ?? 'No registrado'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
