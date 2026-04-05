import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { createAsset } from '../services/assets.service';
import { getCategorias, getUbicaciones, getAreas, getUsuarios } from '../services/catalogs.service';
import { useNotification } from '../context/NotificationContext';
import { HttpError } from '../services/http.client';
import type {
  CreateAssetPayload,
  EstadoActivo,
  Categoria,
  Ubicacion,
  Area,
  UsuarioResumen,
} from '../types/assets.types';

import '../styles/create-asset.css';

type FormErrors = Partial<Record<keyof CreateAssetPayload | 'general' | 'estado', string>>;

const ESTADO_OPTIONS: { value: EstadoActivo; label: string }[] = [
  { value: 'OPERATIVO', label: 'Operativo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'FUERA_DE_SERVICIO', label: 'Fuera de Servicio' },
];

type Priority = 'CRITICO' | 'ALTO' | 'NORMAL';

export default function CreateAssetPage() {
  const navigate = useNavigate();
  const notify = useNotification();

  // ── Catalog data from backend ──
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(true);

  useEffect(() => {
    async function loadCatalogs() {
      try {
        setCatalogsLoading(true);
        const [cats, ubis, ars, usrs] = await Promise.all([
          getCategorias(),
          getUbicaciones(),
          getAreas(),
          getUsuarios(),
        ]);
        setCategorias(cats);
        setUbicaciones(ubis);
        setAreas(ars);
        setUsuarios(usrs);
      } catch {
        notify.error('Error', 'No se pudieron cargar los catálogos. Intente recargar la página.');
      } finally {
        setCatalogsLoading(false);
      }
    }
    void loadCatalogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form fields ──
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [estado, setEstado] = useState<EstadoActivo>('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [areaActualId, setAreaActualId] = useState('');
  const [responsableActualId, setResponsableActualId] = useState('');
  const [prioridad, setPrioridad] = useState<Priority>('NORMAL');
  const [costoAdquisicion, setCostoAdquisicion] = useState('');
  const [fechaAdquisicion, setFechaAdquisicion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // ── UI state ──
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function markTouched(field: string) {
    setTouched((prev) => new Set(prev).add(field));
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!codigo.trim()) errs.codigo = 'El código del activo es obligatorio';
    else if (codigo.length > 50) errs.codigo = 'El código no puede exceder 50 caracteres';
    if (!nombre.trim()) errs.nombre = 'El nombre del activo es obligatorio';
    else if (nombre.length > 200) errs.nombre = 'El nombre no puede exceder 200 caracteres';
    if (!categoriaId) errs.categoriaId = 'Debe seleccionar una categoría';
    if (!estado) errs.estado = 'Debe seleccionar un estado para el activo';
    if (costoAdquisicion && (isNaN(Number(costoAdquisicion)) || Number(costoAdquisicion) < 0))
      errs.costoAdquisicion = 'El valor de adquisición debe ser un número positivo';

    return errs;
  }

  // Real-time validation: recompute errors when touched fields change
  function getFieldError(field: string): string | undefined {
    if (!touched.has(field)) return undefined;
    const allErrors = validate();
    return allErrors[field as keyof FormErrors];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Mark all required fields as touched
    const allFields = ['codigo', 'nombre', 'categoriaId', 'estado'];
    setTouched(new Set([...touched, ...allFields]));

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      notify.warning('Formulario incompleto', 'Revise los campos marcados en rojo.');
      // Scroll al campo de estado si es el error
      if (validationErrors.estado) {
        document.getElementById('estadoOperativo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreateAssetPayload = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        categoriaId,
      };

      if (marca.trim()) payload.marca = marca.trim();
      if (modelo.trim()) payload.modelo = modelo.trim();
      if (numeroSerie.trim()) payload.numeroSerie = numeroSerie.trim();
      if (costoAdquisicion) payload.costoAdquisicion = Number(costoAdquisicion);
      if (fechaAdquisicion) payload.fechaAdquisicion = fechaAdquisicion;
      if (ubicacionId) payload.ubicacionId = ubicacionId;
      if (areaActualId) payload.areaActualId = areaActualId;
      if (responsableActualId) payload.responsableActualId = responsableActualId;
      if (observaciones.trim()) payload.descripcion = observaciones.trim();
      if (estado) payload.estado = estado;

      const result = await createAsset(payload);
      notify.success(result.message ?? 'Activo registrado exitosamente');
      navigate('/activos');
    } catch (err) {
      if (err instanceof HttpError) {
        notify.error('Error al registrar', err.message);
        if (err.errors?.length) {
          const fieldErrors: FormErrors = {};
          fieldErrors.general = err.errors.join('. ');
          setErrors(fieldErrors);
        }
      } else {
        notify.error('Error inesperado', 'No se pudo registrar el activo');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="createAssetPage">
      {/* Header */}
      <div className="createAssetPage__header">
        <div>
          <span className="createAssetPage__breadcrumb">◎ Módulo de Inventario</span>
          <h1 className="createAssetPage__title">Registrar Nuevo Activo</h1>
          <p className="createAssetPage__subtitle">
            Complete los detalles técnicos y financieros para mantener el registro institucional actualizado.
          </p>
        </div>
        <span className="createAssetPage__badge">Estado: Borrador</span>
      </div>

      <form onSubmit={handleSubmit} className="createAssetForm" noValidate>
        {/* ── Section 1: Información General ── */}
        <fieldset className="formSection">
          <legend className="formSection__legend">
            <span className="formSection__icon">📋</span>
            <div>
              <span className="formSection__title">Información General</span>
              <span className="formSection__desc">Identificación básica y marca del activo universitario.</span>
            </div>
          </legend>

          <div className="formGrid formGrid--2">
            <div className={`formField ${getFieldError('codigo') ? 'formField--error' : ''}`}>
              <label htmlFor="codigo">
                Código Único de Activo (CUA) <span className="req">*</span>
              </label>
              <div className="formField__inputWrap">
                <input
                  id="codigo"
                  type="text"
                  placeholder="Ej: UN-2024-0015"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onBlur={() => markTouched('codigo')}
                  maxLength={50}
                />
                <span className="formField__infoIcon" title="Código único institucional">ⓘ</span>
              </div>
              {getFieldError('codigo') && <span className="formField__error">{getFieldError('codigo')}</span>}
            </div>

            <div className={`formField ${getFieldError('nombre') ? 'formField--error' : ''}`}>
              <label htmlFor="nombre">
                Nombre del Activo <span className="req">*</span>
              </label>
              <input
                id="nombre"
                type="text"
                placeholder="Ej: Proyector Láser 4K"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={() => markTouched('nombre')}
                maxLength={200}
              />
              {getFieldError('nombre') && <span className="formField__error">{getFieldError('nombre')}</span>}
            </div>
          </div>

          <div className="formGrid formGrid--3">
            <div className="formField">
              <label htmlFor="marca">Marca</label>
              <input
                id="marca"
                type="text"
                placeholder="Ej: Sony"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="formField">
              <label htmlFor="modelo">Modelo</label>
              <input
                id="modelo"
                type="text"
                placeholder="Ej: VPL-FHZ50"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="formField">
              <label htmlFor="numeroSerie">Número de Serie</label>
              <input
                id="numeroSerie"
                type="text"
                placeholder="Ej: SN-98234-A"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
        </fieldset>

        {/* ── Section 2: Clasificación y Estado ── */}
        <fieldset className="formSection">
          <legend className="formSection__legend">
            <span className="formSection__icon">🏷️</span>
            <div>
              <span className="formSection__title">Clasificación y Estado</span>
              <span className="formSection__desc">Categorización para reportes y depreciación.</span>
            </div>
          </legend>

          <div className="formGrid formGrid--2">
            <div className={`formField ${getFieldError('categoriaId') ? 'formField--error' : ''}`}>
              <label htmlFor="categoriaId">
                Categoría <span className="req">*</span>
              </label>
              <select
                id="categoriaId"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                onBlur={() => markTouched('categoriaId')}
                disabled={catalogsLoading}
              >
                <option value="">
                  {catalogsLoading ? 'Cargando categorías...' : 'Seleccionar categoría'}
                </option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
              {getFieldError('categoriaId') && (
                <span className="formField__error">{getFieldError('categoriaId')}</span>
              )}
            </div>

            <div className="formField">
              <label htmlFor="subcategoria">Subcategoría</label>
              <select id="subcategoria" disabled>
                <option>Seleccionar subcategoría</option>
              </select>
            </div>
          </div>
        </fieldset>

        {/* ── Section 3: Ubicación y Responsable ── */}
        <fieldset className="formSection">
          <legend className="formSection__legend">
            <span className="formSection__icon">📍</span>
            <div>
              <span className="formSection__title">Ubicación y Responsable</span>
              <span className="formSection__desc">¿Dónde se encuentra y quién responde por él?</span>
            </div>
          </legend>

          <div className="formGrid formGrid--3">
            <div className="formField">
              <label htmlFor="ubicacionId">
                Ubicación <span className="req">*</span>
              </label>
              <select
                id="ubicacionId"
                value={ubicacionId}
                onChange={(e) => setUbicacionId(e.target.value)}
                disabled={catalogsLoading}
              >
                <option value="">
                  {catalogsLoading ? 'Cargando ubicaciones...' : 'Seleccionar ubicación'}
                </option>
                {ubicaciones.map((ubi) => (
                  <option key={ubi.id} value={ubi.id}>
                    {[ubi.nombre, ubi.edificio, ubi.piso].filter(Boolean).join(' — ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="formField">
              <label htmlFor="areaActualId">
                Área / Departamento
              </label>
              <select
                id="areaActualId"
                value={areaActualId}
                onChange={(e) => setAreaActualId(e.target.value)}
                disabled={catalogsLoading}
              >
                <option value="">
                  {catalogsLoading ? 'Cargando áreas...' : 'Seleccionar área'}
                </option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nombre}
                  </option>
                ))}
              </select>
            </div>
            {/* CAMPO ESTADO MODIFICADO - CON VALIDACIÓN */}
            <div className={`formField ${getFieldError('estado') ? 'formField--error' : ''}`}>
              <label htmlFor="estadoOperativo">
                Estado Operativo <span className="req">*</span>
              </label>
              <select
                id="estadoOperativo"
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value as EstadoActivo);
                  markTouched('estado');
                }}
                onBlur={() => markTouched('estado')}
                style={{
                  borderColor: getFieldError('estado') ? '#dc2626' : undefined,
                  backgroundColor: getFieldError('estado') ? '#fef2f2' : undefined,
                }}
              >
                <option value="" disabled>-- Seleccione un estado --</option>
                {ESTADO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {getFieldError('estado') && (
                <span className="formField__error"> {getFieldError('estado')}</span>
              )}
            </div>
          </div>

          <div className="formGrid formGrid--2">
            <div className="formField">
              <label htmlFor="responsableActualId">
                Responsable Asignado
              </label>
              <select
                id="responsableActualId"
                value={responsableActualId}
                onChange={(e) => setResponsableActualId(e.target.value)}
                disabled={catalogsLoading}
              >
                <option value="">
                  {catalogsLoading ? 'Cargando usuarios...' : 'Seleccionar responsable'}
                </option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombreCompleto}{u.area ? ` — ${u.area.nombre}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="formField">
              <label>Prioridad de Activo</label>
              <div className="priorityGroup">
                {(['CRITICO', 'ALTO', 'NORMAL'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`priorityBtn priorityBtn--${p.toLowerCase()} ${prioridad === p ? 'priorityBtn--selected' : ''}`}
                    onClick={() => setPrioridad(p)}
                  >
                    {p === 'CRITICO' ? 'Crítico' : p === 'ALTO' ? 'Alto' : 'Normal'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        {/* ── Section 4: Financiero y Documentación ── */}
        <fieldset className="formSection">
          <legend className="formSection__legend">
            <span className="formSection__icon">💰</span>
            <div>
              <span className="formSection__title">Financiero y Documentación</span>
              <span className="formSection__desc">Valor de adquisición, proveedores y soporte legal.</span>
            </div>
          </legend>

          <div className="formGrid formGrid--3">
            <div className={`formField ${getFieldError('costoAdquisicion') ? 'formField--error' : ''}`}>
              <label htmlFor="costo">
                Valor de Adquisición ($) <span className="req">*</span>
              </label>
              <input
                id="costo"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costoAdquisicion}
                onChange={(e) => setCostoAdquisicion(e.target.value)}
                onBlur={() => markTouched('costoAdquisicion')}
              />
              {getFieldError('costoAdquisicion') && (
                <span className="formField__error">{getFieldError('costoAdquisicion')}</span>
              )}
            </div>
            <div className="formField">
              <label htmlFor="fechaAdq">Fecha de Adquisición</label>
              <input
                id="fechaAdq"
                type="date"
                value={fechaAdquisicion}
                onChange={(e) => setFechaAdquisicion(e.target.value)}
              />
            </div>
            <div className="formField">
              <label htmlFor="proveedor">Proveedor</label>
              <input
                id="proveedor"
                type="text"
                placeholder="Ej: TechSolutions S.A."
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
              />
            </div>
          </div>

          <div className="formField">
            <label htmlFor="observaciones">Observaciones Técnicas</label>
            <textarea
              id="observaciones"
              rows={3}
              placeholder="Detalles adicionales, garantía, especificaciones técnicas..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              maxLength={500}
            />
          </div>

          {/* Document upload area (visual only) */}
          <div className="formField">
            <label>Documentos y Evidencia Fotográfica</label>
            <div className="uploadArea">
              <span className="uploadArea__icon">☁️</span>
              <p className="uploadArea__text">Haga clic o arrastre archivos aquí</p>
              <p className="uploadArea__hint">PDF, JPG, PNG o DOC (Máx. 10MB por archivo)</p>
            </div>
          </div>
        </fieldset>

        {/* System Recommendation */}
        <div className="systemNote">
          <span className="systemNote__icon">💡</span>
          <div>
            <strong>Recomendación del Sistema</strong>
            <p>
              Asegúrese de que el CUA coincida con la etiqueta física adherida al activo para facilitar futuras
              auditorías con escáner QR.
            </p>
          </div>
        </div>

        {/* Errors summary */}
        {errors.general && (
          <div className="formErrorBanner">
            {errors.general}
          </div>
        )}

        {/* Footer buttons */}
        <div className="createAssetForm__footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate('/activos')}
            disabled={submitting}
          >
            ✕ Cancelar
          </button>
          <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
            {submitting ? 'Guardando...' : '💾 Guardar y Registrar'}
          </button>
        </div>
      </form>
    </section>
  );
}