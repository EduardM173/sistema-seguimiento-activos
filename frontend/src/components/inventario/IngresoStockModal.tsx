import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { useNotification } from '../../context/NotificationContext';

interface IngresoStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiales: Material[];
  onSuccess: () => Promise<void> | void;
}

const IngresoStockModal: React.FC<IngresoStockModalProps> = ({
  isOpen,
  onClose,
  materiales,
  onSuccess,
}) => {
  const notify = useNotification();
  const [materialId, setMaterialId] = useState('');
  const [cantidad, setCantidad] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMaterialId('');
      setCantidad(0);
    }
  }, [isOpen]);

  const materialSeleccionado = useMemo(
    () => materiales.find((m) => String(m.id) === materialId) || null,
    [materiales, materialId]
  );

  const nuevoStock = materialSeleccionado
    ? Number(materialSeleccionado.stockActual) + Number(cantidad || 0)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialId) {
      notify.error('Error', 'Debe seleccionar un material');
      return;
    }

    if (!cantidad || cantidad <= 0) {
      notify.error('Error', 'La cantidad a ingresar debe ser mayor a 0');
      return;
    }

    try {
      setGuardando(true);
      await inventarioService.aumentarStock(materialId, cantidad);
      notify.success('Stock actualizado correctamente');
      await onSuccess();
      onClose();
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudo actualizar el stock');
    } finally {
      setGuardando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: '700px',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '22px 24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#1f2937' }}>
            Registrar ingreso de stock
          </h2>

          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '26px',
              cursor: 'pointer',
              color: '#6b7280',
            }}
            title="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '18px',
            }}
          >
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Material *
              </label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              >
                <option value="">Seleccionar material</option>
                {materiales.map((material) => (
                  <option key={material.id} value={String(material.id)}>
                    {material.codigo} - {material.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Stock actual
              </label>
              <input
                type="number"
                value={materialSeleccionado?.stockActual ?? 0}
                readOnly
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: '#f9fafb',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Cantidad a ingresar *
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                Nuevo stock
              </label>
              <input
                type="number"
                value={nuevoStock}
                readOnly
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: '#f0fdf4',
                  color: '#166534',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: '24px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <Button label="Cancelar" variant="secondary" onClick={onClose} />
            <Button
              label={guardando ? 'Guardando...' : 'Registrar ingreso'}
              variant="primary"
              type="submit"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default IngresoStockModal;