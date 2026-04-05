import React, { useMemo, useState } from 'react';
import { Button, Modal } from '../common';
import type { CreateMaterialDTO, Material } from '../../types/inventario.types';
import { inventarioService } from '../../services/inventario.service';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

interface MaterialFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const notify = useNotification();
  const isAdminUser =
    user?.correo === 'admin@activos.bo' || user?.rol?.nombre === 'ADMIN_GENERAL';

  const initialState = useMemo<CreateMaterialDTO>(
    () => ({
      codigo: '',
      nombre: '',
      descripcion: undefined,
      unidad: '',
      stockActual: isAdminUser ? 0 : 0.01,
      stockMinimo: isAdminUser ? 0 : 0.01,
      categoriaId: undefined,
    }),
    [isAdminUser]
  );

  const [formData, setFormData] = useState<CreateMaterialDTO>(initialState);
  const [stockActualInput, setStockActualInput] = useState(String(initialState.stockActual));
  const [stockMinimoInput, setStockMinimoInput] = useState(String(initialState.stockMinimo));
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);

  // Reset simple cuando se abre/cierra, para evitar valores “viejos”
  React.useEffect(() => {
    if (isOpen) {
      setFormData(initialState);
      setStockActualInput(String(initialState.stockActual));
      setStockMinimoInput(String(initialState.stockMinimo));
      cargarCategorias();
    }
  }, [isOpen, initialState]);

  const cargarCategorias = async () => {
    try {
      const categoriasData = await inventarioService.obtenerCategorias();
      setCategorias(categoriasData);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === 'stockActual') {
        setStockActualInput(value);
        return { ...prev, stockActual: value === '' ? 0 : Number(value) };
      }
      if (name === 'stockMinimo') {
        setStockMinimoInput(value);
        return { ...prev, stockMinimo: value === '' ? 0 : Number(value) };
      }

      if (name === 'descripcion') {
        // Importante: no recortamos con `trim()` para no "comerse" el espacio
        // mientras el usuario escribe (por ejemplo, entre palabras).
        const trimmed = value.trim();
        return { ...prev, descripcion: trimmed.length ? value : undefined };
      }

      if (name === 'categoriaId') {
        return { ...prev, categoriaId: value || undefined };
      }

      return { ...prev, [name]: value } as CreateMaterialDTO;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.categoriaId) {
        notify.warning('Categoría requerida', 'Debe seleccionar una categoría.');
        return;
      }
      if (isAdminUser) {
        if (formData.stockActual === 0) {
          notify.warning('Stock actual no registrado.');
          return;
        }
      } else if (formData.stockActual <= 0) {
        notify.warning('Valor inválido', 'El "Stock actual" debe ser mayor a 0.');
        return;
      }
      if (formData.stockActual < 0) {
        notify.warning('Valor inválido', 'El "Stock actual" no puede ser menor a 0.');
        return;
      }
      if (isAdminUser) {
        if (formData.stockMinimo === 0) {
          notify.warning('Stock mínimo no registrado.');
          return;
        }
      } else if (formData.stockMinimo <= 0) {
        notify.warning('Valor inválido', 'El "Stock mínimo" debe ser mayor a 0.');
        return;
      }
      if (formData.stockMinimo < 0) {
        notify.warning('Valor inválido', 'El "Stock mínimo" no puede ser menor a 0.');
        return;
      }

      const created: Material = await inventarioService.crear(formData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = created;
      onCreated();
      onClose();
    } catch (err: any) {
      notify.error('Error al guardar el material', err?.message || 'No se pudo registrar el material.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Registrar Material"
      onClose={onClose}
      size="lg"
      loading={loading}
    >
      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-grid">
          <div className="form-group">
            <label>Código</label>
            <input
              type="text"
              name="codigo"
              value={formData.codigo}
              onChange={handleChange}
              placeholder="ej: MAT-0001"
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
              placeholder="ej: Cartucho tinta HP"
              required
            />
          </div>

          <div className="form-group">
            <label>Categoría *</label>
            <select
              name="categoriaId"
              value={formData.categoriaId || ''}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Seleccionar categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Unidad</label>
            <input
              type="text"
              name="unidad"
              value={formData.unidad}
              onChange={handleChange}
              placeholder="ej: unidad, caja, litro"
              required
            />
          </div>

          <div className="form-group">
            <label>Stock actual</label>
            <input
              type="number"
              name="stockActual"
                value={stockActualInput}
              onChange={handleChange}
              min={isAdminUser ? 0 : 0.01}
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label>Stock mínimo</label>
            <input
              type="number"
              name="stockMinimo"
                value={stockMinimoInput}
              onChange={handleChange}
              min={isAdminUser ? 0 : 0.01}
              step="0.01"
              required
            />
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
          <Button label="Crear" variant="primary" type="submit" isLoading={loading} />
        </div>
      </form>
    </Modal>
  );
};

export default MaterialForm;

