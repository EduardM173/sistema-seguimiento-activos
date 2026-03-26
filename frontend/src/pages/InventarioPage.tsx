import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CreateMaterialForm from '../components/inventory/CreateMaterialForm';
import MaterialsList from '../components/inventory/MaterialsList';
import '../styles/inventory.css';

export default function InventarioPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  console.log('InventarioPage - User:', user);

  // Solo permitir acceso a USUARIO_OPERATIVO
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

  if (user.rol?.nombre !== 'USUARIO_OPERATIVO') {
    return (
      <div className="access-denied">
        <div className="access-denied__content">
          <h2>Acceso Denegado</h2>
          <p>Solo los usuarios operativos pueden acceder a la gestión de inventario.</p>
          <p>Tu rol: {user.rol?.nombre || 'desconocido'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventarioPage">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Gestión de Inventario</h1>
            <p>Administra los materiales del sistema</p>
          </div>
          <button
            className="btn btn-primary btn-register"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Ocultar Formulario' : '+ Registrar Material'}
          </button>
        </div>
      </header>

      <div className="page-content">
        {showForm && (
          <div className="form-section">
            <CreateMaterialForm
              onSuccess={() => {
                setShowForm(false);
                setRefreshKey((prev) => prev + 1);
              }}
            />
          </div>
        )}

        <div className="list-section">
          <MaterialsList key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
