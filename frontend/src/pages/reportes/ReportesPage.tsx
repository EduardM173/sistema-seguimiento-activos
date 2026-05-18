import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  User,
} from 'lucide-react';
import { Alert, Badge, Button, Card, LoadingSpinner, Select } from '../../components/common';
import type { SelectOption } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { reportesService } from '../../services/reportes.service';
import type {
  ReporteInventarioGeneral,
  ReporteCategoria,
  ReporteCategoriaDetalle,
  ActivoDetalleCategoria,
  ReporteResponsable,
  ReporteResponsableDetalle,
  ActivoDetalleResponsable,
} from '../../types/reportes.types';
import '../../styles/modules.css';

// ─── Estado vacío inicial ────────────────────────────────────────────────────

const emptyReport: ReporteInventarioGeneral = {
  generatedAt: '',
  assets: { total: 0, byStatus: [] },
  materials: { total: 0, lowStock: 0 },
  downloadReady: false,
};

const emptyCategoryReport: ReporteCategoria = {
  generatedAt: '',
  totalAssets: 0,
  categories: [],
  downloadReady: false,
};

const emptyResponsableReport: ReporteResponsable = {
  generatedAt: '',
  totalAssets: 0,
  responsables: [],
  downloadReady: false,
};

// ─── Badge de estado de activo ───────────────────────────────────────────────

function estadoVariant(
  estado: string,
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (estado === 'OPERATIVO') return 'success';
  if (estado === 'MANTENIMIENTO') return 'warning';
  if (estado === 'FUERA_DE_SERVICIO') return 'danger';
  return 'secondary';
}

// ─── Componente principal ────────────────────────────────────────────────────

export const ReportesPage: React.FC = () => {
  const { user } = useAuth();

  // ── Reporte general (HU27) ────────────────────────────────────────────────
  const [report, setReport] = useState<ReporteInventarioGeneral>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Reporte por categoría (HU28) ──────────────────────────────────────────
  const [categoryReport, setCategoryReport] = useState<ReporteCategoria>(emptyCategoryReport);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryDetail, setCategoryDetail] = useState<ReporteCategoriaDetalle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [downloadingCategoryFormat, setDownloadingCategoryFormat] = useState<'pdf' | 'excel' | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Reporte por responsable (HU47) ────────────────────────────────────────
  const [responsableReport, setResponsableReport] = useState<ReporteResponsable>(emptyResponsableReport);
  const [loadingResponsables, setLoadingResponsables] = useState(true);

  const [selectedResponsableId, setSelectedResponsableId] = useState('');
  const [responsableDetail, setResponsableDetail] = useState<ReporteResponsableDetalle | null>(null);
  const [loadingResponsableDetail, setLoadingResponsableDetail] = useState(false);

  const [downloadingResponsableFormat, setDownloadingResponsableFormat] = useState<'pdf' | 'excel' | null>(null);
  const [responsableMessage, setResponsableMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Fechas formateadas ────────────────────────────────────────────────────

  const generatedAt = useMemo(() => {
    if (!report.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(report.generatedAt));
  }, [report.generatedAt]);

  const generatedAtCategory = useMemo(() => {
    if (!categoryReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(categoryReport.generatedAt));
  }, [categoryReport.generatedAt]);

  const generatedAtResponsable = useMemo(() => {
    if (!responsableReport.generatedAt) return 'Sin consulta';
    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(responsableReport.generatedAt));
  }, [responsableReport.generatedAt]);

  // ── Opciones del selector de categoría ───────────────────────────────────

  const categoryOptions: SelectOption[] = useMemo(
    () =>
      categoryReport.categories.map((c) => ({
        value: c.id,
        label: `${c.name} (${c.total})`,
      })),
    [categoryReport.categories],
  );

  // ── Opciones del selector de responsable (PROSIN-487) ────────────────────

  const responsableOptions: SelectOption[] = useMemo(
    () =>
      responsableReport.responsables.map((r) => ({
        value: r.id,
        label: `${r.nombreCompleto} (${r.total})`,
      })),
    [responsableReport.responsables],
  );

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    cargarReporte();
    cargarReporteCategoria();
    cargarReporteResponsable();
  }, []);

  // ── Al cambiar la categoría seleccionada, carga el detalle ────────────────

  useEffect(() => {
    if (!selectedCategoryId) {
      setCategoryDetail(null);
      return;
    }
    cargarDetalleCategoria(selectedCategoryId);
  }, [selectedCategoryId]);

  // ── Al cambiar el responsable seleccionado, carga el detalle (PA2) ────────

  useEffect(() => {
    if (!selectedResponsableId) {
      setResponsableDetail(null);
      return;
    }
    cargarDetalleResponsable(selectedResponsableId);
  }, [selectedResponsableId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte general (HU27)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporte = async () => {
    try {
      setLoading(true);
      const data = await reportesService.obtenerInventarioGeneral();
      setReport(data);
      setMessage(null);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte general del inventario',
      });
    } finally {
      setLoading(false);
    }
  };

  const descargarReporte = async (formato: 'pdf' | 'excel') => {
    try {
      setDownloadingFormat(formato);
      await reportesService.descargarInventarioGeneral(formato, user?.id);
      setMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo descargar el reporte consultado',
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte por categoría (HU28)
  // ═══════════════════════════════════════════════════════════════════════════

  const cargarReporteCategoria = async () => {
    try {
      setLoadingCategories(true);
      const data = await reportesService.obtenerReporteCategoria();
      setCategoryReport(data);
      setCategoryMessage(null);
    } catch (err) {
      setCategoryMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte por categoria',
      });
    } finally {
      setLoadingCategories(false);
    }
  };

  // PA2 / PA3 / PA4 / PA5 — Carga activos de la categoría seleccionada
  const cargarDetalleCategoria = async (categoryId: string) => {
    try {
      setLoadingDetail(true);
      setCategoryDetail(null);
      const data = await reportesService.obtenerActivosPorCategoria(categoryId);
      setCategoryDetail(data);
    } catch (err) {
      setCategoryMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el detalle de la categoria',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const descargarReporteCategoria = async (formato: 'pdf' | 'excel') => {
    try {
      setDownloadingCategoryFormat(formato);
      await reportesService.descargarReporteCategoria(formato, user?.id);
      setCategoryMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setCategoryMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo descargar el reporte por categoria',
      });
    } finally {
      setDownloadingCategoryFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Acciones — Reporte por responsable (HU47)
  // ═══════════════════════════════════════════════════════════════════════════

  // PROSIN-490 / PA1 — Carga resumen agrupado por responsable
  const cargarReporteResponsable = async () => {
    try {
      setLoadingResponsables(true);
      const data = await reportesService.obtenerReporteResponsable();
      setResponsableReport(data);
      setResponsableMessage(null);
    } catch (err) {
      setResponsableMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el reporte por responsable',
      });
    } finally {
      setLoadingResponsables(false);
    }
  };

  // PA2 / PA3 / PA4 / PA5 — Carga activos del responsable seleccionado
  const cargarDetalleResponsable = async (responsableId: string) => {
    try {
      setLoadingResponsableDetail(true);
      setResponsableDetail(null);
      const data = await reportesService.obtenerActivosPorResponsable(responsableId);
      setResponsableDetail(data);
    } catch (err) {
      setResponsableMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo consultar el detalle del responsable',
      });
    } finally {
      setLoadingResponsableDetail(false);
    }
  };

  const descargarReporteResponsable = async (formato: 'pdf' | 'excel') => {
    try {
      setDownloadingResponsableFormat(formato);
      await reportesService.descargarReporteResponsable(formato, user?.id);
      setResponsableMessage({ type: 'success', text: 'El archivo quedo disponible para descarga' });
    } catch (err) {
      setResponsableMessage({
        type: 'error',
        text: err instanceof Error
          ? err.message
          : 'No se pudo descargar el reporte por responsable',
      });
    } finally {
      setDownloadingResponsableFormat(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="module-page">

      {/* ════════════════════════════════════════════════════════════════════
          HU27 — Reporte general del inventario
      ════════════════════════════════════════════════════════════════════ */}

      <div className="module-header">
        <div>
          <h1>Reporte general del inventario</h1>
          <p>Consulta actualizada: {generatedAt}</p>
        </div>
        <div className="report-header-actions">
          <Button
            label="Actualizar"
            variant="primary"
            onClick={cargarReporte}
            isLoading={loading}
            icon={<RefreshCw size={16} />}
          />
          <Button
            label="PDF"
            variant="secondary"
            onClick={() => descargarReporte('pdf')}
            disabled={loading}
            isLoading={downloadingFormat === 'pdf'}
            icon={<Download size={16} />}
          />
          <Button
            label="Excel"
            variant="secondary"
            onClick={() => descargarReporte('excel')}
            disabled={loading}
            isLoading={downloadingFormat === 'excel'}
            icon={<FileSpreadsheet size={16} />}
          />
        </div>
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <section className="report-summary-grid">
            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-assets">
                <Boxes size={22} />
              </div>
              <span className="report-card-label">Activos registrados</span>
              <strong>{report.assets.total}</strong>
            </Card>

            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-materials">
                <Archive size={22} />
              </div>
              <span className="report-card-label">Materiales registrados</span>
              <strong>{report.materials.total}</strong>
            </Card>

            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-alert">
                <AlertTriangle size={22} />
              </div>
              <span className="report-card-label">Materiales con stock bajo</span>
              <strong>{report.materials.lowStock}</strong>
            </Card>

            <Card padding="lg" className="report-summary-card">
              <div className="report-card-icon report-card-icon-ready">
                <CheckCircle2 size={22} />
              </div>
              <span className="report-card-label">Respuesta para descarga</span>
              <strong>{report.downloadReady ? 'Lista' : 'Pendiente'}</strong>
            </Card>
          </section>

          <Card title="Activos por estado" padding="lg">
            <div className="report-status-grid">
              {report.assets.byStatus.map((item) => (
                <div key={item.status} className="report-status-row">
                  <span>{item.label}</span>
                  <strong>{item.quantity}</strong>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          HU28 — Reporte por categoría de activos
      ════════════════════════════════════════════════════════════════════ */}

      <div className="module-header rp__section-header">
        <div>
          <h1>Reporte por categoria de activos</h1>
          <p>Consulta actualizada: {generatedAtCategory}</p>
        </div>
        <div className="report-header-actions">
          <Button
            label="Actualizar"
            variant="primary"
            onClick={cargarReporteCategoria}
            isLoading={loadingCategories}
            icon={<RefreshCw size={16} />}
          />
          <Button
            label="PDF"
            variant="secondary"
            onClick={() => descargarReporteCategoria('pdf')}
            disabled={loadingCategories || !categoryReport.downloadReady}
            isLoading={downloadingCategoryFormat === 'pdf'}
            icon={<Download size={16} />}
          />
          <Button
            label="Excel"
            variant="secondary"
            onClick={() => descargarReporteCategoria('excel')}
            disabled={loadingCategories || !categoryReport.downloadReady}
            isLoading={downloadingCategoryFormat === 'excel'}
            icon={<FileSpreadsheet size={16} />}
          />
        </div>
      </div>

      {categoryMessage && (
        <Alert
          type={categoryMessage.type}
          message={categoryMessage.text}
          dismissible
          onClose={() => setCategoryMessage(null)}
        />
      )}

      {loadingCategories ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* PA1 — Cantidad de activos por cada categoría registrada */}
          <Card title="Activos por categoria" padding="lg">
            {categoryReport.categories.length === 0 ? (
              <p className="rp__empty-state">No existen categorias registradas en el sistema</p>
            ) : (
              <div className="rp__category-grid">
                {categoryReport.categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`rp__category-card ${selectedCategoryId === cat.id ? 'rp__category-card--active' : ''}`}
                    onClick={() =>
                      setSelectedCategoryId(selectedCategoryId === cat.id ? '' : cat.id)
                    }
                  >
                    <div className="rp__category-card-icon">
                      <Layers size={18} />
                    </div>
                    <div className="rp__category-card-body">
                      <span className="rp__category-card-name">{cat.name}</span>
                      <strong className="rp__category-card-count">{cat.total}</strong>
                      <span className="rp__category-card-pct">{cat.percentage}%</span>
                    </div>
                    <ChevronRight
                      size={14}
                      className={`rp__category-card-arrow ${selectedCategoryId === cat.id ? 'rp__category-card-arrow--active' : ''}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Selector de categoría + detalle (PA2 / PA3 / PA4 / PA5) */}
          <Card
            title={
              selectedCategoryId
                ? `Activos de: ${categoryReport.categories.find((c) => c.id === selectedCategoryId)?.name ?? ''}`
                : 'Detalle de activos por categoria'
            }
            padding="lg"
          >
            <div className="rp__selector-row">
              <span className="rp__selector-label">Seleccionar categoria:</span>
              {/* PROSIN-439 — Selector de categoría */}
              <Select
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                options={categoryOptions}
                placeholder="Todas las categorias"
                className="rp__category-select"
              />
            </div>

            {/* Sin selección */}
            {!selectedCategoryId && (
              <p className="rp__empty-state">
                Selecciona una categoria para ver el detalle de sus activos
              </p>
            )}

            {/* Cargando detalle */}
            {selectedCategoryId && loadingDetail && <LoadingSpinner />}

            {/* PA5 — Categoría sin activos */}
            {selectedCategoryId && !loadingDetail && categoryDetail && categoryDetail.total === 0 && (
              <p className="rp__empty-state rp__empty-state--category">
                No existen activos registrados en esta categoria
              </p>
            )}

            {/* PA2 / PA3 / PA4 — Tabla de activos de la categoría seleccionada */}
            {selectedCategoryId && !loadingDetail && categoryDetail && categoryDetail.total > 0 && (
              <div className="rp__detail-table-wrap">
                <table className="rp__detail-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Ubicacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryDetail.assets.map((activo: ActivoDetalleCategoria) => (
                      <tr key={activo.id}>
                        <td className="rp__td-code">{activo.codigo}</td>
                        <td>{activo.nombre}</td>
                        <td>
                          <Badge
                            label={activo.estadoLabel}
                            variant={estadoVariant(activo.estado)}
                            size="sm"
                          />
                        </td>
                        <td className="rp__td-location">{activo.ubicacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="rp__detail-total">
                  Total: <strong>{categoryDetail.total}</strong>{' '}
                  {categoryDetail.total === 1 ? 'activo' : 'activos'}
                </p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          HU47 — Reporte por responsable de activos
          PROSIN-486 — Vista de reporte por responsable actual
      ════════════════════════════════════════════════════════════════════ */}

      <div className="module-header rp__section-header">
        <div>
          <h1>Reporte por responsable de activos</h1>
          <p>Consulta actualizada: {generatedAtResponsable}</p>
        </div>
        <div className="report-header-actions">
          <Button
            label="Actualizar"
            variant="primary"
            onClick={cargarReporteResponsable}
            isLoading={loadingResponsables}
            icon={<RefreshCw size={16} />}
          />
          <Button
            label="PDF"
            variant="secondary"
            onClick={() => descargarReporteResponsable('pdf')}
            disabled={loadingResponsables || !responsableReport.downloadReady}
            isLoading={downloadingResponsableFormat === 'pdf'}
            icon={<Download size={16} />}
          />
          <Button
            label="Excel"
            variant="secondary"
            onClick={() => descargarReporteResponsable('excel')}
            disabled={loadingResponsables || !responsableReport.downloadReady}
            isLoading={downloadingResponsableFormat === 'excel'}
            icon={<FileSpreadsheet size={16} />}
          />
        </div>
      </div>

      {responsableMessage && (
        <Alert
          type={responsableMessage.type}
          message={responsableMessage.text}
          dismissible
          onClose={() => setResponsableMessage(null)}
        />
      )}

      {loadingResponsables ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* PROSIN-488 / PA1 — Cantidad de activos por cada responsable registrado */}
          <Card title="Activos por responsable" padding="lg">
            {responsableReport.responsables.length === 0 ? (
              <p className="rp__empty-state">
                No existen responsables con activos asignados en el sistema
              </p>
            ) : (
              <div className="rp__category-grid">
                {responsableReport.responsables.map((resp) => (
                  <button
                    key={resp.id}
                    className={`rp__category-card ${selectedResponsableId === resp.id ? 'rp__category-card--active' : ''}`}
                    onClick={() =>
                      setSelectedResponsableId(
                        selectedResponsableId === resp.id ? '' : resp.id,
                      )
                    }
                  >
                    <div className="rp__category-card-icon">
                      <User size={18} />
                    </div>
                    <div className="rp__category-card-body">
                      <span className="rp__category-card-name">{resp.nombreCompleto}</span>
                      <strong className="rp__category-card-count">{resp.total}</strong>
                      <span className="rp__category-card-pct">{resp.percentage}%</span>
                    </div>
                    <ChevronRight
                      size={14}
                      className={`rp__category-card-arrow ${selectedResponsableId === resp.id ? 'rp__category-card-arrow--active' : ''}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* PROSIN-487 / PROSIN-489 / PA2 / PA3 / PA4 / PA5 — Selector + detalle */}
          <Card
            title={
              selectedResponsableId
                ? `Activos de: ${responsableReport.responsables.find((r) => r.id === selectedResponsableId)?.nombreCompleto ?? ''}`
                : 'Detalle de activos por responsable'
            }
            padding="lg"
          >
            <div className="rp__selector-row">
              <span className="rp__selector-label">Seleccionar responsable:</span>
              {/* PROSIN-487 — Selector de responsable */}
              <Select
                value={selectedResponsableId}
                onChange={setSelectedResponsableId}
                options={responsableOptions}
                placeholder="Selecciona un responsable"
                className="rp__category-select"
              />
            </div>

            {/* Sin selección */}
            {!selectedResponsableId && (
              <p className="rp__empty-state">
                Selecciona un responsable para ver los activos que tiene asignados
              </p>
            )}

            {/* Cargando detalle */}
            {selectedResponsableId && loadingResponsableDetail && <LoadingSpinner />}

            {/* PA5 — Responsable sin activos asignados */}
            {selectedResponsableId && !loadingResponsableDetail && responsableDetail && responsableDetail.total === 0 && (
              <p className="rp__empty-state rp__empty-state--category">
                No existen activos asignados a este responsable
              </p>
            )}

            {/* PA2 / PA3 / PA4 — Tabla de activos del responsable seleccionado */}
            {selectedResponsableId && !loadingResponsableDetail && responsableDetail && responsableDetail.total > 0 && (
              <div className="rp__detail-table-wrap">
                <table className="rp__detail-table">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Categoria</th>
                      <th>Estado</th>
                      <th>Ubicacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responsableDetail.assets.map((activo: ActivoDetalleResponsable) => (
                      <tr key={activo.id}>
                        <td className="rp__td-code">{activo.codigo}</td>
                        <td>{activo.nombre}</td>
                        <td className="rp__td-location">{activo.categoria}</td>
                        <td>
                          <Badge
                            label={activo.estadoLabel}
                            variant={estadoVariant(activo.estado)}
                            size="sm"
                          />
                        </td>
                        <td className="rp__td-location">{activo.ubicacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="rp__detail-total">
                  Total: <strong>{responsableDetail.total}</strong>{' '}
                  {responsableDetail.total === 1 ? 'activo' : 'activos'}
                </p>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ─── Estilos inline ────────────────────────────────────────────────── */}
      <style>{`
        /* ── Acciones del header ─────────────────────────────────────────── */
        .report-header-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        /* ── Separación entre secciones ─────────────────────────────────── */
        .rp__section-header {
          margin-top: 48px;
        }

        /* ── Cards de métricas (HU27) ───────────────────────────────────── */
        .report-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .report-summary-card .card-content {
          display: grid;
          gap: 10px;
        }

        .report-card-icon {
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #fff;
        }

        .report-card-icon-assets    { background: #2563eb; }
        .report-card-icon-materials { background: #059669; }
        .report-card-icon-alert     { background: #d97706; }
        .report-card-icon-ready     { background: #475569; }

        .report-card-label {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        .report-summary-card strong {
          color: var(--color-text);
          font-size: var(--font-size-2xl);
          line-height: 1;
        }

        /* ── Filas de estado (HU27) ─────────────────────────────────────── */
        .report-status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }

        .report-status-row {
          min-height: 56px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid var(--color-border-light);
          border-radius: 8px;
          background: var(--color-surface);
        }

        .report-status-row span {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        .report-status-row strong {
          color: var(--color-text);
          font-size: var(--font-size-lg);
        }

        /* ── Grid de tarjetas (HU28 / PA1 y HU47 / PA1) ────────────────── */
        .rp__category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }

        .rp__category-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 12px;
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          background: var(--glass-bg);
          cursor: pointer;
          text-align: left;
          transition: border-color 0.15s, background 0.15s;
          width: 100%;
        }

        .rp__category-card:hover {
          border-color: var(--color-primary);
          background: var(--color-primary-muted);
        }

        .rp__category-card--active {
          border-color: var(--color-primary);
          background: var(--color-primary-muted);
        }

        .rp__category-card-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--color-primary-muted);
          color: var(--color-primary-light);
          flex-shrink: 0;
        }

        .rp__category-card-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .rp__category-card-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rp__category-card-count {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-extrabold);
          color: var(--color-text);
          line-height: 1;
        }

        .rp__category-card-pct {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .rp__category-card-arrow {
          color: var(--color-text-secondary);
          flex-shrink: 0;
          transition: transform 0.2s, color 0.2s;
        }

        .rp__category-card-arrow--active {
          transform: rotate(90deg);
          color: var(--color-primary-light);
        }

        /* ── Selector + detalle ─────────────────────────────────────────── */
        .rp__selector-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .rp__selector-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        .rp__category-select {
          min-width: 240px;
        }

        /* ── Estado vacío ────────────────────────────────────────────────── */
        .rp__empty-state {
          padding: 32px 0;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        .rp__empty-state--category {
          padding: 24px 0;
          font-weight: var(--font-weight-semibold);
          color: var(--color-text);
        }

        /* ── Tabla de detalle (PA3) ─────────────────────────────────────── */
        .rp__detail-table-wrap {
          overflow-x: auto;
        }

        .rp__detail-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .rp__detail-table thead tr {
          background: rgba(255, 255, 255, 0.04);
          border-bottom: 1px solid var(--glass-border);
        }

        .rp__detail-table th {
          padding: 10px 14px;
          text-align: left;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          white-space: nowrap;
        }

        .rp__detail-table tbody tr {
          border-bottom: 1px solid var(--glass-border);
          transition: background 0.12s;
        }

        .rp__detail-table tbody tr:last-child {
          border-bottom: none;
        }

        .rp__detail-table tbody tr:hover {
          background: var(--glass-bg-hover);
        }

        .rp__detail-table td {
          padding: 12px 14px;
          color: var(--color-text);
          vertical-align: middle;
        }

        .rp__td-code {
          font-family: monospace;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary) !important;
        }

        .rp__td-location {
          color: var(--color-text-secondary) !important;
        }

        .rp__detail-total {
          margin-top: 14px;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          text-align: right;
        }

        .rp__detail-total strong {
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
};

export default ReportesPage;