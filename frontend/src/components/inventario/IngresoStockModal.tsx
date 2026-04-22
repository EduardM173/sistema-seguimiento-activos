import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common';
import OverlayModal from '../common/OverlayModal';
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
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMaterialId('');
      setCantidad('');
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

    const cantidadNumerica = Number(cantidad);

    if (!cantidad || cantidadNumerica <= 0) {
      notify.error('Error', 'La cantidad a ingresar debe ser mayor a 0');
      return;
    }

    try {
      setGuardando(true);
      const response = await inventarioService.aumentarStock(materialId, cantidadNumerica);
      notify.success(response.message || response.data?.message || 'Stock actualizado correctamente');
      await onSuccess();
      onClose();
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudo actualizar el stock');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <OverlayModal
      open={isOpen}
      onClose={onClose}
      title="Registrar ingreso de stock"
      width="700px"
      disabled={guardando}
    >
      <form onSubmit={handleSubmit}>
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
                disabled={guardando}
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
                onChange={(e) => setCantidad(e.target.value)}
                disabled={guardando}
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

          <div className="overlayModal__footer">
            <Button label="Cancelar" variant="secondary" onClick={onClose} disabled={guardando} />
            <Button
              label={guardando ? 'Guardando...' : 'Registrar ingreso'}
              variant="primary"
              type="submit"
              disabled={guardando || !materialId || Number(cantidad) <= 0}
            />
          </div>
        </form>
    </OverlayModal>
  );
};

export default IngresoStockModal;
