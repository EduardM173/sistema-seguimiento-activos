import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMaterialCategories, type MaterialCategory } from '../../services/material-category.service';
import { createMaterial, type CreateMaterialRequest } from '../../services/inventory.service';
import '../../styles/inventory.css';

interface CreateMaterialFormProps {
  onSuccess?: () => void;
}

export default function CreateMaterialForm({ onSuccess }: CreateMaterialFormProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    unidad: '',
    stockActual: '',
    stockMinimo: '',
    categoriaId: '',
  });

  const [errors, setErrors] = useState({
    codigo: '',
    nombre: '',
    unidad: '',
    stockActual: '',
    stockMinimo: '',
    categoriaId: '',
  });

  // Cargar categorías al montar el componente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        if (!user) {
          console.log('No hay usuario');
          return;
        }
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        if (!token) {
          console.log('No hay token');
          return;
        }

        console.log('Cargando categorías desde:', import.meta.env.VITE_API_URL || 'http://localhost:10000');
        const data = await getMaterialCategories(token);
        console.log('Categorías cargadas:', data);
        setCategories(data);
      } catch (err) {
        console.error('Error al cargar categorías:', err);
        setErrorMessage(`Error al cargar las categorías: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      }
    };

    loadCategories();
  }, [user]);

  const validateForm = () => {
    const newErrors = {
      codigo: '',
      nombre: '',
      unidad: '',
      stockActual: '',
      stockMinimo: '',
      categoriaId: '',
    };

    if (!formData.codigo.trim()) {
      newErrors.codigo = 'El código es obligatorio';
    }

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    }

    if (!formData.unidad.trim()) {
      newErrors.unidad = 'La unidad es obligatoria';
    }

    if (!formData.stockActual) {
      newErrors.stockActual = 'El stock actual es obligatorio';
    } else if (parseFloat(formData.stockActual) < 0) {
      newErrors.stockActual = 'El stock actual no puede ser negativo';
    }

    if (!formData.stockMinimo) {
      newErrors.stockMinimo = 'El stock mínimo es obligatorio';
    } else if (parseFloat(formData.stockMinimo) < 0) {
      newErrors.stockMinimo = 'El stock mínimo no puede ser negativo';
    }

    if (!formData.categoriaId.trim()) {
      newErrors.categoriaId = 'La categoría es obligatoria';
    }

    setErrors(newErrors);
    return Object.values(newErrors).every((err) => err === '');
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Limpiar error cuando el usuario empieza a escribir
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const materialData: CreateMaterialRequest = {
        codigo: formData.codigo.trim(),
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || undefined,
        unidad: formData.unidad.trim(),
        stockActual: parseFloat(formData.stockActual),
        stockMinimo: parseFloat(formData.stockMinimo),
        categoriaId: formData.categoriaId,
      };

      await createMaterial(materialData, token);

      setSuccessMessage('Material creado exitosamente');
      setFormData({
        codigo: '',
        nombre: '',
        descripcion: '',
        unidad: '',
        stockActual: '',
        stockMinimo: '',
        categoriaId: '',
      });

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccessMessage('');
        // Llamar callback onSuccess después de limpiar el mensaje
        if (onSuccess) {
          onSuccess();
        }
      }, 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al crear el material';
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      unidad: '',
      stockActual: '',
      stockMinimo: '',
      categoriaId: '',
    });
    setErrors({
      codigo: '',
      nombre: '',
      unidad: '',
      stockActual: '',
      stockMinimo: '',
      categoriaId: '',
    });
    setErrorMessage('');
    setSuccessMessage('');
  };

  return (
    <div className="createMaterialForm">
      <h2>Crear Nuevo Material</h2>

      {successMessage && <div className="form-message form-message--success">{successMessage}</div>}
      {errorMessage && <div className="form-message form-message--error">{errorMessage}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="codigo">Código *</label>
          <input
            type="text"
            id="codigo"
            name="codigo"
            value={formData.codigo}
            onChange={handleChange}
            placeholder="Ej: MAT-001"
            disabled={loading}
          />
          {errors.codigo && <span className="form-error">{errors.codigo}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="nombre">Nombre *</label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: Papel A4"
            disabled={loading}
          />
          {errors.nombre && <span className="form-error">{errors.nombre}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Descripción del material"
            disabled={loading}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="unidad">Unidad *</label>
          <input
            type="text"
            id="unidad"
            name="unidad"
            value={formData.unidad}
            onChange={handleChange}
            placeholder="Ej: paquete, resma, pieza"
            disabled={loading}
          />
          {errors.unidad && <span className="form-error">{errors.unidad}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="stockActual">Stock Actual *</label>
            <input
              type="number"
              id="stockActual"
              name="stockActual"
              value={formData.stockActual}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              disabled={loading}
            />
            {errors.stockActual && <span className="form-error">{errors.stockActual}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="stockMinimo">Stock Mínimo *</label>
            <input
              type="number"
              id="stockMinimo"
              name="stockMinimo"
              value={formData.stockMinimo}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              disabled={loading}
            />
            {errors.stockMinimo && <span className="form-error">{errors.stockMinimo}</span>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="categoriaId">Categoría *</label>
          <select
            id="categoriaId"
            name="categoriaId"
            value={formData.categoriaId}
            onChange={handleChange}
            disabled={loading || categories.length === 0}
          >
            <option value="">Seleccionar categoría...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </select>
          {errors.categoriaId && <span className="form-error">{errors.categoriaId}</span>}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Creando...' : 'Crear Material'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
