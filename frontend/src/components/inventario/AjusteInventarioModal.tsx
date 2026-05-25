import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../common';
import OverlayModal from '../common/OverlayModal';
import type { Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { useNotification } from '../../context/NotificationContext';

interface AjusteInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiales: Material[];
  onSuccess: () => Promise<void> | void;
}

const AjusteInventarioModal: React.FC<AjusteInventarioModalProps> = ({
  isOpen,
  onClose,
  materiales,
  onSuccess,
}) => {
  const notify = useNotification();
  const [materialId, setMaterialId] = useState('');
  const [cantidadRegistrada, setCantidadRegistrada] = useState('');
  const [cantidadFisica, setCantidadFisica] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMaterialId('');
      setCantidadRegistrada('');
      setCantidadFisica('');
      setMotivo('');
    }
  }, [isOpen]);

  const materialSeleccionado = useMemo(
    () => materiales.find((m) => String(m.id) === materialId) || null,
    [materiales, materialId],
  );

  useEffect(() => {
    if (materialSeleccionado) {
      setCantidadRegistrada(String(materialSeleccionado.stockActual));
    } else {
      setCantidadRegistrada('');
    }
  }, [materialSeleccionado]);

  const diferencia =
    cantidadFisica !== '' && cantidadRegistrada !== ''
      ? Number(cantidadFisica) - Number(cantidadRegistrada)
      : 0;
  const stockResultante =
    cantidadFisica !== '' && Number.isFinite(Number(cantidadFisica))
      ? Number(cantidadFisica)
      : null;
  const resumenDiferencia =
    cantidadFisica === ''
      ? 'Ingrese la cantidad fisica para calcular la diferencia'
      : diferencia > 0
        ? `Se incrementara el disponible en ${diferencia} unidades`
        : diferencia < 0
          ? `Se reducira el disponible en ${Math.abs(diferencia)} unidades`
          : 'No hay diferencia entre el registro y el conteo fisico';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialId) {
      notify.error('Error', 'Debe seleccionar un material');
      return;
    }

    const registrada = Number(cantidadRegistrada);
    const fisica = Number(cantidadFisica);

    if (!Number.isFinite(registrada) || registrada < 0) {
      notify.error('Error', 'La cantidad registrada debe ser válida');
      return;
    }

    if (!Number.isFinite(fisica) || fisica < 0) {
      notify.error('Error', 'La cantidad física debe ser válida');
      return;
    }

    if (!motivo.trim()) {
      notify.error('Error', 'Debe ingresar un motivo para el ajuste');
      return;
    }

    try {
      setGuardando(true);
      const response = await inventarioService.ajustarStock(materialId, {
        cantidadRegistrada: registrada,
        cantidadFisica: fisica,
        motivo: motivo.trim(),
      });
      notify.success(
        'Ajuste registrado',
        `${materialSeleccionado?.nombre ?? 'El material'} ahora tiene ${fisica} unidades disponibles.`,
      );
      await onSuccess();
      onClose();
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudo registrar el ajuste');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <OverlayModal
      open={isOpen}
      onClose={onClose}
      title="Registrar ajuste de inventario"
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
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Material *
            </label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              disabled={guardando}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: 'var(--input-border)',
                borderRadius: 'var(--radius-base)',
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
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Cantidad registrada *
            </label>
            <input
              type="number"
              min="0"
              value={cantidadRegistrada}
              readOnly
              style={{
                width: '100%',
                padding: '12px 14px',
                border: 'var(--input-border)',
                borderRadius: 'var(--radius-base)',
                background: 'var(--input-bg)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Cantidad física *
            </label>
            <input
              type="number"
              min="0"
              value={cantidadFisica}
              onChange={(e) => setCantidadFisica(e.target.value)}
              disabled={guardando}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: 'var(--input-border)',
                borderRadius: 'var(--radius-base)',
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Motivo del ajuste *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={guardando}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                border: 'var(--input-border)',
                borderRadius: 'var(--radius-base)',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Diferencia detectada
            </label>
            <input
              type="text"
              value={
                cantidadFisica === ''
                  ? 'Ingrese la cantidad física'
                  : `${diferencia > 0 ? '+' : ''}${diferencia}`
              }
              readOnly
              style={{
                width: '100%',
                padding: '12px 14px',
                border: 'var(--input-border)',
                borderRadius: 'var(--radius-base)',
                background: diferencia === 0 ? 'var(--input-bg)' : 'var(--color-warning-light)',
                color: diferencia === 0 ? 'var(--color-text)' : 'var(--color-warning)',
                fontWeight: 700,
              }}
            />
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '13px',
                color: cantidadFisica === '' ? 'var(--color-text-muted)' : diferencia === 0 ? 'var(--color-text)' : 'var(--color-warning)',
              }}
            >
              {resumenDiferencia}
            </p>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
              Cantidad disponible luego del ajuste
            </label>
            <input
              type="text"
              value={stockResultante === null ? 'Pendiente de calcular' : String(stockResultante)}
              readOnly
              style={{
                width: '100%',
                padding: '12px 14px',
                border: 'var(--input-border)',
                borderRadius: 'var(--radius-base)',
                background: 'var(--color-info-light)',
                color: 'var(--color-primary-light)',
                fontWeight: 700,
              }}
            />
          </div>
        </div>

        <div className="overlayModal__footer">
          <Button label="Cancelar" variant="secondary" onClick={onClose} disabled={guardando} />
          <Button
            label={guardando ? 'Guardando...' : 'Registrar ajuste'}
            variant="primary"
            type="submit"
            disabled={
              guardando ||
              !materialId ||
              cantidadFisica === '' ||
              !motivo.trim()
            }
          />
        </div>
      </form>
    </OverlayModal>
  );
};

export default AjusteInventarioModal;
