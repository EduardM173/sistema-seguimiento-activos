// frontend/src/components/users/RolesMatrix.tsx
import React, { useState, useEffect } from 'react';
import { getRolesForSelect, getPermisosByRol, updatePermisos } from '../../services/user.service';
import { useAuth } from '../../context/AuthContext';

interface PermisosState {
  [modulo: string]: {
    ver: boolean;
    crear: boolean;
    actualizar: boolean;
    eliminar: boolean;
  };
}

const RolesMatrix = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedRol, setSelectedRol] = useState<string>('');
  const [permisos, setPermisos] = useState<PermisosState>({});
  const [modulos, setModulos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Verificar si el usuario actual es ADMIN_GENERAL
  const isAdmin = user?.rol?.nombre === 'ADMIN_GENERAL';

  // Cargar roles al montar el componente
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoadingRoles(true);
      console.log('Cargando roles...');
      const rolesData = await getRolesForSelect();
      console.log('Roles cargados:', rolesData);
      setRoles(rolesData);
      if (rolesData.length > 0) {
        setSelectedRol(rolesData[0].id);
        await loadPermisos(rolesData[0].id);
      } else {
        setMessage({ type: 'error', text: 'No hay roles disponibles en el sistema' });
      }
    } catch (error) {
      console.error('Error cargando roles:', error);
      setMessage({ type: 'error', text: `Error al cargar los roles: ${error instanceof Error ? error.message : 'Error desconocido'}` });
    } finally {
      setLoadingRoles(false);
    }
  };

  const loadPermisos = async (rolId: string) => {
    try {
      setLoading(true);
      console.log('Cargando permisos para rol:', rolId);
      const data = await getPermisosByRol(rolId);
      console.log('Permisos cargados:', data);
      setPermisos(data.permisos);
      const modulosList = Object.keys(data.permisos).sort();
      setModulos(modulosList);
      if (modulosList.length === 0) {
        setMessage({ type: 'error', text: 'No hay módulos configurados para este rol' });
      } else {
        setMessage(null);
      }
    } catch (error) {
      console.error('Error cargando permisos:', error);
      setMessage({ type: 'error', text: `Error al cargar los permisos: ${error instanceof Error ? error.message : 'Error desconocido'}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRolChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newRolId = event.target.value;
    setSelectedRol(newRolId);
    loadPermisos(newRolId);
    setMessage(null);
  };

  const handlePermisoChange = (modulo: string, accion: 'ver' | 'crear' | 'actualizar' | 'eliminar', value: boolean) => {
    setPermisos(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [accion]: value,
      },
    }));
  };

  const handleGuardar = async () => {
    if (!selectedRol) return;
    
    try {
      setSaving(true);
      await updatePermisos(selectedRol, permisos);
      setMessage({ type: 'success', text: 'Permisos actualizados correctamente' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error guardando permisos:', error);
      setMessage({ type: 'error', text: `Error al guardar los permisos: ${error instanceof Error ? error.message : 'Error desconocido'}` });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const getRolNombre = () => {
    const rol = roles.find(r => r.id === selectedRol);
    return rol?.nombre || 'Seleccionado';
  };

  if (loadingRoles) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mt-4">
        <div className="text-center py-8">
          <p className="text-gray-500">Cargando roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mt-4 text-slate-700">
      {/* Selector de Rol */}
      <div className="mb-6">
        <label htmlFor="rol-select" className="block text-sm font-medium text-gray-700 mb-2">
          Seleccionar Rol
        </label>
        <select
          id="rol-select"
          value={selectedRol}
          onChange={handleRolChange}
          className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={!isAdmin || roles.length === 0}
        >
          {roles.length === 0 ? (
            <option value="">No hay roles disponibles</option>
          ) : (
            roles.map(rol => (
              <option key={rol.id} value={rol.id}>
                {rol.nombre}
              </option>
            ))
          )}
        </select>
        {!isAdmin && (
          <p className="text-sm text-amber-600 mt-2">
            ⚠️ Solo el administrador puede editar los permisos
          </p>
        )}
      </div>

      {/* Título del Rol Seleccionado */}
      <h3 className="text-xl font-bold mb-6 text-slate-800">
        Permisos - {getRolNombre()}
      </h3>

      {/* Mensaje de éxito/error */}
      {message && (
        <div className={`mt-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabla de Permisos */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Cargando permisos...</p>
        </div>
      ) : modulos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 text-sm uppercase">
                <th className="py-3 px-2">#</th>
                <th className="py-3 px-2">Módulo</th>
                <th className="py-3 px-2 text-center">Ver</th>
                <th className="py-3 px-2 text-center">Crear</th>
                <th className="py-3 px-2 text-center">Actualizar</th>
                <th className="py-3 px-2 text-center">Eliminar</th>
                </tr>
            </thead>
            <tbody>
              {modulos.map((modulo, idx) => (
                <tr key={modulo} className="border-b border-gray-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-2">{idx + 1}</td>
                  <td className="py-4 px-2 font-semibold">{modulo}</td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={permisos[modulo]?.ver || false}
                      onChange={(e) => handlePermisoChange(modulo, 'ver', e.target.checked)}
                      disabled={!isAdmin}
                      className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={permisos[modulo]?.crear || false}
                      onChange={(e) => handlePermisoChange(modulo, 'crear', e.target.checked)}
                      disabled={!isAdmin}
                      className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={permisos[modulo]?.actualizar || false}
                      onChange={(e) => handlePermisoChange(modulo, 'actualizar', e.target.checked)}
                      disabled={!isAdmin}
                      className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-4 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={permisos[modulo]?.eliminar || false}
                      onChange={(e) => handlePermisoChange(modulo, 'eliminar', e.target.checked)}
                      disabled={!isAdmin}
                      className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No hay módulos configurados para este rol</p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={handleGuardar}
          disabled={!isAdmin || saving || modulos.length === 0}
          className={`px-8 py-2 rounded-lg font-bold flex items-center gap-2 ${
            !isAdmin || saving || modulos.length === 0
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <span>✓</span> {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
};

export default RolesMatrix;