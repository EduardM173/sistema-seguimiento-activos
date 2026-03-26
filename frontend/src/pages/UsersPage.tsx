import { useState } from 'react';
import { createUser } from '../services/user.service';

export default function UsersPage() {
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    nombreUsuario: '',
    password: '',
    telefono: '',
    areaId: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
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

  return (
    <div style={{ maxWidth: '700px' }}>
      <h1>Gestión de Usuarios</h1>
      <h2>Crear Usuario</h2>

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="nombres">Nombres</label>
          <input
            id="nombres"
            type="text"
            name="nombres"
            value={formData.nombres}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="apellidos">Apellidos</label>
          <input
            id="apellidos"
            type="text"
            name="apellidos"
            value={formData.apellidos}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="correo">Correo</label>
          <input
            id="correo"
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="nombreUsuario">Nombre de usuario</label>
          <input
            id="nombreUsuario"
            type="text"
            name="nombreUsuario"
            value={formData.nombreUsuario}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            required
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            type="text"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="areaId">Área ID</label>
          <input
            id="areaId"
            type="text"
            name="areaId"
            value={formData.areaId}
            onChange={handleChange}
            style={{ display: 'block', width: '100%', padding: '0.5rem' }}
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar usuario'}
        </button>
      </form>

      {message && (
        <p style={{ color: 'green', marginTop: '1rem' }}>{message}</p>
      )}

      {error && (
        <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>
      )}
    </div>
  );
}