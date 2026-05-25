import React, { useState, useEffect } from 'react';
import { Button, Modal } from '../common';
import { IconCheck } from '../common/Icon';
import { ImageUploader, type PendingImage } from '../common/ImageUploader';
import { ImageGallery } from '../common/ImageGallery';
import type { Activo } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
import { visionService } from '../../services/vision.service';
import { useNotification } from '../../context/NotificationContext';
import '../../styles/modules.css';

interface ActivoFormProps {
  activo?: Activo;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (activo: Activo) => void;
}

export const ActivoForm: React.FC<ActivoFormProps> = ({
  activo,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<any>({
    codigoActivo: '',
    nombre: '',
    marca: '',
    modelo: '',
    numeroDeSerie: '',
    categoriaActivoId: '',
    estado: '',
    ubicacionId: '',
    responsableId: '',
    valorAdquisicion: 0,
    fechaAdquisicion: new Date().toISOString().split('T')[0],
    proveedor: '',
    observaciones: '',
  });

  const [categorias, setCategorias] = useState<any[]>([]);
  const [ubicaciones, setUbicaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const notify = useNotification();

  const runAiAutofill = async () => {
    if (!pendingImages.length) return;
    setAiLoading(true);
    try {
      const result = await visionService.analyzeImage(pendingImages[0].file);
      const p = result.partial ?? {};
      setFormData((prev: any) => ({
        ...prev,
        ...(p.nombre        ? { nombre:        p.nombre }        : {}),
        ...(p.marca         ? { marca:          p.marca }         : {}),
        ...(p.modelo        ? { modelo:         p.modelo }        : {}),
        ...(p.numeroDeSerie ? { numeroDeSerie:  p.numeroDeSerie } : {}),
      }));
      setAiNote(result.notes || 'Formulario prellenado por el agente de IA. Revisa y ajusta los campos.');
    } catch (err: any) {
      notify.error('Error de análisis', err?.message || 'No se pudo analizar la imagen.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarDatos();
      if (activo) {
        setFormData({
          codigoActivo: activo.codigoActivo || '',
          nombre: activo.nombre || '',
          marca: activo.marca || '',
          modelo: activo.modelo || '',
          numeroDeSerie: activo.numeroDeSerie || '',
          categoriaActivoId: activo.categoriaActivoId || activo.categoriaActivo?.id || '',
          estado: activo.estado || '',
          ubicacionId: activo.ubicacionId || activo.ubicacion?.id || '',
          responsableId: activo.responsableId || '',
          valorAdquisicion: activo.valorAdquisicion || 0,
          fechaAdquisicion: activo.fechaAdquisicion
            ? new Date(activo.fechaAdquisicion).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          proveedor: activo.proveedor || '',
          observaciones: activo.observaciones || '',
        });
      } else {
        setFormData((prev: any) => ({
          ...prev,
          estado: '',
          codigoActivo: '',
          nombre: '',
          categoriaActivoId: '',
          ubicacionId: '',
        }));
      }
      setSubmitAttempted(false);
      setPendingImages([]);
    }
  }, [isOpen, activo]);

  const cargarDatos = async () => {
    try {
      const [cat, ubi] = await Promise.all([
        activosService.obtenerCategorias(),
        activosService.obtenerUbicaciones(),
      ]);
      setCategorias(cat);
      setUbicaciones(ubi);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<any>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'valorAdquisicion' ? parseFloat(value) : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    // VALIDACIÓN ESTRICTA DEL ESTADO
    if (!formData.estado || formData.estado === '') {
      notify.warning('Debe seleccionar un estado para el activo (Operativo, Mantenimiento o Fuera de Servicio)');

      const estadoSelect = document.querySelector('select[name="estado"]') as HTMLElement;
      if (estadoSelect) {
        estadoSelect.focus();
        estadoSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    setLoading(true);

    try {
      let resultado: Activo;
      if (activo) {
        resultado = (await activosService.actualizar(activo.id, formData))!;
      } else {
        resultado = (await activosService.crear(formData))!;
      }

      // Subir imágenes pendientes (en creación o edición)
      if (pendingImages.length > 0) {
        try {
          await activosService.subirImagenes(
            resultado.id,
            pendingImages.map((p) => p.file),
          );
        } catch {
          notify.warning('El activo fue guardado pero ocurrió un error al subir las imágenes.');
        }
      }

      onSubmit(resultado);
      onClose();
    } catch (err) {
      console.error('Error al guardar activo:', err);
      notify.error('Error al guardar el activo');
    } finally {
      setLoading(false);
    }
  };

  const estadoOptions = [
    { value: 'OPERATIVO', label: 'Operativo' },
    { value: 'MANTENIMIENTO', label: 'En mantenimiento' },
    { value: 'FUERA_DE_SERVICIO', label: 'Fuera de servicio' },
    { value: 'DADO_DE_BAJA', label: 'Dado de baja' },
  ];

  const showEstadoError = submitAttempted && !formData.estado;

  return (
    <Modal
      isOpen={isOpen}
      title={activo ? 'Editar Activo' : 'Nuevo Activo'}
      onClose={onClose}
      size="lg"
      loading={loading}
    >
      <form onSubmit={handleSubmit} className="form-container">
        {/* ── Imágenes ── */}
        <div className="form-group form-full">
          <label>Imágenes del activo</label>

          {/* Saved images — visible only in edit mode; upload/delete work immediately */}
          {activo?.id && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Imágenes guardadas
              </p>
              <ImageGallery
                entityId={activo.id}
                onLoad={(id) => activosService.listarImagenes(id)}
                onDelete={(id, imgId) => activosService.eliminarImagen(id, imgId)}
                onUpload={(id, files) => activosService.subirImagenes(id, files)}
              />
            </>
          )}

          {/* Pending images — only in create mode (uploaded after the asset is saved) */}
          {!activo?.id && (
            <>
              <ImageUploader
                images={pendingImages}
                onChange={setPendingImages}
                disabled={loading || aiLoading}
              />
              {aiNote && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  background: 'rgba(201,165,92,0.08)', border: '1px solid rgba(201,165,92,0.3)',
                  borderRadius: '6px', padding: '10px 12px', margin: '8px 0',
                  fontSize: '13px', color: 'var(--color-accent)',
                }}>
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>✨</span>
                  <span>{aiNote}</span>
                </div>
              )}
              <button
                type="button"
                disabled={!pendingImages.length || loading || aiLoading}
                onClick={runAiAutofill}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '9px 16px',
                  background: (!pendingImages.length || loading || aiLoading)
                    ? 'rgba(201,165,92,0.15)'
                    : 'var(--color-accent)',
                  color: (!pendingImages.length || loading || aiLoading)
                    ? 'rgba(201,165,92,0.45)'
                    : '#1a1205',
                  border: '1px solid rgba(201,165,92,0.4)',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: (!pendingImages.length || loading || aiLoading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                <span style={{ fontSize: '15px' }}>✨</span>
                {aiLoading ? 'Analizando imagen…' : 'Auto llenado IA'}
              </button>
            </>
          )}
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Código de Activo *</label>
            <input
              type="text"
              name="codigoActivo"
              value={formData.codigoActivo}
              onChange={handleChange}
              placeholder="ej: UN-2024-001"
              required
            />
          </div>

          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="ej: Laptop Dell XPS 15"
              required
            />
          </div>

          <div className="form-group">
            <label>Marca</label>
            <input
              type="text"
              name="marca"
              value={formData.marca}
              onChange={handleChange}
              placeholder="ej: Dell"
            />
          </div>

          <div className="form-group">
            <label>Modelo</label>
            <input
              type="text"
              name="modelo"
              value={formData.modelo}
              onChange={handleChange}
              placeholder="ej: XPS 15 9500"
            />
          </div>

          <div className="form-group">
            <label>Número de Serie</label>
            <input
              type="text"
              name="numeroDeSerie"
              value={formData.numeroDeSerie}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Categoría *</label>
            <select 
              name="categoriaActivoId" 
              value={formData.categoriaActivoId}
              onChange={handleChange} 
              required
            >
              <option value="">Seleccionar categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Ubicación *</label>
            <select 
              name="ubicacionId" 
              value={formData.ubicacionId}
              onChange={handleChange} 
              required
            >
              <option value="">Seleccionar ubicación</option>
              {ubicaciones.map((ubi) => (
                <option key={ubi.id} value={ubi.id}>
                  {ubi.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* CAMPO ESTADO - Con validación visible */}
          <div className="form-group">
            <label>
              Estado Operativo <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              name="estado"
              value={formData.estado}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                -- Seleccione un estado --
              </option>
              {estadoOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {showEstadoError && (
              <span style={{ color: 'var(--color-danger)', fontSize: '12px' }}>
                Debe seleccionar un estado para el activo
              </span>
            )}
            {!showEstadoError && formData.estado && (
              <span style={{ color: 'var(--color-success)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IconCheck size={13} />
                {estadoOptions.find(o => o.value === formData.estado)?.label}
              </span>
            )}
          </div>

          <div className="form-group">
            <label>Valor de Adquisición *</label>
            <input
              type="number"
              name="valorAdquisicion"
              value={formData.valorAdquisicion}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label>Fecha de Adquisición *</label>
            <input
              type="date"
              name="fechaAdquisicion"
              value={formData.fechaAdquisicion}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Proveedor</label>
            <input
              type="text"
              name="proveedor"
              value={formData.proveedor}
              onChange={handleChange}
              placeholder="ej: Tech Suministros S.A."
            />
          </div>
        </div>

        <div className="form-group form-full">
          <label>Observaciones</label>
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            placeholder="Notas adicionales sobre el activo"
            rows={3}
          />
        </div>

        <div className="form-actions">
          <Button label="Cancelar" variant="secondary" onClick={onClose} />
          <Button
            label={activo ? 'Actualizar' : 'Guardar y Registrar'}
            variant="primary"
            type="submit"
            isLoading={loading}
          />
        </div>
      </form>
    </Modal>
  );
};

export default ActivoForm;