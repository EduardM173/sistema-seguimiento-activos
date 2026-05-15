import React, { useState, useEffect, useMemo } from 'react';
import { DataTable, SearchBar, Button, Badge, Alert, Select } from '../../components/common';
import type { Column } from '../../components/common/DataTable';
import type {
  Auditoria,
  TrazabilidadActivo,
  TrazabilidadMovimiento,
  TipoMovimientoTrazabilidad,
} from '../../types/auditoria.types';
import type { AssetListItem } from '../../types/assets.types';
import { auditoriaService } from '../../services/auditoria.service';
import { searchAssets } from '../../services/assets.service';
import '../../styles/modules.css';

export const AuditoriaPage: React.FC = () => {
  const [registros, setRegistros] = useState<Auditoria[]>([]);
  const [activos, setActivos] = useState<AssetListItem[]>([]);
  const [activoSearch, setActivoSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [trazabilidad, setTrazabilidad] = useState<TrazabilidadActivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // El backend actual de Auditoría expone la trazabilidad por activo,
    // pero no un listado general en GET /auditoria.
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      cargarActivos(activoSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [activoSearch]);

  useEffect(() => {
    if (!selectedAssetId) {
      setTrazabilidad(null);
      return;
    }

    cargarTrazabilidad(selectedAssetId);
  }, [selectedAssetId]);

  const cargarRegistros = async () => {
    try {
      setLoading(true);
      const resultado = await auditoriaService.obtenerRegistros();
      setRegistros(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar auditoría' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cargarActivos = async (busqueda = '') => {
    try {
      setAssetsLoading(true);
      const resultado = await searchAssets({
        q: busqueda,
        page: 1,
        pageSize: 30,
        sortBy: 'codigo',
        sortType: 'ASC',
      });
      setActivos(resultado.data ?? []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar activos para trazabilidad' });
      console.error(err);
    } finally {
      setAssetsLoading(false);
    }
  };

  const cargarTrazabilidad = async (activoId: string) => {
    try {
      setTraceabilityLoading(true);
      const resultado = await auditoriaService.obtenerTrazabilidadActivo(activoId);
      setTrazabilidad(resultado ?? null);
    } catch (err) {
      setTrazabilidad(null);
      setMessage({ type: 'error', text: 'Error al cargar trazabilidad del activo' });
      console.error(err);
    } finally {
      setTraceabilityLoading(false);
    }
  };

  const getActionColor = (accion: string): any => {
    const colores: Record<string, any> = {
      'crear': 'success',
      'actualizar': 'warning',
      'eliminar': 'danger',
      'descargar': 'info',
      'acceder': 'primary',
      'exportar': 'info',
    };
    return colores[accion] || 'secondary';
  };

  const getResultadoColor = (resultado: string): any => {
    return resultado === 'exitoso' ? 'success' : 'danger';
  };

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

  const assetOptions = useMemo(
    () =>
      activos.map((activo) => ({
        value: activo.id,
        label: `${activo.codigo} - ${activo.nombre}`,
      })),
    [activos],
  );

  const movimientoColumns: Column<TrazabilidadMovimiento>[] = [
    {
      header: 'Tipo de movimiento',
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
      accessor: (row: TrazabilidadMovimiento) => row.areaOrigen?.nombre ?? 'No aplica',
    },
    {
      header: 'Área destino',
      accessor: (row: TrazabilidadMovimiento) => row.areaDestino?.nombre ?? 'No aplica',
    },
    {
      header: 'Usuario relacionado',
      accessor: (row: TrazabilidadMovimiento) =>
        row.realizadoPor?.nombreCompleto ||
        row.usuarioDestino?.nombreCompleto ||
        row.usuarioOrigen?.nombreCompleto ||
        'No registrado',
      render: (_value: string, row: TrazabilidadMovimiento) => (
        <div className="audit-user-cell">
          <strong>
            {row.realizadoPor?.nombreCompleto ||
              row.usuarioDestino?.nombreCompleto ||
              row.usuarioOrigen?.nombreCompleto ||
              'No registrado'}
          </strong>
          {row.usuarioDestino ? <span>Destino: {row.usuarioDestino.nombreCompleto}</span> : null}
          {row.usuarioOrigen ? <span>Origen: {row.usuarioOrigen.nombreCompleto}</span> : null}
        </div>
      ),
    },
  ];

  const columns: Column<Auditoria>[] = [
    {
      header: 'Usuario',
      accessor: (row: Auditoria) => row.usuario ? `${row.usuario.nombres} ${row.usuario.apellidos}` : 'N/A',
    },
    {
      header: 'Acción',
      accessor: 'accion',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getActionColor(value)} size="sm" />
      ),
    },
    { header: 'Módulo', accessor: 'modulo' },
    { header: 'Recurso', accessor: 'recursoTipo' },
    { header: 'Descripción', accessor: 'descripcion' },
    {
      header: 'Resultado',
      accessor: 'resultado',
      render: (value: string) => (
        <Badge label={value.toUpperCase()} variant={getResultadoColor(value)} size="sm" />
      ),
    },
    {
      header: 'Fecha',
      accessor: 'fechaHora',
      render: (value: Date) => formatDateTime(value),
    },
  ];

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Auditoría del Sistema</h1>
          <p>Consulta registros generales y la trazabilidad consolidada de activos.</p>
        </div>
        <Button label="Exportar" variant="secondary" />
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      <div className="module-list audit-traceability">
        <div className="list-header audit-traceability__header">
          <div>
            <h2>Trazabilidad consolidada de activo</h2>
            <p>
              Selecciona un activo para ver sus movimientos registrados, áreas involucradas y
              usuario relacionado.
            </p>
          </div>
          {trazabilidad ? (
            <Badge
              label={`${trazabilidad.resumen.totalMovimientos} movimiento(s)`}
              variant="info"
              size="md"
            />
          ) : null}
        </div>

        <div className="audit-traceability__filters">
          <div className="audit-traceability__search">
            <SearchBar
              onSearch={setActivoSearch}
              placeholder="Buscar activo por código o nombre..."
            />
          </div>
          <div className="audit-traceability__select">
            <Select
              value={selectedAssetId}
              onChange={setSelectedAssetId}
              options={assetOptions}
              placeholder={assetsLoading ? 'Cargando activos...' : 'Seleccionar activo'}
              disabled={assetsLoading}
            />
          </div>
        </div>

        {trazabilidad ? (
          <div className="audit-traceability__summary">
            <div>
              <span>Activo seleccionado</span>
              <strong>
                {trazabilidad.activo.codigo} - {trazabilidad.activo.nombre}
              </strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{trazabilidad.activo.estado}</strong>
            </div>
            <div>
              <span>Área actual</span>
              <strong>{trazabilidad.activo.areaActual?.nombre ?? 'No asignada'}</strong>
            </div>
          </div>
        ) : null}

        <DataTable<TrazabilidadMovimiento>
          columns={movimientoColumns}
          data={trazabilidad?.movimientos ?? []}
          loading={traceabilityLoading}
          emptyMessage={
            selectedAssetId
              ? 'No hay movimientos registrados para este activo'
              : 'Seleccione un activo para consultar su trazabilidad'
          }
          striped
          hover
          paginated
          pageSize={10}
        />
      </div>

      <div className="module-list">
        <div className="list-header">
          <SearchBar
            onSearch={() => {}}
            placeholder="Buscar en auditoría..."
            showFilters
          />
        </div>
        <DataTable<Auditoria>
          columns={columns}
          data={registros}
          loading={loading}
          emptyMessage="No hay registros de auditoría"
          striped
          hover
          paginated
          pageSize={20}
        />
      </div>
    </div>
  );
};

export default AuditoriaPage;
