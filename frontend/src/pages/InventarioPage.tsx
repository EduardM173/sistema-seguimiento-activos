
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CreateMaterialForm from '../components/inventory/CreateMaterialForm';
import MaterialsList from '../components/inventory/MaterialsList';
import '../styles/assets.css';
import '../styles/inventory.css';

export default function InventarioPage() {
  const { user, hasPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  console.log('InventarioPage - User:', user);

  if (!user) {
    return (
      <div className="access-denied">
        <div className="access-denied__content">
          <h2>Cargando...</h2>
          <p>Esperando datos del usuario...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission('INVENTORY_MANAGE')) {
    return (
      <div className="access-denied">
        <div className="access-denied__content">
          <h2>Acceso Denegado</h2>
          <p>No tienes el permiso necesario para acceder a la gestión de inventario.</p>
          <p>Permiso requerido: INVENTORY_MANAGE</p>
        </div>
      </div>
    );
  }

  return (
    <section className="assetsPage">
      <header className="assetsPage__header">
        <div>
          <h1 className="assetsPage__title">Gestión de Inventario</h1>
          <p className="assetsPage__subtitle">Administra los materiales del sistema</p>
        </div>
        <div className="assetsPage__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Ocultar Formulario' : '+ Registrar Material'}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="assetsFilters">
          <CreateMaterialForm
            onSuccess={() => {
              setShowForm(false);
              setRefreshKey((prev) => prev + 1);
            }}
          />
        </div>
      )}

      <MaterialsList key={refreshKey} />
    </section>
  );
}
