import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { IconClipboard, IconTag, IconMapPin, IconDollarSign, IconInfo, IconX, IconSave } from '../components/common/Icon';
import { ImageUploader, type PendingImage } from '../components/common/ImageUploader';
import { activosService } from '../services/activos.service';

import { createAsset } from '../services/assets.service';
import { getCategorias, getUbicaciones, getAreas, getUsuarios } from '../services/catalogs.service';
import { searchLocations, generateAssetCode, type LocationItem } from '../services/locations.service';
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

import OverlayModal from '../components/common/OverlayModal';
import CreateLocationForm from '../components/common/CreateLocationForm';

import '../styles/create-asset.css';

type FormErrors = Partial<Record<keyof CreateAssetPayload | 'general' | 'estado', string>>;

const ESTADO_OPTIONS: { value: EstadoActivo; label: string }[] = [
  { value: 'OPERATIVO', label: 'Operativo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'FUERA_DE_SERVICIO', label: 'Fuera de Servicio' },
];

type Priority = 'CRITICO' | 'ALTO' | 'NORMAL';

/** Pre-fill data provided by the AI assistant when opening via deeplink. */
export interface AssetPrefillData {
  nombre?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  descripcion?: string;
  /** Direct category DB id — used when set by the AI wizard (preferred over categoriaNombre). */
  categoriaId?: string;
  /** Category name — resolved to an ID after catalogs load (fallback). */
  categoriaNombre?: string;
  /** Direct location DB id — preferred over ubicacionNombre. */
  ubicacionId?: string;
  /** Location name — resolved to an ID after catalogs load (fallback). */
  ubicacionNombre?: string;
  estado?: EstadoActivo;
}

export default function CreateAssetPage({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: AssetPrefillData | Record<string, string> }) {
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
  const [estado, setEstado] = useState<EstadoActivo | ''>('');
  const [ubicacionId, setUbicacionId] = useState('');
  const [areaActualId, setAreaActualId] = useState('');
  const [responsableActualId, setResponsableActualId] = useState('');
  const [prioridad, setPrioridad] = useState<Priority>('NORMAL');
  const [costoAdquisicion, setCostoAdquisicion] = useState('');
  const [fechaAdquisicion, setFechaAdquisicion] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  // ── Prefill: applied once after catalogs finish loading ──
  const [prefillApplied, setPrefillApplied] = useState(false);
  useEffect(() => {
    if (catalogsLoading || prefillApplied || !prefill) return;
    if (prefill.nombre) setNombre(prefill.nombre);
    if (prefill.marca) setMarca(prefill.marca);
    if (prefill.modelo) setModelo(prefill.modelo);
    if (prefill.numeroSerie) setNumeroSerie(prefill.numeroSerie);
    if (prefill.descripcion) setObservaciones(prefill.descripcion);
    if (prefill.estado && ['OPERATIVO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO'].includes(prefill.estado)) {
      setEstado(prefill.estado as EstadoActivo);
    }
    // Category: prefer direct id, fall back to name-based lookup
    if (prefill.categoriaId) {
      const match = categorias.find((c) => c.id === prefill.categoriaId);
      if (match) setCategoriaId(match.id);
    } else if (prefill.categoriaNombre) {
      const match = categorias.find(
        (c) => c.nombre.toLowerCase() === prefill.categoriaNombre!.toLowerCase(),
      );
      if (match) setCategoriaId(match.id);
    }
    // Location: prefer direct id, fall back to name-based lookup
    if (prefill.ubicacionId) {
      const match = ubicaciones.find((u) => u.id === prefill.ubicacionId);
      if (match) {
        setUbicacionId(match.id);
        setUbicacionSearch(match.nombre);
      }
    } else if (prefill.ubicacionNombre) {
      const match = ubicaciones.find(
        (u) => u.nombre.toLowerCase().includes(prefill.ubicacionNombre!.toLowerCase()),
      );
      if (match) {
        setUbicacionId(match.id);
        setUbicacionSearch(match.nombre);
      }
    }
    setPrefillApplied(true);
  }, [catalogsLoading, prefillApplied, prefill, categorias, ubicaciones]);

  // ── UI state ──
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // ── Code generation ──
  const [generatingCode, setGeneratingCode] = useState(false);

  // ── Location search with pattern ──
  const [ubicacionSearch, setUbicacionSearch] = useState('');
  const [ubicacionResults, setUbicacionResults] = useState<Ubicacion[]>([]);
  const [ubicacionDropdownOpen, setUbicacionDropdownOpen] = useState(false);
  const [searchingUbicaciones, setSearchingUbicaciones] = useState(false);
  const ubicacionWrapRef = useRef<HTMLDivElement>(null);

  // ── Create location modal ──
  const [showCreateLocation, setShowCreateLocation] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ubicacionWrapRef.current && !ubicacionWrapRef.current.contains(e.target as Node)) {
        setUbicacionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced location search
  useEffect(() => {
    if (!ubicacionSearch.trim()) {
      setUbicacionResults(ubicaciones);
      return;
    }
    const timer = setTimeout(() => {
      void searchLocationsByPattern(ubicacionSearch.trim());
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionSearch, ubicaciones]);

  const searchLocationsByPattern = useCallback(async (pattern: string) => {
    try {
      setSearchingUbicaciones(true);
      const res = await searchLocations({ pattern, pageSize: 20 });
      setUbicacionResults(res.data as unknown as Ubicacion[]);
    } catch {
      // Fallback to catalog data
      setUbicacionResults(ubicaciones.filter((u) =>
        u.nombre.toLowerCase().includes(pattern.toLowerCase()),
      ));
    } finally {
      setSearchingUbicaciones(false);
    }
  }, [ubicaciones]);

  /** Resets all form fields to their initial state; also revokes pending image blob URLs. */
  const resetForm = useCallback(() => {
    setCodigo('');
    setNombre('');
    setMarca('');
    setModelo('');
    setNumeroSerie('');
    setCategoriaId('');
    setEstado('');
    setUbicacionId('');
    setUbicacionSearch('');
    setAreaActualId('');
    setResponsableActualId('');
    setPrioridad('NORMAL');
    setCostoAdquisicion('');
    setFechaAdquisicion('');
    setProveedor('');
    setObservaciones('');
    setPendingImages((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.preview)); return []; });
    setErrors({});
    setTouched(new Set());
    setPrefillApplied(false);
  }, []);

  const handleGenerateCode = useCallback(async () => {
    try {
      setGeneratingCode(true);
      const res = await generateAssetCode();
      setCodigo(res.data.code);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo generar el código';
      notify.error('Error', message);
    } finally {
      setGeneratingCode(false);
    }
  }, [notify]);

  useEffect(() => {
    if (!codigo) {
      void handleGenerateCode();
    }
  }, [codigo, handleGenerateCode]);

  // Reset the form (and trigger CUA re-generation) every time the modal is opened
  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleLocationCreated(loc: LocationItem) {
    const newUbi: Ubicacion = {
      id: loc.id,
      nombre: loc.nombre,
      edificio: loc.edificio ?? undefined,
      piso: loc.piso ?? undefined,
      ambiente: loc.ambiente ?? undefined,
    };
    setUbicaciones((prev) => [newUbi, ...prev]);
    setUbicacionId(loc.id);
    setUbicacionSearch(loc.nombre);
    setShowCreateLocation(false);
    setUbicacionDropdownOpen(false);
  }

  function selectUbicacion(ubi: Ubicacion) {
    setUbicacionId(ubi.id);
    setUbicacionSearch([ubi.nombre, ubi.edificio, ubi.piso].filter(Boolean).join(' — '));
    markTouched('ubicacionId');
    setUbicacionDropdownOpen(false);
  }

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
    if (!ubicacionId) errs.ubicacionId = 'Debe seleccionar una ubicación';
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
    const allFields = ['codigo', 'nombre', 'categoriaId', 'ubicacionId', 'estado'];
    setTouched(new Set([...touched, ...allFields]));

    const validationErrors = validate();
    setErrors(validationErrors);

    if (generatingCode) {
      notify.warning('Generando código', 'Espere a que el sistema termine de generar el código único del activo.');
      return;
    }

    if (Object.keys(validationErrors).length > 0) {
      notify.warning('Formulario incompleto', 'Revise los campos marcados en rojo.');
      // Scroll al campo de estado si es el error
      if (validationErrors.ubicacionId) {
        document.getElementById('ubicacionSearch')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (validationErrors.estado) {
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
        ubicacionId,
      };

      if (marca.trim()) payload.marca = marca.trim();
      if (modelo.trim()) payload.modelo = modelo.trim();
      if (numeroSerie.trim()) payload.numeroSerie = numeroSerie.trim();
      if (costoAdquisicion) payload.costoAdquisicion = Number(costoAdquisicion);
      if (fechaAdquisicion) payload.fechaAdquisicion = fechaAdquisicion;
      if (areaActualId) payload.areaActualId = areaActualId;
      if (responsableActualId) payload.responsableActualId = responsableActualId;
      if (observaciones.trim()) payload.descripcion = observaciones.trim();
      if (estado) payload.estado = estado;

      const result = await createAsset(payload);
      if (pendingImages.length > 0 && result.data?.id) {
        try {
          await activosService.subirImagenes(result.data.id, pendingImages.map((p) => p.file));
        } catch {
          notify.warning('Activo registrado', 'No se pudieron subir algunas imágenes.');
        }
      }
      notify.success(result.message ?? 'Activo registrado exitosamente');
      onClose();
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
    <OverlayModal
      open={open}
      onClose={onClose}
      title="Registrar Nuevo Activo"
      subtitle="Complete los detalles técnicos y financieros para mantener el registro institucional actualizado."
      width="960px"
      disabled={submitting}
    >
      <form onSubmit={handleSubmit} className="createAssetForm" noValidate>
        {/* ── Section 1: Información General ── */}
        <div className="formSection">
          <div className="formSection__legend">
            <span className="formSection__icon"><IconClipboard size={18} /></span>
            <div>
              <span className="formSection__title">Información General</span>
              <span className="formSection__desc">Identificación básica y marca del activo universitario.</span>
            </div>
          </div>

          {/* Row 1: Código + Nombre */}
          <div className="formGrid formGrid--2">
            <div className={`formField ${getFieldError('codigo') ? 'formField--error' : ''}`}>
              <label htmlFor="codigo">
                Código Único de Activo (CUA) <span className="req">*</span>
              </label>
              <div className="formField__inputWrap">
                <input
                  id="codigo"
                  type="text"
                  placeholder={generatingCode ? 'Generando código único...' : 'Código generado automáticamente'}
                  value={codigo}
                  readOnly
                  maxLength={50}
                />
                <button
                  type="button"
                  className="formField__infoIcon"
                  onClick={handleGenerateCode}
                  disabled={generatingCode || submitting}
                  title={generatingCode ? 'Generando código…' : 'Generar nuevo código único'}
                  style={{ cursor: generatingCode ? 'wait' : 'pointer', background: 'none', border: 'none', padding: 0, fontSize: '16px' }}
                >
                  {generatingCode ? '⏳' : '↻'}
                </button>
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

          {/* Row 2: Marca + Modelo + Número de Serie */}
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

          {/* Row 3: Imágenes (full width) */}
          <div className="formField">
            <label>Imágenes del Activo</label>
            <ImageUploader
              images={pendingImages}
              onChange={setPendingImages}
              disabled={submitting}
            />
          </div>
        </div>

        {/* ── Section 2: Clasificación y Estado ── */}
        <div className="formSection">
          <div className="formSection__legend">
            <span className="formSection__icon"><IconTag size={18} /></span>
            <div>
              <span className="formSection__title">Clasificación y Estado</span>
              <span className="formSection__desc">Categorización para reportes y depreciación.</span>
            </div>
          </div>

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
        </div>

        {/* ── Section 3: Ubicación y Responsable ── */}
        <div className="formSection">
          <div className="formSection__legend">
            <span className="formSection__icon"><IconMapPin size={18} /></span>
            <div>
              <span className="formSection__title">Ubicación y Responsable</span>
              <span className="formSection__desc">¿Dónde se encuentra y quién responde por él?</span>
            </div>
          </div>

          <div className="formGrid formGrid--3">
            <div
              className={`formField ${getFieldError('ubicacionId') ? 'formField--error' : ''}`}
              ref={ubicacionWrapRef}
              style={{ position: 'relative' }}
            >
              <label htmlFor="ubicacionSearch">
                Ubicación <span className="req">*</span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  id="ubicacionSearch"
                  type="text"
                  placeholder={catalogsLoading ? 'Cargando ubicaciones...' : 'Buscar ubicación...'}
                  value={ubicacionSearch}
                  onChange={(e) => {
                    setUbicacionSearch(e.target.value);
                    setUbicacionDropdownOpen(true);
                    if (!e.target.value.trim()) {
                      setUbicacionId('');
                      markTouched('ubicacionId');
                    }
                  }}
                  onFocus={() => {
                    setUbicacionDropdownOpen(true);
                    if (!ubicacionSearch.trim()) setUbicacionResults(ubicaciones);
                  }}
                  onBlur={() => markTouched('ubicacionId')}
                  disabled={catalogsLoading}
                  autoComplete="off"
                  aria-invalid={Boolean(getFieldError('ubicacionId'))}
                />
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  style={{ flexShrink: 0, padding: '8px 12px' }}
                  onClick={() => setShowCreateLocation(true)}
                  title="Crear nueva ubicación"
                >
                  +
                </button>
              </div>
              {ubicacionDropdownOpen && (
                <div className="ubicacionDropdown">
                  {searchingUbicaciones ? (
                    <div className="ubicacionDropdown__item ubicacionDropdown__item--disabled">
                      Buscando...
                    </div>
                  ) : ubicacionResults.length === 0 ? (
                    <div className="ubicacionDropdown__item ubicacionDropdown__item--disabled">
                      Sin resultados
                    </div>
                  ) : (
                    ubicacionResults.map((ubi) => (
                      <div
                        key={ubi.id}
                        className={`ubicacionDropdown__item ${ubicacionId === ubi.id ? 'ubicacionDropdown__item--selected' : ''}`}
                        onClick={() => selectUbicacion(ubi)}
                      >
                        <strong>{ubi.nombre}</strong>
                        {ubi.edificio || ubi.piso ? (
                          <span className="ubicacionDropdown__meta">
                            {[ubi.edificio, ubi.piso ? `Piso ${ubi.piso}` : null].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )}
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
              >
                <option value="" disabled>-- Seleccione un estado --</option>
                {ESTADO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {getFieldError('estado') && (
                <span className="formField__error">{getFieldError('estado')}</span>
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
        </div>

        {/* ── Section 4: Financiero y Documentación ── */}
        <div className="formSection">
          <div className="formSection__legend">
            <span className="formSection__icon"><IconDollarSign size={18} /></span>
            <div>
              <span className="formSection__title">Financiero y Documentación</span>
              <span className="formSection__desc">Valor de adquisición, proveedores y soporte legal.</span>
            </div>
          </div>

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

        </div>

        {/* System Recommendation */}
        <div className="systemNote">
          <span className="systemNote__icon"><IconInfo size={18} /></span>
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
        <div className="overlayModal__footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { resetForm(); onClose(); }}
            disabled={submitting}
          >
            <IconX size={14} style={{ marginRight: '6px' }} /> Cancelar
          </button>
          <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
            {submitting ? 'Guardando...' : <><IconSave size={15} style={{ marginRight: '6px' }} />Guardar y Registrar</>}
          </button>
        </div>
      </form>

      {/* Create Location Modal */}
      <OverlayModal
        open={showCreateLocation}
        onClose={() => setShowCreateLocation(false)}
        title="Nueva Ubicación"
        subtitle="Registra una nueva ubicación para asignarla al activo."
      >
        <CreateLocationForm
          onCreated={handleLocationCreated}
          onCancel={() => setShowCreateLocation(false)}
        />
      </OverlayModal>
    </OverlayModal>
  );
}
