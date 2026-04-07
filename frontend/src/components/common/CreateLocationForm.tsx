import { useState, type FormEvent } from 'react';
import { createLocation, type CreateLocationPayload, type LocationItem } from '../../services/locations.service';
import { useNotification } from '../../context/NotificationContext';
import { HttpError } from '../../services/http.client';

type Props = {
  onCreated: (location: LocationItem) => void;
  onCancel: () => void;
  submittingExternal?: boolean;
};

export default function CreateLocationForm({ onCreated, onCancel, submittingExternal }: Props) {
  const notify = useNotification();

  const [nombre, setNombre] = useState('');
  const [edificio, setEdificio] = useState('');
  const [piso, setPiso] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const busy = submitting || (submittingExternal ?? false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!nombre.trim()) {
      notify.error('Campo requerido', 'El nombre de la ubicación es obligatorio.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreateLocationPayload = { nombre: nombre.trim() };
      if (edificio.trim()) payload.edificio = edificio.trim();
      if (piso.trim()) payload.piso = piso.trim();
      if (ambiente.trim()) payload.ambiente = ambiente.trim();
      if (descripcion.trim()) payload.descripcion = descripcion.trim();

      const res = await createLocation(payload);
      notify.success('Ubicación creada', res.message ?? 'La ubicación se registró exitosamente.');
      onCreated(res.data);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'No se pudo crear la ubicación';
      notify.error('Error', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="createLocationForm" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="formField">
        <label htmlFor="loc-nombre">
          Nombre <span className="req">*</span>
        </label>
        <input
          id="loc-nombre"
          type="text"
          placeholder="Ej: Oficina de Sistemas"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={100}
          disabled={busy}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="formField">
          <label htmlFor="loc-edificio">Edificio</label>
          <input
            id="loc-edificio"
            type="text"
            placeholder="Ej: Bloque A"
            value={edificio}
            onChange={(e) => setEdificio(e.target.value)}
            maxLength={100}
            disabled={busy}
          />
        </div>
        <div className="formField">
          <label htmlFor="loc-piso">Piso</label>
          <input
            id="loc-piso"
            type="text"
            placeholder="Ej: 2"
            value={piso}
            onChange={(e) => setPiso(e.target.value)}
            maxLength={20}
            disabled={busy}
          />
        </div>
      </div>

      <div className="formField">
        <label htmlFor="loc-ambiente">Ambiente</label>
        <input
          id="loc-ambiente"
          type="text"
          placeholder="Ej: 201"
          value={ambiente}
          onChange={(e) => setAmbiente(e.target.value)}
          maxLength={50}
          disabled={busy}
        />
      </div>

      <div className="formField">
        <label htmlFor="loc-descripcion">Descripción</label>
        <textarea
          id="loc-descripcion"
          rows={2}
          placeholder="Descripción opcional de la ubicación"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={500}
          disabled={busy}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy || !nombre.trim()}>
          {submitting ? 'Guardando...' : 'Crear Ubicación'}
        </button>
      </div>
    </form>
  );
}
