import React, { useState } from 'react';
import { Modal, Button } from '../common';
import { asignacionesService } from '../../services/asignaciones.service';
import { useNotification } from '../../context/NotificationContext';
import type { AsignacionActivo } from '../../types/asignaciones.types';

interface ModalConfirmarRecepcionProps {
  isOpen: boolean;
  asignacion: AsignacionActivo | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const ModalConfirmarRecepcion: React.FC<ModalConfirmarRecepcionProps> = ({
  isOpen,
  asignacion,
  onClose,
  onConfirm,
}) => {
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const notify = useNotification();

  const handleSubmit = async () => {
    if (!asignacion) return;

    setLoading(true);

    try {
      await asignacionesService.confirmarRecepcion(asignacion.id, {
        observaciones: observaciones || undefined,
      });
      notify.success(
        'Recepción confirmada',
        `El activo "${asignacion.activo?.nombre}" ha sido recibido correctamente.`
      );
      onConfirm();
      setObservaciones('');
      onClose();
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudo confirmar la recepción');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Confirmar Recepción de Activo"
      onClose={onClose}
      size="md"
      loading={loading}
    >
      <div style={{ padding: '16px' }}>
        <p style={{ marginBottom: '16px' }}>
          ¿Está seguro de que desea <strong style={{ color: '#10b981' }}>CONFIRMAR</strong> la recepción del siguiente activo?
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
          <label htmlFor="observaciones" style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            Observaciones (opcional)
          </label>
          <textarea
            id="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas sobre el estado del activo al momento de la recepción..."
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
          <Button label="Cancelar" variant="secondary" onClick={onClose} disabled={loading} />
          <Button label="Confirmar Recepción" variant="primary" onClick={handleSubmit} isLoading={loading} />
        </div>
      </div>
    </Modal>
  );
};

export default ModalConfirmarRecepcion;