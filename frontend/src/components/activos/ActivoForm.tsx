import React, { useState, useEffect } from 'react';
import { Button, Modal } from '../common';
import type { Activo, CreateActivoDTO } from '../../types/activos.types';
import { activosService } from '../../services/activos.service';
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
    estado: 'Operacional',
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
          estado: activo.estado || 'Operacional',
          ubicacionId: activo.ubicacionId || activo.ubicacion?.id || '',
          responsableId: activo.responsableId || '',
          valorAdquisicion: activo.valorAdquisicion || 0,
          fechaAdquisicion: activo.fechaAdquisicion
            ? new Date(activo.fechaAdquisicion).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          proveedor: activo.proveedor || '',
          observaciones: activo.observaciones || '',
        });
      }
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
    setLoading(true);

    try {
      let resultado: Activo;
      if (activo) {
        resultado = await activosService.actualizar(activo.id, formData);
      } else {
        resultado = await activosService.crear(formData);
      }
      onSubmit(resultado);
      onClose();
    } catch (err) {
      console.error('Error al guardar activo:', err);
      alert('Error al guardar el activo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={activo ? 'Editar Activo' : 'Nuevo Activo'}
      onClose={onClose}
      size="lg"
      loading={loading}
    >
      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Código de Activo</label>
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
            <label>Nombre</label>
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
            <label>Categoría</label>
            <select name="categoriaActivoId" onChange={handleChange} required>
              <option value="">Seleccionar...</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Ubicación</label>
            <select name="ubicacionId" onChange={handleChange} required>
              <option value="">Seleccionar...</option>
              {ubicaciones.map((ubi) => (
                <option key={ubi.id} value={ubi.id}>
                  {ubi.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select name="estado" value={formData.estado} onChange={handleChange}>
              <option>Operacional</option>
              <option>Mantenimiento</option>
              <option>Reparación</option>
              <option>Baja</option>
            </select>
          </div>

          <div className="form-group">
            <label>Valor de Adquisición</label>
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
            <label>Fecha de Adquisición</label>
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
            label={activo ? 'Actualizar' : 'Crear'}
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
