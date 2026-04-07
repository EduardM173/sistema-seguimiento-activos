import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import AssetDetailPanel from '../components/assets/AssetDetailPanel';
import { getAssetById } from '../services/assets.service';
import { HttpError } from '../services/http.client';
import { useNotification } from '../context/NotificationContext';
import type { AssetDetail } from '../types/assets.types';

import '../styles/assets.css';

export default function AssetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { error: notifyError } = useNotification();

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadAssetDetail() {
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
            : 'No se pudo cargar el detalle del activo';
        setErrorMessage(message);
        notifyError('Error al cargar detalle', message);
      } finally {
        setLoading(false);
      }
    }

    void loadAssetDetail();
  }, [id, notifyError]);

  return (
    <section className="assetDetailPage">
      <div className="assetDetailPage__topbar">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => navigate('/activos')}
        >
          Volver a activos
        </button>
      </div>

      <AssetDetailPanel asset={asset} loading={loading} errorMessage={errorMessage} />
    </section>
  );
}
