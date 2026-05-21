import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  SearchBar,
} from '../../components/common';
import OverlayModal from '../../components/common/OverlayModal';
import { searchAssets } from '../../services/assets.service';
import { auditoriaMsService } from '../../services/auditoria-ms.service';
import type { AssetListItem } from '../../types/assets.types';
import type { TrazabilidadActivo } from '../../types/auditoria.types';
import type {
  AuditoriaMsFiltros,
  AuditoriaMsRegistro,
  AuditoriaMsUsuario,
} from '../../types/auditoria-ms.types';
import '../../styles/modules.css';
import '../../styles/auditoria.css';

function formatJsonBlock(value: Record<string, unknown> | null) {
  if (!value || Object.keys(value).length === 0) {
    return 'Sin información registrada';
  }
  return JSON.stringify(value, null, 2);
}

function accionVariant(accion: string) {
  const normalized = accion.toLowerCase();
  if (normalized.includes('delete') || normalized.includes('baja')) return 'danger';
  if (normalized.includes('update') || normalized.includes('edit')) return 'warning';
  if (normalized.includes('create') || normalized.includes('assign')) return 'success';
  return 'info';
}

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export const AuditoriaPage: React.FC = () => {
  const [usuarios, setUsuarios] = useState<AuditoriaMsUsuario[]>([]);
  const [registros, setRegistros] = useState<AuditoriaMsRegistro[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [traceSearchKey, setTraceSearchKey] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [traceability, setTraceability] = useState<TrazabilidadActivo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [selected, setSelected] = useState<AuditoriaMsRegistro | null>(null);
  const [message, setMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [traceabilityMessage, setTraceabilityMessage] =
    useState<{ type: 'info' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [filtros, setFiltros] = useState<AuditoriaMsFiltros>({
    page: 1,
    pageSize: 50,
  });

  const [usuarioId, setUsuarioId] = useState('');
  const [tipoEntidad, setTipoEntidad] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [traceFechaDesde, setTraceFechaDesde] = useState('');
  const [traceFechaHasta, setTraceFechaHasta] = useState('');
  const invalidAuditDateRange = Boolean(
    fechaDesde && fechaHasta && fechaDesde > fechaHasta,
  );
  const invalidTraceDateRange = Boolean(
    traceFechaDesde && traceFechaHasta && traceFechaDesde > traceFechaHasta,
  );

  async function loadAssets(q = '') {
    try {
      setAssetsLoading(true);
      const response = await searchAssets({
        q,
        page: 1,
        pageSize: 20,
        sortBy: 'codigo',
        sortType: 'ASC',
      });
      setAssets(response.data ?? []);
    } catch (error) {
      console.error(error);
      setAssets([]);
      setTraceabilityMessage({
        type: 'error',
        text: 'No se pudieron cargar los activos para consultar trazabilidad.',
      });
    } finally {
      setAssetsLoading(false);
    }
  }

  async function loadTraceability(assetId = selectedAssetId) {
    if (!assetId) {
      setTraceability(null);
      return;
    }

    if (invalidTraceDateRange) {
      setTraceability(null);
      setTraceabilityMessage({
        type: 'error',
        text: 'La fecha desde no puede ser posterior a la fecha hasta.',
      });
      return;
    }

    try {
      setTraceabilityLoading(true);
      setTraceabilityMessage(null);
      const response = await auditoriaMsService.obtenerTrazabilidadActivo(assetId, {
        fechaDesde: traceFechaDesde || undefined,
        fechaHasta: traceFechaHasta || undefined,
      });
      setTraceability(response.data ?? null);
    } catch (error) {
      console.error(error);
      setTraceability(null);
      setTraceabilityMessage({
        type: 'error',
        text: 'No se pudo cargar la trazabilidad consolidada del activo.',
      });
    } finally {
      setTraceabilityLoading(false);
    }
  }

  async function loadUsuarios() {
    try {
      const response = await auditoriaMsService.obtenerUsuarios();
      setUsuarios(response.data ?? []);
    } catch (error) {
      console.error(error);
      setUsuarios([]);
    }
  }

  async function loadRegistros(nextFilters?: AuditoriaMsFiltros) {
    try {
      setLoading(true);
      setMessage(null);

      const requestFilters = {
        ...filtros,
        ...nextFilters,
      };

      const response = await auditoriaMsService.obtenerRegistros(requestFilters);
      setRegistros(response.data ?? []);
      setFiltros(requestFilters);
    } catch (error) {
      console.error(error);
      setRegistros([]);
      setMessage({
        type: 'error',
        text: 'No se pudieron cargar los registros de auditoría.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets();
    void loadUsuarios();
    void loadRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAssets(assetSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [assetSearch]);

  useEffect(() => {
    if (!selectedAssetId) return;

    const timer = window.setTimeout(() => {
      void loadTraceability(selectedAssetId);
    }, 250);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId, traceFechaDesde, traceFechaHasta]);

  const entityOptions = useMemo(() => {
    const unique = Array.from(new Set(registros.map((item) => item.tipoEntidad))).filter(Boolean);
    return unique.sort((a, b) => a.localeCompare(b));
  }, [registros]);

  const auditRows = useMemo(
    () =>
      [...registros].sort(
        (left, right) =>
          new Date(right.creadoEn).getTime() - new Date(left.creadoEn).getTime(),
      ),
    [registros],
  );

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const traceabilityRows = useMemo(
    () =>
      [...(traceability?.movimientos ?? [])]
        .sort(
          (left, right) =>
            new Date(right.fecha).getTime() - new Date(left.fecha).getTime(),
        )
        .map((event) => ({
          id: event.id,
          fuente: 'Movimiento',
          fecha: event.fecha,
          tipo: event.etiqueta || event.tipo,
          detalle: event.detalle,
          areaOrigen: event.areaOrigen?.nombre ?? 'No aplica',
          areaDestino: event.areaDestino?.nombre ?? 'No aplica',
          usuario:
            event.usuarioRelacionado?.nombreCompleto ||
            event.realizadoPor?.nombreCompleto ||
            event.usuarioDestino?.nombreCompleto ||
            event.usuarioOrigen?.nombreCompleto ||
            'No registrado',
        })),
    [traceability],
  );

  function selectTraceabilityAsset(asset: AssetListItem) {
    setSelectedAssetId(asset.id);
    setTraceability(null);
  }

  function clearTraceabilityFilters() {
    setAssetSearch('');
    setTraceSearchKey((key) => key + 1);
    setSelectedAssetId('');
    setTraceFechaDesde('');
    setTraceFechaHasta('');
    setTraceability(null);
    setTraceabilityMessage(null);
    void loadAssets('');
  }

  async function applyFilters() {
    if (invalidAuditDateRange) {
      setMessage({
        type: 'error',
        text: 'La fecha desde no puede ser posterior a la fecha hasta.',
      });
      return;
    }

    await loadRegistros({
      usuarioId: usuarioId || undefined,
      tipoEntidad: tipoEntidad || undefined,
      fechaDesde: fechaDesde ? `${fechaDesde}T00:00:00.000Z` : undefined,
      fechaHasta: fechaHasta ? `${fechaHasta}T23:59:59.999Z` : undefined,
      q: search || undefined,
      page: 1,
      pageSize: 50,
    });
  }

  async function clearFilters() {
    setUsuarioId('');
    setTipoEntidad('');
    setFechaDesde('');
    setFechaHasta('');
    setSearch('');
    await loadRegistros({
      usuarioId: undefined,
      tipoEntidad: undefined,
      fechaDesde: undefined,
      fechaHasta: undefined,
      q: undefined,
      page: 1,
      pageSize: 50,
    });
  }

  async function openDetalle(registro: AuditoriaMsRegistro) {
    try {
      setLoadingDetalle(true);
      const response = await auditoriaMsService.obtenerRegistroPorId(registro.id);
      setSelected(response.data);
    } catch (error) {
      console.error(error);
      setSelected(registro);
      setMessage({
        type: 'error',
        text: 'No se pudo cargar el detalle completo del registro seleccionado.',
      });
    } finally {
      setLoadingDetalle(false);
    }
  }

  const columns = [
    {
      header: 'Usuario',
      accessor: (row: AuditoriaMsRegistro) =>
        row.usuario
          ? `${row.usuario.nombres} ${row.usuario.apellidos}`
          : 'Sistema / Sin usuario',
    },
    {
      header: 'Acción',
      accessor: 'accion' as const,
      render: (value: string) => (
        <Badge
          label={value.toUpperCase()}
          variant={accionVariant(value)}
          size="sm"
        />
      ),
    },
    {
      header: 'Entidad',
      accessor: (row: AuditoriaMsRegistro) => `${row.tipoEntidad} (${row.entidadId})`,
    },
    {
      header: 'Fecha',
      accessor: 'creadoEn' as const,
      render: (value: string) =>
        new Date(value).toLocaleString('es-BO', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
    },
    {
      header: 'Detalle',
      accessor: 'id' as const,
      width: '110px',
      render: (_: string, row: AuditoriaMsRegistro) => (
        <Button
          label="Ver"
          size="sm"
          variant="secondary"
          onClick={() => {
            void openDetalle(row);
          }}
        />
      ),
    },
  ];

  const traceabilityColumns = [
    {
      header: 'Fuente',
      accessor: 'fuente' as const,
    },
    {
      header: 'Tipo',
      accessor: 'tipo' as const,
    },
    {
      header: 'Fecha',
      accessor: 'fecha' as const,
      render: (value: string) => (value ? formatDateTime(value) : 'Sin fecha'),
    },
    {
      header: 'Área origen',
      accessor: 'areaOrigen' as const,
    },
    {
      header: 'Área destino',
      accessor: 'areaDestino' as const,
    },
    {
      header: 'Usuario',
      accessor: 'usuario' as const,
    },
    {
      header: 'Detalle',
      accessor: 'detalle' as const,
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Auditoría y Trazabilidad</h1>
        <p>Consulta quién realizó cada cambio en el sistema.</p>
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      <section className="module-list audit-traceability">
        <div className="list-header audit-traceability__header">
          <div>
            <h2>Trazabilidad consolidada de activo</h2>
            <p>
              Seleccione un activo para consultar sus movimientos registrados y el resumen
              de auditoría asociado.
            </p>
          </div>
        </div>

        {traceabilityMessage ? (
          <div className="audit-traceability__message">
            <Alert
              type={traceabilityMessage.type}
              message={traceabilityMessage.text}
              dismissible
              onClose={() => setTraceabilityMessage(null)}
            />
          </div>
        ) : null}

        <div className="audit-traceability__filters">
          <div className="audit-traceability__assetSearch">
            <span>Activo</span>
            <SearchBar
              key={traceSearchKey}
              onSearch={setAssetSearch}
              placeholder="Buscar activo por código o nombre..."
            />
            <div className="audit-traceability__assetResults" aria-busy={assetsLoading}>
              {assetsLoading ? (
                <p>Cargando activos...</p>
              ) : assets.length === 0 ? (
                <p>No se encontraron activos con ese criterio.</p>
              ) : (
                assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={
                      selectedAssetId === asset.id
                        ? 'audit-traceability__assetResult audit-traceability__assetResult--selected'
                        : 'audit-traceability__assetResult'
                    }
                    onClick={() => selectTraceabilityAsset(asset)}
                  >
                    <strong>{asset.codigo}</strong>
                    <span>{asset.nombre}</span>
                    <small>{asset.area?.nombre ?? 'Sin área asignada'}</small>
                  </button>
                ))
              )}
            </div>
          </div>

          <label className="audit-traceability__date">
            <span>Desde</span>
            <input
              type="date"
              value={traceFechaDesde}
              max={traceFechaHasta || undefined}
              aria-invalid={invalidTraceDateRange}
              onChange={(event) => setTraceFechaDesde(event.target.value)}
            />
          </label>

          <label className="audit-traceability__date">
            <span>Hasta</span>
            <input
              type="date"
              value={traceFechaHasta}
              min={traceFechaDesde || undefined}
              aria-invalid={invalidTraceDateRange}
              onChange={(event) => setTraceFechaHasta(event.target.value)}
            />
          </label>

          <div className="audit-actions">
            <Button
              label="Limpiar filtros"
              variant="secondary"
              disabled={
                traceabilityLoading ||
                (!selectedAssetId && !assetSearch && !traceFechaDesde && !traceFechaHasta && !traceability)
              }
              onClick={clearTraceabilityFilters}
            />
          </div>
        </div>

        {invalidTraceDateRange ? (
          <div className="audit-traceability__validation">
            La fecha desde no puede ser posterior a la fecha hasta.
          </div>
        ) : null}

        {traceability ? (
          <div className="audit-traceability__summary">
            <div>
              <span>Activo seleccionado</span>
              <strong>
                {traceability.activo.codigo} - {traceability.activo.nombre}
              </strong>
            </div>
            <div>
              <span>Movimientos</span>
              <strong>{traceability.resumen.totalMovimientos}</strong>
            </div>
            <div>
              <span>Auditorías</span>
              <strong>{traceability.resumen.totalRegistrosAuditoria}</strong>
            </div>
          </div>
        ) : selectedAsset ? (
          <div className="audit-traceability__summary">
            <div>
              <span>Activo seleccionado</span>
              <strong>
                {selectedAsset.codigo} - {selectedAsset.nombre}
              </strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{selectedAsset.estadoLabel}</strong>
            </div>
            <div>
              <span>Área</span>
              <strong>{selectedAsset.area?.nombre ?? 'No asignada'}</strong>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={traceabilityColumns}
          data={traceabilityRows}
          loading={traceabilityLoading}
          emptyMessage={
            selectedAssetId
              ? 'Este activo no tiene movimientos registrados'
              : 'Seleccione un activo para consultar su trazabilidad'
          }
          striped
          hover
          paginated
          pageSize={8}
        />
      </section>

      <div className="module-list">
        <div className="list-header audit-filters-wrap">
          <SearchBar
            onSearch={(value) => setSearch(value)}
            placeholder="Buscar por acción, entidad o usuario..."
          />

          <div className="audit-filters">
            <div className="audit-filter">
              <label htmlFor="audit-usuario">Usuario</label>
              <select
                id="audit-usuario"
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
              >
                <option value="">Todos</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombres} {usuario.apellidos} ({usuario.correo})
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter">
              <label htmlFor="audit-entidad">Entidad</label>
              <select
                id="audit-entidad"
                value={tipoEntidad}
                onChange={(e) => setTipoEntidad(e.target.value)}
              >
                <option value="">Todas</option>
                {entityOptions.map((entidad) => (
                  <option key={entidad} value={entidad}>
                    {entidad}
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter">
              <label htmlFor="audit-desde">Fecha desde</label>
              <input
                id="audit-desde"
                type="date"
                value={fechaDesde}
                max={fechaHasta || undefined}
                aria-invalid={invalidAuditDateRange}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>

            <div className="audit-filter">
              <label htmlFor="audit-hasta">Fecha hasta</label>
              <input
                id="audit-hasta"
                type="date"
                value={fechaHasta}
                min={fechaDesde || undefined}
                aria-invalid={invalidAuditDateRange}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>

            <div className="audit-actions">
              <Button
                label="Actualizar"
                variant="secondary"
                onClick={() => {
                  void loadRegistros({
                    ...filtros,
                    page: 1,
                    pageSize: 50,
                  });
                }}
              />
              <Button label="Aplicar filtros" variant="primary" onClick={() => { void applyFilters(); }} />
              <Button label="Limpiar" variant="secondary" onClick={() => { void clearFilters(); }} />
            </div>
          </div>
        </div>

        {invalidAuditDateRange ? (
          <div className="audit-traceability__validation">
            La fecha desde no puede ser posterior a la fecha hasta.
          </div>
        ) : null}

        <div className="audit-table-scroll">
          <DataTable<AuditoriaMsRegistro>
            columns={columns}
            data={auditRows}
            loading={loading}
            emptyMessage="No hay registros de auditoría para los filtros seleccionados"
            striped
            hover
          />
        </div>
        <p className="audit-table-hint">
          En pantallas angostas puedes desplazarte horizontalmente para ver todas las columnas.
        </p>
      </div>

      <OverlayModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detalle de registro de auditoría"
        subtitle="Acción, entidad, usuario y valores anteriores/nuevos"
        width="900px"
        className="overlayModal__dialog--dark"
      >
        {selected ? (
          <div className="audit-detail">
            <div className="audit-detail-grid">
              <div className="audit-detail-item"><strong>Acción:</strong> {selected.accion}</div>
              <div className="audit-detail-item"><strong>Entidad:</strong> {selected.tipoEntidad}</div>
              <div className="audit-detail-item"><strong>ID Entidad:</strong> {selected.entidadId}</div>
              <div className="audit-detail-item">
                <strong>Fecha:</strong>{' '}
                {new Date(selected.creadoEn).toLocaleString('es-BO', {
                  dateStyle: 'short',
                  timeStyle: 'medium',
                })}
              </div>
              <div className="audit-detail-item">
                <strong>Usuario:</strong>{' '}
                {selected.usuario
                  ? `${selected.usuario.nombres} ${selected.usuario.apellidos} (${selected.usuario.correo})`
                  : 'Sistema / Sin usuario'}
              </div>
              <div className="audit-detail-item"><strong>IP:</strong> {selected.direccionIp || 'Sin IP'}</div>
            </div>

            <div className="audit-json-grid">
              <section>
                <h3>Valores anteriores</h3>
                <pre>{formatJsonBlock(selected.valoresAnteriores)}</pre>
              </section>
              <section>
                <h3>Valores nuevos</h3>
                <pre>{formatJsonBlock(selected.valoresNuevos)}</pre>
              </section>
            </div>

            {loadingDetalle ? <p>Cargando detalle...</p> : null}
          </div>
        ) : null}
      </OverlayModal>
    </div>
  );
};

export default AuditoriaPage;
