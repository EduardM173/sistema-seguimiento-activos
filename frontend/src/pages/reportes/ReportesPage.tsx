import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, LoadingSpinner } from '../../components/common';
import type { ReporteGenerado } from '../../types/reportes.types';
import { tipoReporte } from '../../types/reportes.types';
import { reportesService } from '../../services/reportes.service';
import '../../styles/modules.css';

export const ReportesPage: React.FC = () => {
  const [reportes, setReportes] = useState<ReporteGenerado[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generando, setGenerando] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoReporte>(TipoReporte.INVENTARIO_GENERAL);

  useEffect(() => {
    cargarReportes();
  }, []);

  const cargarReportes = async () => {
    try {
      setLoading(true);
      const resultado = await reportesService.obtenerTodos();
      setReportes(resultado.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al cargar reportes' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarReporte = async () => {
    try {
      setGenerando(true);
      const nuevoReporte = await reportesService.generar({
        tipo: tipoSeleccionado,
        formato: 'pdf',
      });
      setReportes([nuevoReporte, ...reportes]);
      setMessage({ type: 'success', text: 'Reporte generado exitosamente' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al generar reporte' });
      console.error(err);
    } finally {
      setGenerando(false);
    }
  };

  const handleDescargar = async (reporteId: string) => {
    try {
      const blob = await reportesService.descargar(reporteId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${reporteId}.pdf`;
      a.click();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al descargar reporte' });
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>Generador de Reportes</h1>
      </div>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
          dismissible
          onClose={() => setMessage(null)}
        />
      )}

      {/* Generador de reportes */}
      <Card title="Generar Nuevo Reporte" padding="lg" className="reporte-generator">
        <div className="form-group">
          <label>Tipo de Reporte:</label>
          <select
            value={tipoSeleccionado}
            onChange={(e) => setTipoSeleccionado(e.target.value as TipoReporte)}
          >
            <option value={TipoReporte.INVENTARIO_GENERAL}>Inventario General</option>
            <option value={TipoReporte.DISPERSION_ACTIVOS}>Dispersión de Activos</option>
            <option value={TipoReporte.MANTENIMIENTO_CRITICO}>Mantenimiento Crítico</option>
            <option value={TipoReporte.ACTIVOS_POR_SEDE}>Activos por Sede</option>
            <option value={TipoReporte.VALOR_ACTIVOS}>Valor de Activos</option>
            <option value={TipoReporte.MOVIMIENTOS_ACTIVOS}>Movimientos de Activos</option>
            <option value={TipoReporte.INVENTARIO_MATERIALES}>Inventario de Materiales</option>
            <option value={TipoReporte.USUARIOS_PERMISOS}>Usuarios y Permisos</option>
            <option value={TipoReporte.TRANSFERENCIAS}>Transferencias</option>
            <option value={TipoReporte.AUDITORIA_SISTEMA}>Auditoría del Sistema</option>
          </select>
        </div>

        <Button
          label="Generar Reporte"
          variant="primary"
          onClick={handleGenerarReporte}
          isLoading={generando}
        />
      </Card>

      {/* Historial de reportes */}
      <Card title="Reportes Generados" padding="lg">
        {loading ? (
          <LoadingSpinner />
        ) : reportes.length === 0 ? (
          <p>No hay reportes generados aún</p>
        ) : (
          <div className="reportes-list">
            {reportes.map((reporte) => (
              <div key={reporte.id} className="reporte-card">
                <div className="reporte-info">
                  <h4>{reporte.nombre}</h4>
                  <p className="reporte-tipo">{reporte.tipo}</p>
                  <p className="reporte-fecha">
                    Generado: {new Date(reporte.fechaGeneracion).toLocaleDateString('es-ES')}
                  </p>
                  <span className={`reporte-estado estado-${reporte.estado}`}>
                    {reporte.estado.toUpperCase()}
                  </span>
                </div>
                <div className="reporte-actions">
                  {reporte.estado === 'completado' && (
                    <Button
                      label="Descargar"
                      variant="primary"
                      size="sm"
                      onClick={() => handleDescargar(reporte.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <style>{` .reporte-generator {
        margin-bottom: 24px;
      }

      .reportes-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 16px;
      }

      .reporte-card {
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .reporte-info h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
      }

      .reporte-tipo {
        color: #0056b3;
        margin: 4px 0;
        font-size: 12px;
      }

      .reporte-fecha {
        color: #999;
        margin: 4px 0;
        font-size: 12px;
      }

      .reporte-estado {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .reporte-estado.estado-completado {
        background-color: #d4edda;
        color: #155724;
      }

      .reporte-estado.estado-generando {
        background-color: #fff3cd;
        color: #856404;
      }

      .reporte-estado.estado-error {
        background-color: #f8d7da;
        color: #721c24;
      }
      `}</style>
    </div>
  );
};

export default ReportesPage;
