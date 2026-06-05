import { useEffect, useState } from 'react';
import { IconRefresh, IconSave, IconSearch, IconUsers } from '../../components/common/Icon';
import {
  createSupplier,
  getSuppliers,
  Supplier,
  SupplierForm,
} from '../../services/supplier.service';
import '../../styles/suppliers.css';

const initialForm: SupplierForm = {
  nombre: '',
  nit: '',
  contacto: '',
  telefono: '',
  correo: '',
  direccion: '',
  rubro: '',
  observaciones: '',
};

export default function SuppliersPage() {
  const [form, setForm] = useState<SupplierForm>(initialForm);
  const [query, setQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await getSuppliers(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores');
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof SupplierForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await createSupplier(form);
      setForm(initialForm);
      setSuccess('Proveedor registrado correctamente');
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el proveedor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="suppliersPage">
      <header className="suppliersHeader">
        <div>
          <p>Compras</p>
          <h1>Registro de proveedores</h1>
          <span>Administra proveedores externos para compras universitarias.</span>
        </div>
        <button className="suppliersButton suppliersButton--ghost" onClick={() => void loadSuppliers()}>
          <IconRefresh size={16} />
          Actualizar
        </button>
      </header>

      {error ? <div className="suppliersAlert suppliersAlert--error">{error}</div> : null}
      {success ? <div className="suppliersAlert suppliersAlert--success">{success}</div> : null}

      <div className="suppliersLayout">
        <form className="suppliersForm" onSubmit={submit}>
          <h2>Nuevo proveedor</h2>
          <div className="suppliersForm__grid">
            <label>
              Nombre
              <input value={form.nombre} onChange={(event) => updateField('nombre', event.target.value)} required />
            </label>
            <label>
              NIT
              <input value={form.nit} onChange={(event) => updateField('nit', event.target.value)} />
            </label>
            <label>
              Contacto
              <input value={form.contacto} onChange={(event) => updateField('contacto', event.target.value)} />
            </label>
            <label>
              Teléfono
              <input value={form.telefono} onChange={(event) => updateField('telefono', event.target.value)} />
            </label>
            <label>
              Correo
              <input type="email" value={form.correo} onChange={(event) => updateField('correo', event.target.value)} />
            </label>
            <label>
              Rubro
              <input value={form.rubro} onChange={(event) => updateField('rubro', event.target.value)} />
            </label>
          </div>
          <label>
            Dirección
            <input value={form.direccion} onChange={(event) => updateField('direccion', event.target.value)} />
          </label>
          <label>
            Observaciones
            <textarea value={form.observaciones} onChange={(event) => updateField('observaciones', event.target.value)} />
          </label>
          <button className="suppliersButton suppliersButton--primary" disabled={saving}>
            <IconSave size={16} />
            {saving ? 'Guardando...' : 'Registrar proveedor'}
          </button>
        </form>

        <section className="suppliersList">
          <div className="suppliersList__top">
            <h2>Proveedores</h2>
            <form
              className="suppliersSearch"
              onSubmit={(event) => {
                event.preventDefault();
                void loadSuppliers();
              }}
            >
              <IconSearch size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proveedor" />
            </form>
          </div>

          <div className="suppliersTable">
            {suppliers.map((supplier) => (
              <article key={supplier.id} className="suppliersRow">
                <div className="suppliersRow__icon">
                  <IconUsers size={18} />
                </div>
                <div>
                  <strong>{supplier.nombre}</strong>
                  <span>{supplier.rubro || 'Sin rubro'} · {supplier.nit || 'Sin NIT'}</span>
                </div>
                <div>
                  <small>{supplier.contacto || 'Sin contacto'}</small>
                  <small>{supplier.telefono || supplier.correo || 'Sin canal registrado'}</small>
                </div>
              </article>
            ))}
          </div>

          {!loading && suppliers.length === 0 ? (
            <div className="suppliersEmpty">No hay proveedores registrados.</div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
