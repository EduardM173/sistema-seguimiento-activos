import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { asignacionesService } from '../../services/asignaciones.service';
import { useNotification } from '../../context/NotificationContext';
import type { AsignacionActivo } from '../../types/asignaciones.types';

interface ModalRechazarRecepcionProps {
  isOpen: boolean;
  asignacion: AsignacionActivo | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ModalRechazarRecepcion: React.FC<ModalRechazarRecepcionProps> = ({
  isOpen,
  asignacion,
  onClose,
  onConfirm,
}) => {
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const notify = useNotification();

  const motivosDisponibles = [
    { value: 'DETERIORO', label: 'Activo en mal estado / Deteriorado' },
    { value: 'INCOMPLETO', label: 'Activo incompleto (faltan accesorios)' },
    { value: 'NO_CORRESPONDE', label: 'No corresponde al área solicitada' },
    { value: 'DOCUMENTACION', label: 'Falta documentación' },
    { value: 'OTRO', label: 'Otro motivo' },
  ];

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      setError('Debe seleccionar un motivo para el rechazo');
      return;
    }

    if (!asignacion) return;

    setLoading(true);
    setError('');

    try {
      await asignacionesService.rechazarRecepcion(asignacion.id, {
        motivo,
        observaciones: observaciones || undefined,
      });
      notify.success(
        'Rechazo registrado',
        `El rechazo del activo "${asignacion.activo?.nombre}" ha sido registrado correctamente.`
      );
      onConfirm();
      setMotivo('');
      setObservaciones('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al rechazar la recepción');
      notify.error('Error', err?.message || 'No se pudo rechazar la recepción');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMotivo('');
    setObservaciones('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Rechazar Recepción de Activo"
      onClose={handleClose}
      size="md"
      loading={loading}
    >
      <div style={{ padding: '16px' }}>
        <p style={{ marginBottom: '16px' }}>
          ¿Está seguro de que desea <strong style={{ color: '#dc2626' }}>RECHAZAR</strong> la recepción del activo?
        </p>
        
        <div style={{ 
          background: '#f3f4f6', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '16px' 
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{asignacion?.activo?.nombre}</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
            Código: {asignacion?.activo?.codigoActivo}
          </p>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="motivo" style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            Motivo del rechazo *
          </label>
          <select
            id="motivo"
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setError('');
            }}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: error ? '2px solid #dc2626' : '1px solid #d1d5db',
              fontSize: '14px',
            }}
          >
            <option value="">Seleccione un motivo...</option>
            {motivosDisponibles.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && (
            <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              ⚠️ {error}
            </span>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="observaciones" style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            Observaciones adicionales (opcional)
          </label>
          <textarea
            id="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Describa con más detalle el motivo del rechazo..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
        </div>

        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <Button label="Cancelar" variant="secondary" onClick={handleClose} disabled={loading} />
          <Button label="Confirmar Rechazo" variant="danger" onClick={handleSubmit} isLoading={loading} />
        </div>
      </div>
    </Modal>
  );
};

export default ModalRechazarRecepcion;