// frontend/src/pages/users/UserList.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChangeRoleModal from '../../components/users/ChangeRoleModal';
import RolesMatrix from '../../components/users/RolesMatrix';
import { getUsers } from '../../services/user.service';
import type { User } from '../../types/user.types';

export default function UserList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Nuevos estados para la HU04
  const [activeTab, setActiveTab] = useState<'directorio' | 'roles'>('directorio');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const navigate = useNavigate();

  // Verificar si es ADMIN
  const isAdmin = currentUser?.rol?.nombre === 'ADMIN_GENERAL';

  // Sacamos loadUsers fuera del useEffect para poder recargar la lista desde el Modal
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getUsers();
      // Asegurarse de que data es un array
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error('La respuesta no es un array:', data);
        setUsers([]);
        setError('No se pudo cargar la lista de usuarios correctamente.');
      }
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setUsers([]);
      setError(err instanceof Error ? err.message : 'Ocurrió un error al cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter((user) =>
    `${user.nombres} ${user.apellidos} ${user.correo} ${user.nombreUsuario}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Gestión de Usuarios</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {activeTab === 'directorio' 
              ? 'Administra el acceso del personal universitario y configura permisos por roles.'
              : 'Configuración de la matriz de acceso y permisos por cada rol del sistema.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Botón de Logs de Seguridad - SOLO ADMIN */}
          {isAdmin && (
            <button
              style={{
                backgroundColor: 'white',
                color: '#374151',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Logs de Seguridad
            </button>
          )}

          {/* Botón Crear Usuario - SOLO ADMIN (PA: PROSIN-111) */}
          {isAdmin && (
            <button
              onClick={() => navigate('/users/create')}
              style={{
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              + Crear Usuario
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '20px' }}>
        <button 
          onClick={() => setActiveTab('directorio')}
          style={{ 
            border: 'none',
            borderBottom: activeTab === 'directorio' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'directorio' ? '#2563eb' : '#6b7280',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            paddingBottom: '12px',
            fontWeight: activeTab === 'directorio' ? '600' : '400',
            fontSize: '14px'
          }}
        >
          Directorio de Usuarios
        </button>
        {/* Pestaña Roles y Permisos - SOLO ADMIN (PA: PROSIN-111) */}
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('roles')}
            style={{ 
              border: 'none',
              borderBottom: activeTab === 'roles' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'roles' ? '#2563eb' : '#6b7280',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              paddingBottom: '12px',
              fontWeight: activeTab === 'roles' ? '600' : '400',
              fontSize: '14px'
            }}
          >
            Roles y Permisos
          </button>
        )}
      </div>

      {activeTab === 'directorio' ? (
        <>
          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              placeholder="Filtrar por nombre o email..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                width: '100%',
                maxWidth: '300px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {loading && (
            <div style={{ marginTop: '20px', textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#6b7280' }}>Cargando usuarios...</p>
            </div>
          )}

          {error && (
            <div style={{ marginTop: '20px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
              <p style={{ color: '#991b1b', margin: 0 }}>{error}</p>
              <button 
                onClick={loadUsers}
                style={{ marginTop: '8px', backgroundColor: '#991b1b', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div style={{ marginTop: '20px', textAlign: 'center', padding: '40px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <p style={{ color: '#6b7280' }}>No hay usuarios registrados.</p>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Nombre</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Usuario</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Rol</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Estado</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px' }}>{user.nombres} {user.apellidos}</td>
                        <td style={{ padding: '12px' }}>{user.nombreUsuario}</td>
                        <td style={{ padding: '12px' }}>{user.correo}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            display: 'inline-block'
                          }}>
                            {user.rol?.nombre || 'Sin rol'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            backgroundColor: user.estado === 'ACTIVO' ? '#dcfce7' : '#fee2e2',
                            color: user.estado === 'ACTIVO' ? '#166534' : '#991b1b',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            display: 'inline-block'
                          }}>
                            {user.estado || 'ACTIVO'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ cursor: 'pointer', marginRight: '12px' }} title="Editar">✏️</span>
                          <span style={{ cursor: 'pointer', marginRight: '12px' }} title="Ver">👁️</span>
                          {/* Botón Cambiar Rol - SOLO ADMIN (PA: PROSIN-112) */}
                          {isAdmin && (
                            <span 
                              onClick={() => setSelectedUser(user)}
                              style={{ 
                                color: '#2563eb', 
                                cursor: 'pointer', 
                                fontSize: '14px', 
                                fontWeight: '500'
                              }}
                            >
                              Cambiar Rol
                            </span>
                          )}
                          <span style={{ cursor: 'pointer', marginLeft: '12px' }}>⋯</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                        No hay usuarios que coincidan con el filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* MATRIZ DE PERMISOS - SOLO ADMIN la puede ver */
        isAdmin && <RolesMatrix />
      )}

      {/* Renderizado del Modal - SOLO ADMIN puede abrirlo */}
      {selectedUser && isAdmin && (
        <ChangeRoleModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          onSuccess={loadUsers} 
        />
      )}
    </div>
  );
}