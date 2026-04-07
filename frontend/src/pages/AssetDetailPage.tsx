import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getAssetById } from '../services/assets.service';
import { HttpError } from '../services/http.client';
import { useNotification } from '../context/NotificationContext';
import type { AssetDetail } from '../types/assets.types';

import '../styles/assets.css';

function formatDate(value: string | null) {
  if (!value) return 'No registrado';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatMoney(value: number | string | null) {
  if (value === null || value === undefined) return 'No registrado';

  const parsedValue =
    typeof value === 'string' ? Number.parseFloat(value) : value;

  if (Number.isNaN(parsedValue)) return String(value);

  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(parsedValue);
}

function renderValue(value: string | null | undefined) {
  return value && String(value).trim() ? value : 'No registrado';
}

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

  const detailSections = useMemo(
    () =>
      asset
        ? [
            {
              title: 'Informacion General',
              items: [
                { label: 'Codigo', value: asset.codigo },
                { label: 'Nombre', value: asset.nombre },
                { label: 'Descripcion', value: renderValue(asset.descripcion) },
                { label: 'Estado', value: asset.estadoLabel },
              ],
            },
            {
              title: 'Clasificacion Y Estado',
              items: [
                {
                  label: 'Categoria',
                  value: asset.categoria?.nombre ?? 'No registrada',
                },
                {
                  label: 'Ubicacion',
                  value: asset.ubicacion?.nombre ?? 'No registrada',
                },
                {
                  label: 'Area Actual',
                  value: asset.areaActual?.nombre ?? 'No registrada',
                },
                {
                  label: 'Responsable Actual',
                  value:
                    asset.responsableActual?.nombreCompleto ?? 'No registrado',
                },
              ],
            },
            {
              title: 'Datos Tecnicos',
              items: [
                { label: 'Marca', value: renderValue(asset.marca) },
                { label: 'Modelo', value: renderValue(asset.modelo) },
                {
                  label: 'Numero De Serie',
                  value: renderValue(asset.numeroSerie),
                },
                {
                  label: 'Garantia Hasta',
                  value: formatDate(asset.vencimientoGarantia),
                },
              ],
            },
            {
              title: 'Datos Administrativos',
              items: [
                {
                  label: 'Fecha De Adquisicion',
                  value: formatDate(asset.fechaAdquisicion),
                },
                {
                  label: 'Costo De Adquisicion',
                  value: formatMoney(asset.costoAdquisicion),
                },
                {
                  label: 'Creado Por',
                  value: asset.creadoPor?.nombreCompleto ?? 'No registrado',
                },
                {
                  label: 'Actualizado Por',
                  value:
                    asset.actualizadoPor?.nombreCompleto ?? 'No registrado',
                },
                {
                  label: 'Fecha De Creacion',
                  value: formatDate(asset.creadoEn),
                },
                {
                  label: 'Ultima Actualizacion',
                  value: formatDate(asset.actualizadoEn),
                },
              ],
            },
          ]
        : [],
    [asset],
  );

  if (loading) {
    return (
      <section className="assetDetailPage">
        <div className="assetsState">
          <p className="assetsState__text">Cargando detalle del activo...</p>
        </div>
      </section>
    );
  }

  if (!asset) {
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
        <div className="assetsState assetsState--error">
          <p className="assetsState__text">
            {errorMessage || 'No se encontro el activo solicitado.'}
          </p>
        </div>
      </section>
    );
  }

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

      <header className="assetDetailPage__header">
        <div>
          <h1 className="assetDetailPage__title">Detalle del Activo</h1>
          <p className="assetDetailPage__subtitle">
            Informacion completa y organizada del activo seleccionado.
          </p>
        </div>
        <div className="assetDetailHero__badgeWrap">
          <span className="assetDetailHero__code">{asset.codigo}</span>
          <span
            className={`statusBadge ${asset.estado === 'OPERATIVO'
              ? 'statusBadge--activo'
              : asset.estado === 'MANTENIMIENTO'
                ? 'statusBadge--mantenimiento'
                : asset.estado === 'FUERA_DE_SERVICIO'
                  ? 'statusBadge--fuera'
                  : 'statusBadge--baja'
            }`}
          >
            {asset.estadoLabel}
          </span>
        </div>
      </header>

      <div className="assetDetailHero">
        <div className="assetDetailHero__summary">
          <h2 className="assetDetailHero__name">{asset.nombre}</h2>
          <p className="assetDetailHero__description">
            {renderValue(asset.descripcion)}
          </p>

          <div className="assetDetailHero__grid">
            <div className="assetDetailHero__item">
              <span className="assetDetailHero__label">Categoria</span>
              <strong>{asset.categoria?.nombre ?? 'No registrada'}</strong>
            </div>
            <div className="assetDetailHero__item">
              <span className="assetDetailHero__label">Ubicacion</span>
              <strong>{asset.ubicacion?.nombre ?? 'No registrada'}</strong>
            </div>
            <div className="assetDetailHero__item">
              <span className="assetDetailHero__label">Responsable</span>
              <strong>
                {asset.responsableActual?.nombreCompleto ?? 'No registrado'}
              </strong>
            </div>
            <div className="assetDetailHero__item">
              <span className="assetDetailHero__label">Area</span>
              <strong>{asset.areaActual?.nombre ?? 'No registrada'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="assetDetailSections">
        {detailSections.map((section) => (
          <article key={section.title} className="assetDetailCard">
            <h3 className="assetDetailCard__title">{section.title}</h3>
            <div className="assetDetailCard__grid">
              {section.items.map((item) => (
                <div key={item.label} className="assetDetailCard__item">
                  <span className="assetDetailCard__label">{item.label}</span>
                  <strong className="assetDetailCard__value">
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
