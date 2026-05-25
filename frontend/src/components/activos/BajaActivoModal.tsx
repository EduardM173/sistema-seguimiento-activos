import React, { useState } from 'react';
import { activosService } from '../../services/activos.service';
import type { Activo } from '../../types/activos.types';
import OverlayModal from '../common/OverlayModal';

interface BajaActivoModalProps {
  isOpen: boolean;
  activo: Activo | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BajaActivoModal: React.FC<BajaActivoModalProps> = ({
  isOpen,
  activo,
  onClose,
  onSuccess,
}) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      alert('El motivo de baja es obligatorio');
      return;
    }

    setLoading(true);
    try {
      await activosService.darDeBaja(activo!.id, motivo.trim());
      alert('Activo dado de baja exitosamente');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al dar de baja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayModal
      open={isOpen && !!activo}
      onClose={onClose}
      title="Dar de baja"
      subtitle={activo?.nombre ?? ''}
      disabled={loading}
      width="460px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Motivo del retiro <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          style={{
            width: '100%',
            padding: '10px 12px',
            border: 'var(--input-border)',
            borderRadius: 'var(--input-radius)',
            minHeight: '100px',
            background: 'var(--input-bg)',
            color: 'var(--color-text-bright)',
            fontFamily: 'var(--font-family)',
            fontSize: '0.9rem',
            resize: 'vertical',
            boxSizing: 'border-box',
            transition: 'border-color var(--transition-base)',
          }}
          placeholder="Ej: Equipo obsoleto, dañado, robado..."
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          disabled={loading}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => void handleSubmit()}
          disabled={loading || !motivo.trim()}
        >
          {loading ? 'Procesando...' : 'Confirmar baja'}
        </button>
      </div>
    </OverlayModal>
  );
};
