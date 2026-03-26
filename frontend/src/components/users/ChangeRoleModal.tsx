// frontend/src/components/users/ChangeRoleModal.tsx
import { useState, useEffect } from 'react';
import { getRoles, updateUserRole } from '../../services/user.service';
import { useAuth } from '../../context/AuthContext';

interface ChangeRoleModalProps {
  user: { id: string; nombres: string; apellidos: string };
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangeRoleModal({ user, onClose, onSuccess }: ChangeRoleModalProps) {
  const { user: currentUser } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Verificar si es ADMIN
  const isAdmin = currentUser?.rol?.nombre === 'ADMIN_GENERAL';

  // Si no es admin, cerrar el modal
  useEffect(() => {
    if (!isAdmin) {
      onClose();
    }
  }, [isAdmin, onClose]);

  useEffect(() => {
    // Intentamos traer los roles reales del backend
    getRoles()
      .then((data) => {
        if (data && data.length > 0) {
          setRoles(data);
        } else {
          // Si devuelve vacío, cargamos estos de prueba temporalmente
          cargarRolesDePrueba();
        }
      })
      .catch((err) => {
        console.error('Error al obtener roles del backend:', err);
        // Si el endpoint no existe aún, cargamos los de prueba
        cargarRolesDePrueba();
      });
  }, []);

  const cargarRolesDePrueba = () => {
    setRoles([
      { id: '1', nombre: 'ADMIN_GENERAL' },
      { id: '2', nombre: 'USUARIO_OPERATIVO' },
      { id: '3', nombre: 'RESPONSABLE_AREA' },
      { id: '4', nombre: 'AUDITOR' }  // NUEVO: Rol Auditor agregado
    ]);
  };

  const handleUpdate = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setError('');
    try {
      // Intentamos actualizar en el backend (user.id ya es string, no necesita toString)
      await updateUserRole(user.id, selectedRole);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Error al intentar actualizar el rol en el backend.');
    } finally {
      setLoading(false);
    }
  };

  // Si no es admin, no mostrar el modal
  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '12px',
        width: '400px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px', color: '#111827' }}>
          Cambiar Rol de Usuario
        </h3>
        <p style={{ color: '#4b5563', marginBottom: '20px', fontSize: '14px' }}>
          Asignar nuevo rol a: <br/>
          <strong style={{ color: '#2563eb', fontSize: '16px' }}>{user.nombres} {user.apellidos}</strong>
        </p>

        <select
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            marginBottom: '20px',
            fontSize: '14px'
          }}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="">Seleccione un rol...</option>
          {roles.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>

        {error && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#374151'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleUpdate}
            disabled={!selectedRole || loading}
            style={{
              padding: '8px 16px',
              backgroundColor: !selectedRole || loading ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: !selectedRole || loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Guardando...' : 'Confirmar Cambio'}
          </button>
        </div>
      </div>
    </div>
  );
}