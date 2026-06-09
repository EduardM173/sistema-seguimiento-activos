import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, EmptyState, FormField, PageHeader, Section } from '../../components/common';
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

  async function submit(event: FormEvent) {
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
      <PageHeader
        eyebrow="Compras"
        title="Registro de proveedores"
        subtitle="Administra proveedores externos para compras universitarias."
        actions={
          <Button
            label="Actualizar"
            variant="ghost"
            icon={<IconRefresh size={16} />}
            onClick={() => void loadSuppliers()}
          />
        }
      />

      {error ? <Alert type="error" message={error} onClose={() => setError(null)} /> : null}
      {success ? <Alert type="success" message={success} onClose={() => setSuccess(null)} /> : null}

      <div className="suppliersLayout">
        <Section title="Nuevo proveedor" className="suppliersForm" noDivider>
          <form className="suppliersForm__body" onSubmit={submit}>
          <div className="suppliersForm__grid">
            <FormField
              id="supplier-nombre"
              label="Nombre"
              value={form.nombre}
              onChange={(event) => updateField('nombre', event.target.value)}
              required
            />
            <FormField
              id="supplier-nit"
              label="NIT"
              value={form.nit}
              onChange={(event) => updateField('nit', event.target.value)}
            />
            <FormField
              id="supplier-contacto"
              label="Contacto"
              value={form.contacto}
              onChange={(event) => updateField('contacto', event.target.value)}
            />
            <FormField
              id="supplier-telefono"
              label="Teléfono"
              value={form.telefono}
              onChange={(event) => updateField('telefono', event.target.value)}
            />
            <FormField
              id="supplier-correo"
              label="Correo"
              type="email"
              value={form.correo}
              onChange={(event) => updateField('correo', event.target.value)}
            />
            <FormField
              id="supplier-rubro"
              label="Rubro"
              value={form.rubro}
              onChange={(event) => updateField('rubro', event.target.value)}
            />
          </div>
          <FormField
            id="supplier-direccion"
            label="Dirección"
            value={form.direccion}
            onChange={(event) => updateField('direccion', event.target.value)}
          />
          <FormField
            id="supplier-observaciones"
            label="Observaciones"
            as="textarea"
            value={form.observaciones}
            onChange={(event) => updateField('observaciones', event.target.value)}
          />
          <Button
            type="submit"
            label={saving ? 'Guardando...' : 'Registrar proveedor'}
            icon={<IconSave size={16} />}
            isLoading={saving}
          />
          </form>
        </Section>

        <Section
          title="Proveedores"
          className="suppliersList"
          actions={
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
          }
        >

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
            <EmptyState
              icon={<IconUsers size={18} />}
              title="No hay proveedores registrados"
              message="Registra el primer proveedor para habilitar compras y solicitudes."
            />
          ) : null}
        </Section>
      </div>
    </main>
  );
}
