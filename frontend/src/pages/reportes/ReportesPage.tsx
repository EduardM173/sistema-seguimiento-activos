import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Boxes, CheckCircle2, RefreshCw } from 'lucide-react';
import { Alert, Button, Card, LoadingSpinner } from '../../components/common';
import { reportesService } from '../../services/reportes.service';
import type { ReporteInventarioGeneral } from '../../types/reportes.types';
import '../../styles/modules.css';

const emptyReport: ReporteInventarioGeneral = {
  generatedAt: '',
  assets: {
    total: 0,
    byStatus: [],
  },
  materials: {
    total: 0,
    lowStock: 0,
  },
  downloadReady: false,
};

export const ReportesPage: React.FC = () => {
  const [report, setReport] = useState<ReporteInventarioGeneral>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const generatedAt = useMemo(() => {
    if (!report.generatedAt) return 'Sin consulta';

    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(report.generatedAt));
  }, [report.generatedAt]);

  useEffect(() => {
    cargarReporte();
  }, []);

  const cargarReporte = async () => {
    try {
      setLoading(true);
      const data = await reportesService.obtenerInventarioGeneral();
      setReport(data);
      setMessage(null);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'No se pudo consultar el reporte general del inventario',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Reporte general del inventario</h1>
          <p>Consulta actualizada: {generatedAt}</p>
        </div>
        <Button
          label="Actualizar"
          variant="primary"
          onClick={cargarReporte}
          isLoading={loading}
          icon={<RefreshCw size={16} />}
        />
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

      <style>{`
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

        .report-card-icon-assets { background: #2563eb; }
        .report-card-icon-materials { background: #059669; }
        .report-card-icon-alert { background: #d97706; }
        .report-card-icon-ready { background: #475569; }

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
      `}</style>
    </div>
  );
};

export default ReportesPage;
