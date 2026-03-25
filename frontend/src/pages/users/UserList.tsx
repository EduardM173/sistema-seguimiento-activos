import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch('http://localhost:3000/users');
        const data = await res.json();

        if (!Array.isArray(data)) {
          console.error('La respuesta de /users no es un arreglo:', data);
          setUsers([]);
          setError('No se pudo cargar la lista de usuarios correctamente.');
          return;
        }

        setUsers(data);
      } catch (err) {
        console.error('Error al cargar usuarios:', err);
        setUsers([]);
        setError('Ocurrió un error al cargar los usuarios.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const filteredUsers = users.filter((user) =>
    `${user.nombres} ${user.apellidos} ${user.correo} ${user.nombreUsuario}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Gestión de Usuarios</h1>
          <p>Administra el acceso del personal universitario y configura permisos por roles.</p>
        </div>

        <button
          onClick={() => navigate('/users/create')}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          + Crear Usuario
        </button>
      </div>

      <div style={{ marginTop: '20px', borderBottom: '1px solid #ccc' }}>
        <button style={{ marginRight: '20px', borderBottom: '2px solid #2563eb' }}>
          Directorio de Usuarios
        </button>
        <button style={{ color: '#888' }}>
          Roles y Permisos
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Filtrar por nombre o email..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '10px',
            width: '300px',
            borderRadius: '8px',
            border: '1px solid #ccc'
          }}
        />
      </div>

      {loading && <p style={{ marginTop: '20px' }}>Cargando usuarios...</p>}
      {error && <p style={{ marginTop: '20px', color: 'red' }}>{error}</p>}

      {!loading && !error && (
        <table
          style={{
            width: '100%',
            marginTop: '20px',
            borderCollapse: 'collapse'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Nombre</th>
              <th>Usuario</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>
                    {user.nombres} {user.apellidos}
                  </td>
                  <td>{user.nombreUsuario}</td>
                  <td>{user.correo}</td>
                  <td>
                    <span
                      style={{
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      Activo
                    </span>
                  </td>
                  <td>✏️ 👁️ ⋯</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>
                  No hay usuarios para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}