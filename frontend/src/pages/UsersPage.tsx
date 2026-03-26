// frontend/src/pages/users/UsersPage.tsx
import { useState, useEffect } from 'react';
import { createUser, getRoles } from '../services/user.service';
import { useAuth } from '../context/AuthContext';

interface Rol {
  id: string;
  nombre: string;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Rol[]>([]);
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    nombreUsuario: '',
    password: '',
    telefono: '',
    areaId: '',
    rolId: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Verificar si el usuario actual tiene permiso para crear usuarios
  const canCreateUser = user?.rol?.nombre === 'ADMIN_GENERAL';

  // Cargar roles al montar el componente
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const rolesData = await getRoles();
        setRoles(rolesData);
        // Seleccionar el primer rol por defecto
        if (rolesData.length > 0) {
          setFormData(prev => ({ ...prev, rolId: rolesData[0].id }));
        }
      } catch (error) {
        console.error('Error cargando roles:', error);
      }
    };
    
    if (canCreateUser) {
      loadRoles();
    }
  }, [canCreateUser]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      await createUser({
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        correo: formData.correo,
        nombreUsuario: formData.nombreUsuario,
        password: formData.password,
        telefono: formData.telefono || undefined,
        areaId: formData.areaId || undefined,
        rolId: formData.rolId || undefined,
      });

      setMessage('Usuario creado correctamente');

      setFormData({
        nombres: '',
        apellidos: '',
        correo: '',
        nombreUsuario: '',
        password: '',
        telefono: '',
        areaId: '',
        rolId: roles[0]?.id || '',
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error al crear el usuario');
      }
    } finally {
      setLoading(false);
    }
  }

  // Si no tiene permiso para crear usuarios, mostrar mensaje de acceso denegado
  if (!canCreateUser) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-yellow-800 mb-2">Acceso Denegado</h1>
          <p className="text-yellow-700">
            No tienes permisos para crear usuarios. Contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px' }} className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gestión de Usuarios</h1>
      <h2 className="text-xl font-semibold mb-4">Crear Usuario</h2>

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="nombres" className="block mb-1 font-medium">Nombres</label>
          <input
            id="nombres"
            type="text"
            name="nombres"
            value={formData.nombres}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="apellidos" className="block mb-1 font-medium">Apellidos</label>
          <input
            id="apellidos"
            type="text"
            name="apellidos"
            value={formData.apellidos}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="correo" className="block mb-1 font-medium">Correo</label>
          <input
            id="correo"
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="nombreUsuario" className="block mb-1 font-medium">Nombre de usuario</label>
          <input
            id="nombreUsuario"
            type="text"
            name="nombreUsuario"
            value={formData.nombreUsuario}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" className="block mb-1 font-medium">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="telefono" className="block mb-1 font-medium">Teléfono</label>
          <input
            id="telefono"
            type="text"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="areaId" className="block mb-1 font-medium">Área ID</label>
          <input
            id="areaId"
            type="text"
            name="areaId"
            value={formData.areaId}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="rolId" className="block mb-1 font-medium">Rol</label>
          <select
            id="rolId"
            name="rolId"
            value={formData.rolId}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            className="border rounded-lg px-3 py-2"
            required
          >
            {roles.map(rol => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:bg-blue-300"
        >
          {loading ? 'Guardando...' : 'Guardar usuario'}
        </button>
      </form>

      {message && (
        <p style={{ color: 'green', marginTop: '1rem' }} className="text-green-600 mt-4">
          {message}
        </p>
      )}

      {error && (
        <p style={{ color: 'red', marginTop: '1rem' }} className="text-red-600 mt-4">
          {error}
        </p>
      )}
    </div>
  );
}