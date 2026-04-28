import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common';
import OverlayModal from '../common/OverlayModal';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { useNotification } from '../../context/NotificationContext';

interface SalidaStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiales: Material[];
  onSuccess: () => Promise<void> | void;
}

const SalidaStockModal: React.FC<SalidaStockModalProps> = ({
  isOpen,
  onClose,
  materiales,
  onSuccess,
}) => {
  const notify = useNotification();
  const [materialId, setMaterialId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMaterialId('');
      setCantidad('');
      setMotivo('');
    }
  }, [isOpen]);

  const materialSeleccionado = useMemo(
    () => materiales.find((m) => String(m.id) === materialId) || null,
    [materiales, materialId],
  );

  const cantidadNumerica = Number(cantidad || 0);
  const stockActual = Number(materialSeleccionado?.stockActual ?? 0);
  const stockResultante = materialSeleccionado
    ? Math.max(0, stockActual - cantidadNumerica)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialId) {
      notify.error('Error', 'Debe seleccionar un material');
      return;
    }

    if (!cantidad || !Number.isFinite(cantidadNumerica) || cantidadNumerica <= 0) {
      notify.error('Error', 'La cantidad de salida debe ser mayor a 0');
      return;
    }

    if (!materialSeleccionado) {
      notify.error('Error', 'Material no válido');
      return;
    }

    if (cantidadNumerica > stockActual) {
      notify.error(
        'Error',
        `La cantidad solicitada (${cantidadNumerica}) excede el stock disponible (${stockActual}).`,
      );
      return;
    }

    if (!motivo.trim()) {
      notify.error('Error', 'Debe ingresar el motivo de la salida');
      return;
    }

    try {
      setGuardando(true);
      const response = await inventarioService.registrarSalidaStock(materialId, {
        cantidad: cantidadNumerica,
        motivo: motivo.trim(),
      });
      notify.success(response.message || response.data?.message || 'Salida registrada correctamente');
      await onSuccess();
      onClose();
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudo registrar la salida');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <OverlayModal
      open={isOpen}
      onClose={onClose}
      title="Registrar salida de inventario"
      width="760px"
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
              Stock disponible
            </label>
            <input
              type="number"
              value={stockActual}
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
              Cantidad de salida *
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
              Motivo de salida *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={guardando}
              rows={3}
              placeholder="Ej.: Entrega de insumos a laboratorio"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
              Stock resultante
            </label>
            <input
              type="number"
              value={stockResultante}
              readOnly
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 700,
              }}
            />
          </div>
        </div>

        <div className="overlayModal__footer">
          <Button label="Cancelar" variant="secondary" onClick={onClose} disabled={guardando} />
          <Button
            label={guardando ? 'Guardando...' : 'Registrar salida'}
            variant="primary"
            type="submit"
            disabled={
              guardando ||
              !materialId ||
              !motivo.trim() ||
              !Number.isFinite(cantidadNumerica) ||
              cantidadNumerica <= 0 ||
              cantidadNumerica > stockActual
            }
          />
        </div>
      </form>
    </OverlayModal>
  );
};

export default SalidaStockModal;
