import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button } from '../../components/common';
import { getAreas } from '../../services/catalogs.service';
import { searchAssets } from '../../services/assets.service';
import { HttpError } from '../../services/http.client';
import type { Area, AssetListItem } from '../../types/assets.types';
import '../../styles/modules.css';

export const TransferenciasPage: React.FC = () => {
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [activoId, setActivoId] = useState('');
  const [areaDestinoId, setAreaDestinoId] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setMessage(null);

        const [assetsResponse, availableAreas] = await Promise.all([
          searchAssets({
            estado: 'OPERATIVO',
            page: 1,
            pageSize: 100,
            sortBy: 'nombre',
            sortType: 'ASC',
          }),
          getAreas(),
        ]);

        setAssets(assetsResponse.data ?? []);
        setAreas(availableAreas);
      } catch (error) {
        const errorMessage =
          error instanceof HttpError
            ? error.message
            : 'No se pudo cargar la información inicial de transferencias';

        setMessage({
          type: 'error',
          text: errorMessage,
        });
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === activoId) ?? null,
    [activoId, assets],
  );

  const originAreaId = selectedAsset?.area?.id ?? '';
  const originAreaName = selectedAsset?.area?.nombre ?? 'Sin área asignada';

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    if (hasErrors) {
      setMessage({
        type: 'error',
        text: sameAreaError || activoError || areaDestinoError,
      });
      return;
    }

    setMessage({
      type: 'info',
      text: 'La pantalla quedó lista. El registro definitivo de la transferencia se conectará en el siguiente paso.',
    });
  }

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Transferencias</h1>
          <p style={{ marginTop: '6px', color: '#6b7280' }}>
            Inicie la transferencia de un activo entre áreas usando solo activos elegibles.
          </p>
        </div>
      </div>

      {message ? (
        <Alert
          type={message.type === 'error' ? 'error' : 'info'}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      ) : null}

      <div className="module-list" style={{ maxWidth: '860px' }}>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-grid">
            <div className="form-group form-full">
              <label htmlFor="transfer-activo">
                Activo <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                id="transfer-activo"
                value={activoId}
                onChange={(event) => {
                  setActivoId(event.target.value);
                  setAreaDestinoId('');
                  setMessage(null);
                  setSubmitAttempted(false);
                }}
                disabled={loading}
                style={{ borderColor: activoError ? '#dc2626' : undefined }}
              >
                <option value="">
                  {loading ? 'Cargando activos operativos...' : 'Seleccione un activo'}
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.codigo} - {asset.nombre}
                  </option>
                ))}
              </select>
              {activoError ? (
                <span style={{ color: '#dc2626', fontSize: '12px' }}>{activoError}</span>
              ) : null}
            </div>

            <div className="form-group">
              <label htmlFor="transfer-area-origen">Área de origen</label>
              <input
                id="transfer-area-origen"
                type="text"
                value={originAreaName}
                readOnly
                style={{ background: '#f9fafb', color: '#374151' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="transfer-area-destino">
                Área de destino <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                id="transfer-area-destino"
                value={areaDestinoId}
                onChange={(event) => {
                  setAreaDestinoId(event.target.value);
                  setMessage(null);
                  setSubmitAttempted(false);
                }}
                disabled={loading || !activoId}
                style={{ borderColor: areaDestinoError || sameAreaError ? '#dc2626' : undefined }}
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
                <span style={{ color: '#dc2626', fontSize: '12px' }}>{sameAreaError}</span>
              ) : areaDestinoError ? (
                <span style={{ color: '#dc2626', fontSize: '12px' }}>{areaDestinoError}</span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              color: '#475569',
              fontSize: '0.92rem',
            }}
          >
            Esta pantalla deja listo el flujo visual inicial de transferencias. El guardado definitivo se conectará en el siguiente paso sobre esta misma base.
          </div>

          <div className="form-actions">
            <Button
              label="Preparar transferencia"
              type="submit"
              variant="primary"
              disabled={loading || hasErrors}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferenciasPage;
