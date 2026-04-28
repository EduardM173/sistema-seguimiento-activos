import React, { useState, useEffect } from 'react';
import { Button, Card, Badge, LoadingSpinner } from '../common';
import type { Activo, MovimientoActivo, EstadoActivo } from '../../types/activos.types';
import { estadoActivoDisplay } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import BajaActivoModal from './BajaActivoModal';
import '../../styles/modules.css';

interface ActivoDetailProps {
  activoId: string;
  onClose: () => void;
  onEdit?: () => void;
  onBajaSuccess?: () => void;
}

export const ActivoDetail: React.FC<ActivoDetailProps> = ({
  activoId,
  onClose,
  onEdit,
  onBajaSuccess,
}) => {
  const [activo, setActivo] = useState<Activo | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoActivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [bajaModalOpen, setBajaModalOpen] = useState(false);

  useEffect(() => {
    cargarDetalles();
  }, [activoId]);

  const cargarDetalles = async () => {
    try {
      setLoading(true);
      const [detalle, hist] = await Promise.all([
        activosService.obtenerPorId(activoId),
        activosService.obtenerHistorial(activoId),
      ]);
      setActivo(detalle);
      setMovimientos(hist);
    } catch (err) {
      console.error('Error al cargar detalles:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: EstadoActivo): any => {
    const colores: Record<EstadoActivo, any> = {
      'OPERATIVO': 'success',
      'MANTENIMIENTO': 'warning',
      'FUERA_DE_SERVICIO': 'danger',
      'DADO_DE_BAJA': 'secondary',
    };
    return colores[estado] || 'secondary';
  };

  const getEstadoDisplay = (estado: EstadoActivo): string => {
    return estadoActivoDisplay[estado] || estado;
  };

  const handleBajaSuccess = () => {
    setBajaModalOpen(false);
    cargarDetalles(); // Recargar datos
    if (onBajaSuccess) onBajaSuccess();
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!activo) {
    return <div>Error al cargar el activo</div>;
  }

  // ========== NUEVO: Verificar si está dado de baja ==========
  const isDadoDeBaja = activo.estado === 'DADO_DE_BAJA';
  // ==========================================================

  return (
    <div className="activo-detail-container">
      <Card padding="lg">
        <div className="detail-header">
          <h2>{activo.nombre}</h2>
          <Badge 
            label={getEstadoDisplay(activo.estado)} 
            variant={getEstadoColor(activo.estado)} 
          />
        </div>

        <div className="detail-grid">
          <div className="detail-section">
            <h3>Información General</h3>
            <div className="detail-row">
              <span className="label">Código:</span>
              <span className="value">{activo.codigoActivo}</span>
            </div>
            <div className="detail-row">
              <span className="label">Marca:</span>
              <span className="value">{activo.marca || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Modelo:</span>
              <span className="value">{activo.modelo || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Número de Serie:</span>
              <span className="value">{activo.numeroDeSerie || 'N/A'}</span>
            </div>
          </div>

          {/* ========== NUEVO: Sección de información de baja (PROSIN-366, PA4) ========== */}
          {isDadoDeBaja && (
            <div className="detail-section" style={{ borderLeft: '4px solid #dc3545', paddingLeft: '16px' }}>
              <h3 style={{ color: '#dc3545' }}>⚠️ Información de Baja</h3>
              <div className="detail-row">
                <span className="label">Fecha de baja:</span>
                <span className="value">
                  {activo.fechaBaja 
                    ? new Date(activo.fechaBaja).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'No registrada'}
                </span>
              </div>
              <div className="detail-row">
                <span className="label">Motivo del retiro:</span>
                <span className="value" style={{ fontStyle: 'italic' }}>
                  {activo.motivoBaja || 'No especificado'}
                </span>
              </div>
            </div>
          )}
          {/* ======================================================================== */}

          <div className="detail-section">
            <h3>Ubicación y Responsable</h3>
            <div className="detail-row">
              <span className="label">Categoria:</span>
              <span className="value">{activo.categoriaActivo?.nombre || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Ubicación:</span>
              <span className="value">{activo.ubicacion?.nombre || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Responsable:</span>
              <span className="value">
                {activo.responsable
                  ? `${activo.responsable.nombres} ${activo.responsable.apellidos}`
                  : 'N/A'}
              </span>
            </div>
          </div>

          <div className="detail-section">
            <h3>Información Financiera</h3>
            <div className="detail-row">
              <span className="label">Valor de Adquisición:</span>
              <span className="value">${activo.valorAdquisicion.toLocaleString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Fecha de Adquisición:</span>
              <span className="value">{new Date(activo.fechaAdquisicion).toLocaleDateString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Proveedor:</span>
              <span className="value">{activo.proveedor || 'N/A'}</span>
            </div>
          </div>
        </div>

        {activo.observaciones && (
          <div className="detail-section">
            <h3>Observaciones</h3>
            <p>{activo.observaciones}</p>
          </div>
        )}

        {movimientos.length > 0 && (
          <div className="detail-section">
            <h3>Historial de Movimientos</h3>
            <div className="movimientos-list">
              {movimientos.map((mov) => (
                <div key={mov.id} className="movimiento-item">
                  <div className="movimiento-date">
                    {new Date(mov.fecha).toLocaleDateString()}
                  </div>
                  <div className="movimiento-content">
                    <p className="movimiento-tipo">{mov.tipo}</p>
                    <p className="movimiento-usuario">
                      {mov.usuario?.nombres} {mov.usuario?.apellidos}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="detail-actions">
          {/* ========== NUEVO: Mostrar botón Dar de baja si no está dado de baja ========== */}
          {onEdit && !isDadoDeBaja && (
            <Button label="Editar" variant="primary" onClick={onEdit} />
          )}
          {!isDadoDeBaja && (
            <Button 
              label="Dar de baja" 
              variant="danger" 
              onClick={() => setBajaModalOpen(true)} 
            />
          )}
          {/* =========================================================================== */}
          <Button label="Cerrar" variant="secondary" onClick={onClose} />
        </div>
      </Card>

      {/* Modal de baja */}
      {activo && (
        <BajaActivoModal
          isOpen={bajaModalOpen}
          activo={activo}
          onClose={() => setBajaModalOpen(false)}
          onSuccess={handleBajaSuccess}
        />
      )}
    </div>
  );
};

export default ActivoDetail;