import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';

import { getAssetById, updateAsset } from '../../services/assets.service';
import { getCategorias, getUbicaciones, getAreas, getUsuarios } from '../../services/catalogs.service';
import { searchLocations, generateAssetCode, type LocationItem } from '../../services/locations.service';
import { useNotification } from '../../context/NotificationContext';
import { HttpError } from '../../services/http.client';
import type {
  UpdateAssetPayload,
  EstadoActivo,
  Categoria,
  Ubicacion,
  Area,
  UsuarioResumen,
} from '../../types/assets.types';

import OverlayModal from '../common/OverlayModal';
import CreateLocationForm from '../common/CreateLocationForm';

const ESTADO_OPTIONS: { value: EstadoActivo; label: string }[] = [
  { value: 'OPERATIVO', label: 'Operativo' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'FUERA_DE_SERVICIO', label: 'Fuera de Servicio' },
];

type Props = {
  assetId: string;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export default function EditAssetModal({ assetId, open, onClose, onUpdated }: Props) {
  const notify = useNotification();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Catalogs
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioResumen[]>([]);

  // Fields
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [estado, setEstado] = useState<EstadoActivo>('OPERATIVO');
  const [ubicacionId, setUbicacionId] = useState('');
  const [areaActualId, setAreaActualId] = useState('');
  const [responsableActualId, setResponsableActualId] = useState('');
  const [costoAdquisicion, setCostoAdquisicion] = useState('');
  const [fechaAdquisicion, setFechaAdquisicion] = useState('');
  const [initialTransferValues, setInitialTransferValues] = useState({
    ubicacionId: '',
    areaActualId: '',
    responsableActualId: '',
  });

  // Location search
  const [ubicacionSearch, setUbicacionSearch] = useState('');
  const [ubicacionResults, setUbicacionResults] = useState<Ubicacion[]>([]);
  const [ubicacionDropdownOpen, setUbicacionDropdownOpen] = useState(false);
  const [searchingUbicaciones, setSearchingUbicaciones] = useState(false);
  const ubicacionWrapRef = useRef<HTMLDivElement>(null);

  // Create location modal (nested)
  const [showCreateLocation, setShowCreateLocation] = useState(false);

  // Code generation
  const [generatingCode, setGeneratingCode] = useState(false);

  // Load asset + catalogs
  useEffect(() => {
    if (!open || !assetId) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [assetRes, cats, ubis, ars, usrs] = await Promise.all([
          getAssetById(assetId),
          getCategorias(),
          getUbicaciones(),
          getAreas(),
          getUsuarios(),
        ]);

        if (cancelled) return;

        const a = assetRes.data;
        setCategorias(cats);
        setUbicaciones(ubis);
        setAreas(ars);
        setUsuarios(usrs);

        setCodigo(a.codigo);
        setNombre(a.nombre);
        setDescripcion(a.descripcion ?? '');
        setMarca(a.marca ?? '');
        setModelo(a.modelo ?? '');
        setNumeroSerie(a.numeroSerie ?? '');
        setCategoriaId(a.categoria?.id ?? '');
        setEstado(a.estado as EstadoActivo);
        setUbicacionId(a.ubicacion?.id ?? '');
        setAreaActualId(a.area?.id ?? '');
        setResponsableActualId(a.responsableActual?.id ?? a.responsable?.id ?? '');
        setInitialTransferValues({
          ubicacionId: a.ubicacion?.id ?? '',
          areaActualId: a.area?.id ?? '',
          responsableActualId: a.responsableActual?.id ?? a.responsable?.id ?? '',
        });
        setCostoAdquisicion(a.costoAdquisicion != null ? String(a.costoAdquisicion) : '');
        setFechaAdquisicion(a.fechaAdquisicion ? a.fechaAdquisicion.substring(0, 10) : '');

        // Set location search display
        if (a.ubicacion) {
          const ubi = ubis.find((u: Ubicacion) => u.id === a.ubicacion!.id);
          if (ubi) {
            setUbicacionSearch([ubi.nombre, ubi.edificio, ubi.piso].filter(Boolean).join(' — '));
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof HttpError ? err.message : 'No se pudo cargar el activo';
          notify.error('Error', message);
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetId]);

  // Close ubicacion dropdown on outside click
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
      void doSearchLocations(ubicacionSearch.trim());
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ubicacionSearch, ubicaciones]);

  const doSearchLocations = useCallback(async (pattern: string) => {
    try {
      setSearchingUbicaciones(true);
      const res = await searchLocations({ pattern, pageSize: 20 });
      setUbicacionResults(res.data as unknown as Ubicacion[]);
    } catch {
      setUbicacionResults(ubicaciones.filter((u) =>
        u.nombre.toLowerCase().includes(pattern.toLowerCase()),
      ));
    } finally {
      setSearchingUbicaciones(false);
    }
  }, [ubicaciones]);

  function selectUbicacion(ubi: Ubicacion) {
    setUbicacionId(ubi.id);
    setUbicacionSearch([ubi.nombre, ubi.edificio, ubi.piso].filter(Boolean).join(' — '));
    setUbicacionDropdownOpen(false);
  }

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

  async function handleGenerateCode() {
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
  }

  const codigoError = !codigo.trim() ? 'El código del activo es obligatorio.' : '';
  const nombreError = !nombre.trim() ? 'El nombre del activo es obligatorio.' : '';
  const categoriaError = !categoriaId ? 'La categoría del activo es obligatoria.' : '';
  const hasRequiredErrors = Boolean(codigoError || nombreError || categoriaError);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (hasRequiredErrors) {
      notify.warning(
        'Formulario incompleto',
        'Complete código, nombre y categoría antes de guardar la actualización.',
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload: UpdateAssetPayload = {};
      const normalizedUbicacionId = ubicacionId.trim();
      const normalizedAreaActualId = areaActualId.trim();
      const normalizedResponsableActualId = responsableActualId.trim();

      if (normalizedUbicacionId !== initialTransferValues.ubicacionId) {
        payload.ubicacionId = normalizedUbicacionId;
      }

      if (normalizedAreaActualId !== initialTransferValues.areaActualId) {
        payload.areaActualId = normalizedAreaActualId;
      }

      if (
        normalizedResponsableActualId !== initialTransferValues.responsableActualId
      ) {
        payload.responsableActualId = normalizedResponsableActualId;
      }

      if (Object.keys(payload).length === 0) {
        notify.warning(
          'Sin cambios',
          'No se detectaron cambios en área, ubicación o asignado a.',
        );
        return;
      }

      const res = await updateAsset(assetId, payload);
      notify.success(res.message ?? 'Activo actualizado exitosamente');
      onUpdated();
      onClose();
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo actualizar el activo';
      notify.error('Error al actualizar', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <OverlayModal
        open={open}
        onClose={onClose}
        title="Editar Activo"
        subtitle={loading ? 'Cargando...' : `${codigo} · ${nombre}`}
        width="680px"
        disabled={submitting}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            Cargando información del activo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Código + Nombre */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className={`formField ${codigoError ? 'formField--error' : ''}`}>
                <label htmlFor="edit-codigo">Código <span className="req">*</span></label>
                <div className="formField__inputWrap">
                  <input
                    id="edit-codigo"
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    maxLength={50}
                    disabled={submitting}
                    required
                    aria-invalid={Boolean(codigoError)}
                  />
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    style={{ marginLeft: '8px', flexShrink: 0 }}
                    onClick={handleGenerateCode}
                    disabled={generatingCode || submitting}
                  >
                    {generatingCode ? '⏳' : '🔄'}
                  </button>
                </div>
                {codigoError ? <span className="formField__error">{codigoError}</span> : null}
              </div>
              <div className={`formField ${nombreError ? 'formField--error' : ''}`}>
                <label htmlFor="edit-nombre">Nombre <span className="req">*</span></label>
                <input
                  id="edit-nombre"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={200}
                  disabled={submitting}
                  required
                  aria-invalid={Boolean(nombreError)}
                />
                {nombreError ? <span className="formField__error">{nombreError}</span> : null}
              </div>
            </div>

            {/* Marca + Modelo + Serie */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="formField">
                <label htmlFor="edit-marca">Marca</label>
                <input id="edit-marca" type="text" value={marca} onChange={(e) => setMarca(e.target.value)} disabled={submitting} />
              </div>
              <div className="formField">
                <label htmlFor="edit-modelo">Modelo</label>
                <input id="edit-modelo" type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={submitting} />
              </div>
              <div className="formField">
                <label htmlFor="edit-serie">N° Serie</label>
                <input id="edit-serie" type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} disabled={submitting} />
              </div>
            </div>

            {/* Categoría + Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className={`formField ${categoriaError ? 'formField--error' : ''}`}>
                <label htmlFor="edit-categoria">Categoría <span className="req">*</span></label>
                <select
                  id="edit-categoria"
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  disabled={submitting}
                  required
                  aria-invalid={Boolean(categoriaError)}
                >
                  <option value="">Seleccionar</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                {categoriaError ? <span className="formField__error">{categoriaError}</span> : null}
              </div>
              <div className="formField">
                <label htmlFor="edit-estado">Estado</label>
                <select id="edit-estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoActivo)} disabled={submitting}>
                  {ESTADO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ubicación searchable + Área */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="formField" ref={ubicacionWrapRef} style={{ position: 'relative' }}>
                <label htmlFor="edit-ubicacion">Ubicación</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    id="edit-ubicacion"
                    type="text"
                    placeholder="Buscar ubicación..."
                    value={ubicacionSearch}
                    onChange={(e) => {
                      setUbicacionSearch(e.target.value);
                      setUbicacionDropdownOpen(true);
                      if (!e.target.value.trim()) setUbicacionId('');
                    }}
                    onFocus={() => {
                      setUbicacionDropdownOpen(true);
                      if (!ubicacionSearch.trim()) setUbicacionResults(ubicaciones);
                    }}
                    disabled={submitting}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    style={{ flexShrink: 0, padding: '8px 12px' }}
                    onClick={() => setShowCreateLocation(true)}
                    disabled={submitting}
                  >
                    +
                  </button>
                </div>
                {ubicacionDropdownOpen && (
                  <div className="ubicacionDropdown">
                    {searchingUbicaciones ? (
                      <div className="ubicacionDropdown__item ubicacionDropdown__item--disabled">Buscando...</div>
                    ) : ubicacionResults.length === 0 ? (
                      <div className="ubicacionDropdown__item ubicacionDropdown__item--disabled">Sin resultados</div>
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
                <label htmlFor="edit-area">Área</label>
                <select id="edit-area" value={areaActualId} onChange={(e) => setAreaActualId(e.target.value)} disabled={submitting}>
                  <option value="">Seleccionar</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Asignado a */}
            <div className="formField">
              <label htmlFor="edit-responsable">Asignado a</label>
              <select id="edit-responsable" value={responsableActualId} onChange={(e) => setResponsableActualId(e.target.value)} disabled={submitting}>
                <option value="">Seleccionar</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombreCompleto}{u.area ? ` — ${u.area.nombre}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Costo + Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="formField">
                <label htmlFor="edit-costo">Valor de Adquisición ($)</label>
                <input id="edit-costo" type="number" min="0" step="0.01" value={costoAdquisicion} onChange={(e) => setCostoAdquisicion(e.target.value)} disabled={submitting} />
              </div>
              <div className="formField">
                <label htmlFor="edit-fecha">Fecha de Adquisición</label>
                <input id="edit-fecha" type="date" value={fechaAdquisicion} onChange={(e) => setFechaAdquisicion(e.target.value)} disabled={submitting} />
              </div>
            </div>

            {/* Descripción */}
            <div className="formField">
              <label htmlFor="edit-descripcion">Observaciones</label>
              <textarea
                id="edit-descripcion"
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={500}
                disabled={submitting}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={submitting || hasRequiredErrors}
              >
                {submitting ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </OverlayModal>

      {/* Nested Create Location Modal */}
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
    </>
  );
}
