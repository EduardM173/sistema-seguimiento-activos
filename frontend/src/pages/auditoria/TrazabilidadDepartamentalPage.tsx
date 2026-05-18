import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, DataTable, SearchBar } from '../../components/common';
import type { Column } from '../../components/common/DataTable';
import { useAuth } from '../../context/AuthContext';
import { searchAssets } from '../../services/assets.service';
import { auditoriaService } from '../../services/auditoria.service';
import type { AssetListItem } from '../../types/assets.types';
import type {
  TrazabilidadActivo,
  TrazabilidadMovimiento,
  TipoMovimientoTrazabilidad,
} from '../../types/auditoria.types';
import '../../styles/modules.css';

const PAGE_SIZE = 12;

export default function TrazabilidadDepartamentalPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [traceability, setTraceability] = useState<TrazabilidadActivo | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDepartmentAssets(searchText);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!selectedAssetId) {
      setTraceability(null);
      return;
    }

    void loadTraceability(selectedAssetId);
  }, [selectedAssetId]);

  async function loadDepartmentAssets(q = '') {
    try {
      setAssetsLoading(true);
      const response = await searchAssets({
        q,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: 'codigo',
        sortType: 'ASC',
      });
      const data = response.data ?? [];
      setAssets(data);

      if (selectedAssetId && !data.some((asset) => asset.id === selectedAssetId)) {
        setSelectedAssetId('');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'No se pudieron cargar los activos vinculados a su departamento.',
      });
      console.error(error);
    } finally {
      setAssetsLoading(false);
    }
  }

  async function loadTraceability(assetId: string) {
    try {
      setTraceabilityLoading(true);
      const response = await auditoriaService.obtenerTrazabilidadDepartamentalActivo(assetId);
      setTraceability(response ?? null);
    } catch (error) {
      setTraceability(null);
      setMessage({
        type: 'error',
        text: 'No se pudo cargar la trazabilidad del activo seleccionado.',
      });
      console.error(error);
    } finally {
      setTraceabilityLoading(false);
    }
  }

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const getMovimientoColor = (tipo: TipoMovimientoTrazabilidad): any => {
    const colores: Record<TipoMovimientoTrazabilidad, any> = {
      REGISTRO: 'success',
      ASIGNACION: 'primary',
      TRANSFERENCIA: 'info',
      DEVOLUCION: 'warning',
      BAJA: 'danger',
      ACTUALIZACION: 'secondary',
      INCIDENTE: 'warning',
    };
    return colores[tipo] || 'secondary';
  };

  const formatDateTime = (value: string | Date) =>
    new Date(value).toLocaleString('es-BO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const columns: Column<TrazabilidadMovimiento>[] = [
    {
      header: 'Tipo',
      accessor: 'tipo',
      render: (value: TipoMovimientoTrazabilidad, row: TrazabilidadMovimiento) => (
        <Badge label={row.etiqueta || value} variant={getMovimientoColor(value)} size="sm" />
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fecha',
      render: (value: string) => formatDateTime(value),
    },
    {
      header: 'Área origen',
      accessor: (row) => row.areaOrigen?.nombre ?? 'No aplica',
    },
    {
      header: 'Área destino',
      accessor: (row) => row.areaDestino?.nombre ?? 'No aplica',
    },
    {
      header: 'Usuario relacionado',
      accessor: (row) =>
        row.realizadoPor?.nombreCompleto ||
        row.usuarioDestino?.nombreCompleto ||
        row.usuarioOrigen?.nombreCompleto ||
        'No registrado',
    },
  ];

  return (
    <div className="module-page department-traceability">
      <div className="module-header">
        <div>
          <h1>Trazabilidad Departamental</h1>
          <p>
            Consulte los movimientos de los activos vinculados a su departamento para
            mantener control sobre los cambios que afectan a su área.
          </p>
        </div>
        <Badge
          label={user?.area?.nombre ? `Área: ${user.area.nombre}` : 'Sin área asignada'}
          variant={user?.area?.nombre ? 'primary' : 'warning'}
          size="md"
        />
      </div>

      {message ? (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      ) : null}

      {!user?.area?.id ? (
        <Alert
          type="warning"
          title="Área no asignada"
          message="Para consultar trazabilidad departamental, su usuario debe tener un área asignada."
          dismissible={false}
        />
      ) : null}

      <div className="department-traceability__layout">
        <section className="module-list department-traceability__assets">
          <div className="list-header department-traceability__sectionHeader">
            <div>
              <h2>Activos del departamento</h2>
              <p>Seleccione un activo para consultar sus movimientos registrados.</p>
            </div>
            <Badge label={`${assets.length} activo(s)`} variant="info" size="sm" />
          </div>

          <div className="department-traceability__search">
            <SearchBar
              onSearch={setSearchText}
              placeholder="Buscar activo por código o nombre..."
            />
          </div>

          <div className="department-traceability__assetList" aria-busy={assetsLoading}>
            {assetsLoading ? (
              <p className="department-traceability__empty">Cargando activos del departamento...</p>
            ) : assets.length === 0 ? (
              <p className="department-traceability__empty">
                No hay activos vinculados a su departamento.
              </p>
            ) : (
              assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`department-traceability__assetCard${
                    selectedAssetId === asset.id ? ' department-traceability__assetCard--selected' : ''
                  }`}
                  onClick={() => setSelectedAssetId(asset.id)}
                >
                  <span>{asset.codigo}</span>
                  <strong>{asset.nombre}</strong>
                  <small>
                    {asset.categoria?.nombre ?? 'Sin categoría'} · {asset.estadoLabel}
                  </small>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="module-list department-traceability__detail">
          <div className="list-header department-traceability__sectionHeader">
            <div>
              <h2>Movimientos del activo</h2>
              <p>
                {selectedAsset
                  ? `${selectedAsset.codigo} - ${selectedAsset.nombre}`
                  : 'Seleccione un activo para ver su trazabilidad.'}
              </p>
            </div>
            {traceability ? (
              <Badge
                label={`${traceability.resumen.totalMovimientos} movimiento(s)`}
                variant="info"
                size="sm"
              />
            ) : null}
          </div>

          {selectedAsset ? (
            <div className="department-traceability__summary">
              <div>
                <span>Área actual</span>
                <strong>{selectedAsset.area?.nombre ?? 'No asignada'}</strong>
              </div>
              <div>
                <span>Responsable</span>
                <strong>{selectedAsset.responsable?.nombreCompleto ?? 'No asignado'}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{selectedAsset.estadoLabel}</strong>
              </div>
            </div>
          ) : null}

          <DataTable<TrazabilidadMovimiento>
            columns={columns}
            data={traceability?.movimientos ?? []}
            loading={traceabilityLoading}
            emptyMessage={
              selectedAssetId
                ? 'Este activo no tiene movimientos registrados'
                : 'Seleccione un activo del departamento'
            }
            striped
            hover
            paginated
            pageSize={8}
          />
        </section>
      </div>
    </div>
  );
}
