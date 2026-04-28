import React, { useState } from 'react';
import { activosService } from '../../services/activos.service';
import type { Activo } from '../../types/activos.types';

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

  if (!isOpen || !activo) return null;

  const handleSubmit = async () => {
    if (!motivo.trim()) {
      alert('El motivo de baja es obligatorio');
      return;
    }

    setLoading(true);
    try {
      await activosService.darDeBaja(activo.id, motivo.trim());
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '400px',
        maxWidth: '90%'
      }} onClick={e => e.stopPropagation()}>
        <h3>Dar de baja: {activo.nombre}</h3>
        
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Motivo del retiro <span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              minHeight: '100px'
            }}
            placeholder="Ej: Equipo obsoleto, dañado, robado..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            disabled={loading}
          />
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            style={{ padding: '8px 16px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            onClick={handleSubmit}
            disabled={loading || !motivo.trim()}
          >
            {loading ? 'Procesando...' : 'Confirmar baja'}
          </button>
        </div>
      </div>
    </div>
  );
};