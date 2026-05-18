import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, DataTable, SearchBar } from '../../components/common';
import type { Column } from '../../components/common/DataTable';
import { useAuth } from '../../context/AuthContext';
import { searchAssets } from '../../services/assets.service';
import { auditoriaService } from '../../services/auditoria.service';
import ViewAssetModal from '../../components/activos/ViewAssetModal';
import type { AssetListItem } from '../../types/assets.types';
import type {
  TrazabilidadActivo,
  TrazabilidadDepartamental,
  TrazabilidadMovimiento,
  TipoMovimientoTrazabilidad,
} from '../../types/auditoria.types';
import '../../styles/modules.css';

const PAGE_SIZE = 12;

const MOVEMENT_OPTIONS: { value: TipoMovimientoTrazabilidad | ''; label: string }[] = [
  { value: '', label: 'Todos los movimientos' },
  { value: 'REGISTRO', label: 'Registro' },
  { value: 'ASIGNACION', label: 'Asignación' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'DEVOLUCION', label: 'Devolución' },
  { value: 'BAJA', label: 'Baja' },
  { value: 'ACTUALIZACION', label: 'Actualización' },
  { value: 'INCIDENTE', label: 'Incidente' },
];

export default function TrazabilidadDepartamentalPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState<TipoMovimientoTrazabilidad | ''>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);
  const [departmentTraceability, setDepartmentTraceability] =
    useState<TrazabilidadDepartamental | null>(null);
  const [traceability, setTraceability] = useState<TrazabilidadActivo | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [departmentLoading, setDepartmentLoading] = useState(true);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const invalidDateRange = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta);

  useEffect(() => {
    if (invalidDateRange) {
      setDepartmentTraceability(null);
      setDepartmentLoading(false);
      setMessage({
        type: 'error',
        text: 'La fecha desde no puede ser posterior a la fecha hasta.',
      });
      return;
    }

    void loadDepartmentTraceability();
  }, [tipoMovimiento, fechaDesde, fechaHasta, invalidDateRange]);

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

  async function loadDepartmentTraceability() {
    try {
      setDepartmentLoading(true);
      const response = await auditoriaService.obtenerTrazabilidadDepartamental({
        tipoMovimiento: tipoMovimiento || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      });
      setDepartmentTraceability(response ?? null);
    } catch (error) {
      setDepartmentTraceability(null);
      setMessage({
        type: 'error',
        text: 'No se pudo cargar la lista consolidada de movimientos del departamento.',
      });
      console.error(error);
    } finally {
      setDepartmentLoading(false);
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
    {
      header: 'Detalle',
      accessor: (row) => row.activo?.id ?? '',
      render: (_value: string, row) => (
        <button
          type="button"
          className="department-traceability__detailButton"
          onClick={() => row.activo?.id && setViewingAssetId(row.activo.id)}
          disabled={!row.activo?.id}
        >
          Ver detalle
        </button>
      ),
    },
  ];

  const consolidatedColumns: Column<TrazabilidadMovimiento>[] = [
    {
      header: 'Activo',
      accessor: (row) =>
        row.activo ? `${row.activo.codigo} - ${row.activo.nombre}` : 'No registrado',
      render: (_value: string, row) => (
        <button
          type="button"
          className="department-traceability__assetLink"
          onClick={() => row.activo?.id && setSelectedAssetId(row.activo.id)}
          disabled={!row.activo?.id}
        >
          <strong>{row.activo?.codigo ?? 'N/A'}</strong>
          <span>{row.activo?.nombre ?? 'Activo no registrado'}</span>
        </button>
      ),
    },
    {
      header: 'Movimiento',
      accessor: 'tipo',
      render: (value: TipoMovimientoTrazabilidad, row) => (
        <Badge label={row.etiqueta || value} variant={getMovimientoColor(value)} size="sm" />
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fecha',
      render: (value: string) => formatDateTime(value),
    },
    {
      header: 'Origen',
      accessor: (row) => row.areaOrigen?.nombre ?? 'No aplica',
    },
    {
      header: 'Destino',
      accessor: (row) => row.areaDestino?.nombre ?? 'No aplica',
    },
    {
      header: 'Usuario',
      accessor: (row) => row.realizadoPor?.nombreCompleto ?? 'No registrado',
    },
    {
      header: 'Detalle',
      accessor: (row) => row.activo?.id ?? '',
      render: (_value: string, row) => (
        <button
          type="button"
          className="department-traceability__detailButton"
          onClick={() => row.activo?.id && setViewingAssetId(row.activo.id)}
          disabled={!row.activo?.id}
        >
          Ver detalle
        </button>
      ),
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
        <section className="module-list department-traceability__consolidated">
          <div className="list-header department-traceability__sectionHeader">
            <div>
              <h2>Movimientos consolidados del departamento</h2>
              <p>
                Lista única de movimientos registrados en los activos vinculados a su
                departamento.
              </p>
            </div>
            <Badge
              label={`${departmentTraceability?.resumen.totalMovimientos ?? 0} movimiento(s)`}
              variant="info"
              size="sm"
            />
          </div>

          <div className="department-traceability__filters">
            <label>
              <span>Tipo de movimiento</span>
              <select
                value={tipoMovimiento}
                onChange={(event) =>
                  setTipoMovimiento(event.target.value as TipoMovimientoTrazabilidad | '')
                }
              >
                {MOVEMENT_OPTIONS.map((option) => (
                  <option key={option.value || 'ALL'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Desde</span>
              <input
                type="date"
                value={fechaDesde}
                max={fechaHasta || undefined}
                onChange={(event) => setFechaDesde(event.target.value)}
                aria-invalid={invalidDateRange}
              />
            </label>

            <label>
              <span>Hasta</span>
              <input
                type="date"
                value={fechaHasta}
                min={fechaDesde || undefined}
                onChange={(event) => setFechaHasta(event.target.value)}
                aria-invalid={invalidDateRange}
              />
            </label>
          </div>

          {invalidDateRange ? (
            <div className="department-traceability__validation">
              La fecha desde no puede ser posterior a la fecha hasta.
            </div>
          ) : null}

          {departmentTraceability ? (
            <div className="department-traceability__summary">
              <div>
                <span>Activos con movimiento</span>
                <strong>{departmentTraceability.resumen.totalActivos}</strong>
              </div>
              <div>
                <span>Total movimientos</span>
                <strong>{departmentTraceability.resumen.totalMovimientos}</strong>
              </div>
              <div>
                <span>Área</span>
                <strong>{user?.area?.nombre ?? 'No asignada'}</strong>
              </div>
            </div>
          ) : null}

          <DataTable<TrazabilidadMovimiento>
            columns={consolidatedColumns}
            data={departmentTraceability?.movimientos ?? []}
            loading={departmentLoading}
            emptyMessage="No hay movimientos registrados para los activos del departamento"
            striped
            hover
            paginated
            pageSize={8}
          />
        </section>

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

      {viewingAssetId ? (
        <ViewAssetModal
          assetId={viewingAssetId}
          open={Boolean(viewingAssetId)}
          onClose={() => setViewingAssetId(null)}
        />
      ) : null}
    </div>
  );
}
