import React, { useMemo, useState, useEffect } from 'react';
import { Button, Modal } from '../common';
import type { CreateMaterialDTO, Material, UpdateMaterialDTO } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

interface MaterialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  materialToEdit?: Material | null;
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ 
  isOpen, 
  onClose, 
  onCreated,
  materialToEdit 
}) => {
  const { user } = useAuth();
  const notify = useNotification();
  const isAdminUser =
    user?.correo === 'admin@activos.bo' || user?.rol?.nombre === 'ADMIN_GENERAL';

  // Admin puede usar 0, usuarios normales deben usar > 0
  const minStockValue = isAdminUser ? 0 : 0.01;

  const initialState = useMemo<CreateMaterialDTO>(
    () => ({
      codigo: '',
      nombre: '',
      descripcion: undefined,
      unidad: '',
      stockActual: minStockValue,
      stockMinimo: minStockValue,
      categoriaId: undefined,
    }),
    [minStockValue]
  );

  const [formData, setFormData] = useState<CreateMaterialDTO | UpdateMaterialDTO>(initialState);
  const [stockActualInput, setStockActualInput] = useState(String(initialState.stockActual));
  const [stockMinimoInput, setStockMinimoInput] = useState(String(initialState.stockMinimo));
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset cuando se abre/cierra
  useEffect(() => {
    if (isOpen) {
      cargarCategorias();
      
      if (materialToEdit) {
        // Modo edición: cargar datos del material
        setFormData({
          nombre: materialToEdit.nombre,
          descripcion: materialToEdit.descripcion,
          unidad: materialToEdit.unidad,
          stockActual: materialToEdit.stockActual,
          stockMinimo: materialToEdit.stockMinimo,
          categoriaId: materialToEdit.categoriaId || undefined,
        });
        setStockActualInput(String(materialToEdit.stockActual));
        setStockMinimoInput(String(materialToEdit.stockMinimo));
      } else {
        // Modo creación: resetear
        setFormData(initialState);
        setStockActualInput(String(initialState.stockActual));
        setStockMinimoInput(String(initialState.stockMinimo));
      }
      setErrors({});
    }
  }, [isOpen, materialToEdit, initialState]);

  const cargarCategorias = async () => {
    try {
      const categoriasData = await inventarioService.obtenerCategorias();
      setCategorias(categoriasData);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validar campos obligatorios
    if (!formData.nombre?.trim()) newErrors.nombre = 'El nombre es obligatorio';
    if (!formData.unidad?.trim()) newErrors.unidad = 'La unidad de medida es obligatoria';
    if (!materialToEdit && !(formData as CreateMaterialDTO).codigo?.trim()) {
      newErrors.codigo = 'El código es obligatorio';
    }
    if (!formData.categoriaId) newErrors.categoriaId = 'Debe seleccionar una categoría';
    
    // Validación de stock actual
    const stockActual = formData.stockActual ?? 0;
    if (stockActual < minStockValue) {
      newErrors.stockActual = `El stock actual debe ser ${minStockValue === 0 ? 'mayor o igual a 0' : 'mayor a 0'}`;
    }
    
    // Validación de stock mínimo
    const stockMinimo = formData.stockMinimo ?? 0;
    if (stockMinimo < minStockValue) {
      newErrors.stockMinimo = `El stock mínimo debe ser ${minStockValue === 0 ? 'mayor o igual a 0' : 'mayor a 0'}`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === 'stockActual') {
        setStockActualInput(value);
        const numValue = value === '' ? 0 : Number(value);
        return { ...prev, stockActual: numValue };
      }
      if (name === 'stockMinimo') {
        setStockMinimoInput(value);
        const numValue = value === '' ? 0 : Number(value);
        return { ...prev, stockMinimo: numValue };
      }
      if (name === 'descripcion') {
        const trimmed = value.trim();
        return { ...prev, descripcion: trimmed.length ? value : undefined };
      }
      if (name === 'categoriaId') {
        return { ...prev, categoriaId: value || undefined };
      }
      return { ...prev, [name]: value };
    });
    
    // Limpiar error del campo que se está editando
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      notify.warning('Formulario incompleto', 'Complete los campos obligatorios correctamente.');
      return;
    }
    
    setLoading(true);

    try {
      if (materialToEdit) {
        // Modo edición: actualizar material
        const updateData: UpdateMaterialDTO = {
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          unidad: formData.unidad,
          stockActual: formData.stockActual,
          stockMinimo: formData.stockMinimo,
          categoriaId: formData.categoriaId,
        };
        await inventarioService.actualizar(materialToEdit.id, updateData);
        notify.success('Material actualizado correctamente');
      } else {
        // Modo creación: crear nuevo material
        const createData = formData as CreateMaterialDTO;
        await inventarioService.crear(createData);
        notify.success('Material registrado correctamente');
      }
      await onCreated();
      onClose();
    } catch (err: any) {
      notify.error('Error', err?.message || 'No se pudo guardar el material.');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!materialToEdit;

  return (
    <Modal
      isOpen={isOpen}
      title={isEditing ? 'Editar Material' : 'Registrar Material'}
      onClose={onClose}
      size="lg"
      loading={loading}
    >
      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-grid">
          {!isEditing && (
            <div className={`form-group ${errors.codigo ? 'formField--error' : ''}`}>
              <label>Código *</label>
              <input
                type="text"
                name="codigo"
                value={(formData as CreateMaterialDTO).codigo || ''}
                onChange={handleChange}
                placeholder="ej: MAT-0001"
                style={{ borderColor: errors.codigo ? '#dc2626' : undefined }}
              />
              {errors.codigo && <span style={{ color: '#dc2626', fontSize: '12px' }}>{errors.codigo}</span>}
            </div>
          )}

          <div className={`form-group ${errors.nombre ? 'formField--error' : ''}`}>
            <label>Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre || ''}
              onChange={handleChange}
              placeholder="ej: Cartucho tinta HP"
              style={{ borderColor: errors.nombre ? '#dc2626' : undefined }}
            />
            {errors.nombre && <span style={{ color: '#dc2626', fontSize: '12px' }}>{errors.nombre}</span>}
          </div>

          <div className={`form-group ${errors.categoriaId ? 'formField--error' : ''}`}>
            <label>Categoría *</label>
            <select
              name="categoriaId"
              value={formData.categoriaId || ''}
              onChange={handleChange}
              style={{ borderColor: errors.categoriaId ? '#dc2626' : undefined }}
            >
              <option value="" disabled>Seleccionar categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
            {errors.categoriaId && <span style={{ color: '#dc2626', fontSize: '12px' }}>{errors.categoriaId}</span>}
          </div>

          <div className={`form-group ${errors.unidad ? 'formField--error' : ''}`}>
            <label>Unidad *</label>
            <input
              type="text"
              name="unidad"
              value={formData.unidad || ''}
              onChange={handleChange}
              placeholder="ej: unidad, caja, litro"
              style={{ borderColor: errors.unidad ? '#dc2626' : undefined }}
            />
            {errors.unidad && <span style={{ color: '#dc2626', fontSize: '12px' }}>{errors.unidad}</span>}
          </div>

          <div className={`form-group ${errors.stockActual ? 'formField--error' : ''}`}>
            <label>Stock actual *</label>
            <input
              type="number"
              name="stockActual"
              value={stockActualInput}
              onChange={handleChange}
              min={minStockValue}
              step="0.01"
              style={{ borderColor: errors.stockActual ? '#dc2626' : undefined }}
            />
            {errors.stockActual && (
              <span style={{ color: '#dc2626', fontSize: '12px' }}>
                ⚠️ {errors.stockActual}
              </span>
            )}
            {!errors.stockActual && formData.stockActual === minStockValue && minStockValue > 0 && (
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                El valor mínimo permitido es {minStockValue}
              </span>
            )}
          </div>

          <div className={`form-group ${errors.stockMinimo ? 'formField--error' : ''}`}>
            <label>Stock mínimo *</label>
            <input
              type="number"
              name="stockMinimo"
              value={stockMinimoInput}
              onChange={handleChange}
              min={minStockValue}
              step="0.01"
              style={{ borderColor: errors.stockMinimo ? '#dc2626' : undefined }}
            />
            {errors.stockMinimo && (
              <span style={{ color: '#dc2626', fontSize: '12px' }}>
                ⚠️ {errors.stockMinimo}
              </span>
            )}
            {!errors.stockMinimo && formData.stockMinimo === minStockValue && minStockValue > 0 && (
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                El valor mínimo permitido es {minStockValue}
              </span>
            )}
          </div>

          <div className="form-group form-full">
            <label>Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion || ''}
              onChange={handleChange}
              placeholder="Opcional"
              rows={3}
            />
          </div>
        </div>

        <div className="form-actions">
          <Button label="Cancelar" variant="secondary" onClick={onClose} disabled={loading} />
          <Button label={isEditing ? 'Actualizar' : 'Crear'} variant="primary" type="submit" isLoading={loading} />
        </div>
      </form>
    </Modal>
  );
};

export default MaterialForm;
