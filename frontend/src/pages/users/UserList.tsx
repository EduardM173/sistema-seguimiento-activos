import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  createRole,
  getPermissions,
  getRoles,
  getUsers,
  updateRolePermissions,
  updateUserRole,
} from '../../services/user.service';

import type { Permission, Role, User } from '../../types/user.types';

type TabKey = 'users' | 'roles';

type PermissionMatrixState = Record<string, Record<string, boolean>>;

export default function UserList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [permissionMatrix, setPermissionMatrix] =
    useState<PermissionMatrixState>({});
  const [savingMatrix, setSavingMatrix] = useState(false);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePermissionIds, setNewRolePermissionIds] = useState<string[]>([]);
  const [creatingRole, setCreatingRole] = useState(false);

  const canManageRoles = Boolean(
    authUser?.permisos?.some((permission) => permission.codigo === 'ROLE_ASSIGN'),
  );

  function buildMatrixState(rolesData: Role[]): PermissionMatrixState {
    const nextMatrix: PermissionMatrixState = {};

    for (const role of rolesData) {
      nextMatrix[role.id] = {};

      for (const permission of permissions) {
        nextMatrix[role.id][permission.id] = Boolean(
          role.permisos?.some((item) => item.id === permission.id),
        );
      }
    }

    return nextMatrix;
  }

  async function loadAllData() {
    try {
      setLoading(true);
      setError('');

      const [usersData, rolesData, permissionsData] = await Promise.all([
        getUsers(),
        getRoles(),
        getPermissions(),
      ]);

      setUsers(usersData);
      setRoles(rolesData);
      setPermissions(permissionsData);

      const initialSelectedRoles: Record<string, string> = {};
      for (const currentUser of usersData) {
        initialSelectedRoles[currentUser.id] =
          currentUser.rol?.id || currentUser.rolId || '';
      }
      setSelectedRoles(initialSelectedRoles);

      const matrix: PermissionMatrixState = {};
      for (const role of rolesData) {
        matrix[role.id] = {};

        for (const permission of permissionsData) {
          matrix[role.id][permission.id] = Boolean(
            role.permisos?.some((item) => item.id === permission.id),
          );
        }
      }
      setPermissionMatrix(matrix);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al cargar usuarios, roles y permisos.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    const state = location.state as { successMessage?: string } | null;

    if (state?.successMessage) {
      setSuccessMessage(state.successMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  function getMissingUserFields(user: User) {
    const missing: string[] = [];

    if (!user.apellidos?.trim()) {
      missing.push('apellidos');
    }

    if (!user.telefono?.trim()) {
      missing.push('telefono');
    }

    return missing;
  }

  const filteredUsers = useMemo(() => {
    return users.filter((currentUser) =>
      `${currentUser.nombres} ${currentUser.apellidos} ${currentUser.correo} ${currentUser.nombreUsuario} ${currentUser.rol?.nombre || ''}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  }, [users, filter]);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) =>
      `${role.nombre} ${role.descripcion || ''}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  }, [roles, filter]);

  function clearMessages() {
    setError('');
    setSuccessMessage('');
  }

  function handleSelectedRoleChange(userId: string, rolId: string) {
    setSelectedRoles((prev) => ({
      ...prev,
      [userId]: rolId,
    }));
  }

  async function handleSaveRole(targetUser: User) {
    try {
      clearMessages();

      const newRoleId = selectedRoles[targetUser.id];

      if (!newRoleId) {
        setError('Debes seleccionar un rol antes de guardar.');
        return;
      }

      const currentRoleId = targetUser.rol?.id || targetUser.rolId;

      if (currentRoleId === newRoleId) {
        setError('El usuario ya tiene asignado ese rol.');
        return;
      }

      setSavingUserId(targetUser.id);

      const result = await updateUserRole(targetUser.id, { rolId: newRoleId });

      setUsers((prev) =>
        prev.map((item) => (item.id === targetUser.id ? result.user : item)),
      );

      setSelectedRoles((prev) => ({
        ...prev,
        [targetUser.id]: result.user.rol?.id || result.user.rolId || '',
      }));

      setSuccessMessage(
        `Rol actualizado para ${result.user.nombres} ${result.user.apellidos}.`,
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el rol.');
    } finally {
      setSavingUserId(null);
    }
  }

  function toggleMatrixPermission(roleId: string, permissionId: string) {
    setPermissionMatrix((prev) => ({
      ...prev,
      [roleId]: {
        ...(prev[roleId] ?? {}),
        [permissionId]: !prev[roleId]?.[permissionId],
      },
    }));
  }

  async function handleSaveMatrix() {
    try {
      clearMessages();
      setSavingMatrix(true);

      const changedRoles = roles.filter((role) => {
        const currentPermissionIds = new Set((role.permisos ?? []).map((p) => p.id));
        const nextPermissionIds = new Set(
          permissions
            .filter((permission) => permissionMatrix[role.id]?.[permission.id])
            .map((permission) => permission.id),
        );

        if (currentPermissionIds.size !== nextPermissionIds.size) {
          return true;
        }

        for (const permissionId of currentPermissionIds) {
          if (!nextPermissionIds.has(permissionId)) {
            return true;
          }
        }

        return false;
      });

      if (changedRoles.length === 0) {
        setSuccessMessage('No hay cambios pendientes en la matriz.');
        return;
      }

      await Promise.all(
        changedRoles.map((role) => {
          const permisoIds = permissions
            .filter((permission) => permissionMatrix[role.id]?.[permission.id])
            .map((permission) => permission.id);

          return updateRolePermissions(role.id, { permisoIds });
        }),
      );

      const updatedRoles = await getRoles();
      setRoles(updatedRoles);

      const refreshedMatrix: PermissionMatrixState = {};
      for (const role of updatedRoles) {
        refreshedMatrix[role.id] = {};
        for (const permission of permissions) {
          refreshedMatrix[role.id][permission.id] = Boolean(
            role.permisos?.some((item) => item.id === permission.id),
          );
        }
      }
      setPermissionMatrix(refreshedMatrix);

      setSuccessMessage('La matriz de permisos fue actualizada correctamente.');
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los cambios de la matriz.',
      );
    } finally {
      setSavingMatrix(false);
    }
  }

  function toggleNewRolePermission(permissionId: string) {
    setNewRolePermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  }

  async function handleCreateRole() {
    try {
      clearMessages();

      if (!newRoleName.trim()) {
        setError('Debes escribir el nombre del nuevo rol.');
        return;
      }

      setCreatingRole(true);

      await createRole({
        nombre: newRoleName,
        descripcion: newRoleDescription,
        permisoIds: newRolePermissionIds,
      });

      const updatedRoles = await getRoles();
      setRoles(updatedRoles);
      setPermissionMatrix(buildMatrixState(updatedRoles));

      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePermissionIds([]);

      setSuccessMessage('Rol creado correctamente.');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'No se pudo crear el rol.');
    } finally {
      setCreatingRole(false);
    }
  }

  const sectionCardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '14px',
    padding: '18px',
    marginTop: '20px',
  };

  const renderUsersTab = () => {
    if (loading) {
      return <p style={{ marginTop: '20px' }}>Cargando usuarios...</p>;
    }

    return (
      <div style={sectionCardStyle}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Nombre</th>
              <th style={{ padding: '12px' }}>Usuario</th>
              <th style={{ padding: '12px' }}>Correo</th>
              <th style={{ padding: '12px' }}>Rol</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((currentUser) => {
                const missingFields = getMissingUserFields(currentUser);
                const isIncomplete = missingFields.length > 0;

                return (
                  <tr
                    key={currentUser.id}
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  >
                  <td style={{ padding: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>
                        {currentUser.nombres} {currentUser.apellidos}
                      </span>
                      {isIncomplete && (
                        <span
                          title={`Datos incompletos: ${missingFields.join(', ')}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '999px',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            fontSize: '13px',
                            fontWeight: 700,
                          }}
                        >
                          !
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>{currentUser.nombreUsuario}</td>
                  <td style={{ padding: '12px' }}>{currentUser.correo}</td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        backgroundColor: '#eff6ff',
                        color: '#1d4ed8',
                        padding: '4px 8px',
                        borderRadius: '999px',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      {currentUser.rol?.nombre || 'Sin rol'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor:
                            currentUser.estado === 'ACTIVO' ? '#dcfce7' : '#fee2e2',
                          color:
                            currentUser.estado === 'ACTIVO' ? '#166534' : '#991b1b',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        {currentUser.estado || 'Sin estado'}
                      </span>
                      {isIncomplete && (
                        <span
                          style={{
                            color: '#b45309',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Incompleto
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <button
                        type="button"
                        title={
                          isIncomplete
                            ? 'Completar datos faltantes'
                            : 'Editar usuario'
                        }
                        onClick={() => navigate(`/users/${currentUser.id}/edit`)}
                        style={{
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        ✏️
                      </button>
                      <span title="Vista previa no disponible aun">👁️</span>
                      <span title="Mas acciones">⋯</span>
                    </div>
                  </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center' }}>
                  No hay usuarios para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRolesTab = () => {
    if (loading) {
      return <p style={{ marginTop: '20px' }}>Cargando roles y permisos...</p>;
    }

    if (!canManageRoles) {
      return (
        <div style={sectionCardStyle}>
          <p style={{ margin: 0, color: '#9a3412' }}>
            No tienes el permiso necesario para gestionar roles y permisos.
          </p>
        </div>
      );
    }

    return (
      <>
        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Asignación de roles a usuarios</h3>
          <p style={{ color: '#475569' }}>
            Selecciona el rol correspondiente para cada usuario del sistema.
          </p>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '16px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Usuario</th>
                <th style={{ padding: '12px' }}>Correo</th>
                <th style={{ padding: '12px' }}>Rol actual</th>
                <th style={{ padding: '12px' }}>Nuevo rol</th>
                <th style={{ padding: '12px' }}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((currentUser) => {
                  const currentRoleId = currentUser.rol?.id || currentUser.rolId || '';
                  const selectedRoleId = selectedRoles[currentUser.id] || '';

                  return (
                    <tr key={currentUser.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px' }}>
                        {currentUser.nombres} {currentUser.apellidos}
                      </td>
                      <td style={{ padding: '12px' }}>{currentUser.correo}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            padding: '4px 8px',
                            borderRadius: '999px',
                            fontSize: '13px',
                            fontWeight: 600,
                          }}
                        >
                          {currentUser.rol?.nombre || 'Sin rol'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <select
                          value={selectedRoleId}
                          onChange={(e) =>
                            handleSelectedRoleChange(currentUser.id, e.target.value)
                          }
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            minWidth: '220px',
                          }}
                        >
                          <option value="">Seleccionar rol</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleSaveRole(currentUser)}
                          disabled={
                            savingUserId === currentUser.id ||
                            !selectedRoleId ||
                            selectedRoleId === currentRoleId
                          }
                          style={{
                            backgroundColor:
                              savingUserId === currentUser.id ? '#93c5fd' : '#2563eb',
                            color: '#ffffff',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor:
                              savingUserId === currentUser.id ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {savingUserId === currentUser.id ? 'Guardando...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center' }}>
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Matriz de permisos por rol</h3>
          <p style={{ color: '#475569' }}>
            Activa o desactiva qué permisos pertenecen a cada rol.
          </p>

          <div style={{ overflowX: 'auto', marginTop: '16px' }}>
            <table
              style={{
                width: '100%',
                minWidth: '900px',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      minWidth: '260px',
                    }}
                  >
                    Permiso
                  </th>

                  {filteredRoles.map((role) => (
                    <th
                      key={role.id}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        minWidth: '180px',
                      }}
                    >
                      {role.nombre}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {permissions.map((permission) => (
                  <tr key={permission.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{permission.nombre}</div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>
                        {permission.codigo}
                      </div>
                    </td>

                    {filteredRoles.map((role) => (
                      <td
                        key={`${role.id}-${permission.id}`}
                        style={{ padding: '12px', textAlign: 'center' }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(permissionMatrix[role.id]?.[permission.id])}
                          onChange={() =>
                            toggleMatrixPermission(role.id, permission.id)
                          }
                          style={{ transform: 'scale(1.2)' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '18px' }}>
            <button
              onClick={handleSaveMatrix}
              disabled={savingMatrix}
              style={{
                backgroundColor: savingMatrix ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: savingMatrix ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {savingMatrix ? 'Guardando matriz...' : 'Guardar cambios de matriz'}
            </button>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Crear nuevo rol</h3>
          <p style={{ color: '#475569' }}>
            Registra un nuevo rol y asígnale permisos iniciales desde esta misma
            pantalla.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '14px',
              marginTop: '16px',
            }}
          >
            <div>
              <label
                htmlFor="newRoleName"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
              >
                Nombre del rol
              </label>
              <input
                id="newRoleName"
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ejemplo: AUDITOR"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="newRoleDescription"
                style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}
              >
                Descripción
              </label>
              <input
                id="newRoleDescription"
                type="text"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="Describe el propósito del rol"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: 600 }}>
                Permisos iniciales
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                }}
              >
                {permissions.map((permission) => (
                  <label
                    key={permission.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newRolePermissionIds.includes(permission.id)}
                      onChange={() => toggleNewRolePermission(permission.id)}
                    />
                    <span>
                      <strong>{permission.nombre}</strong>
                      <br />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        {permission.codigo}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <button
                onClick={handleCreateRole}
                disabled={creatingRole}
                style={{
                  backgroundColor: creatingRole ? '#93c5fd' : '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: creatingRole ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {creatingRole ? 'Creando rol...' : 'Crear rol'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '8px' }}>Gestión de Usuarios</h1>
          <p style={{ marginTop: 0, color: '#475569' }}>
            Administra el acceso del personal universitario y configura permisos por
            roles.
          </p>
        </div>

        <button
          onClick={() => navigate('/users/create')}
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + Crear Usuario
        </button>
      </div>

      <div
        style={{
          marginTop: '20px',
          borderBottom: '1px solid #cbd5e1',
          display: 'flex',
          gap: '12px',
        }}
      >
        <button
          onClick={() => setActiveTab('users')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom:
              activeTab === 'users' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'users' ? '#2563eb' : '#64748b',
            padding: '10px 0',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Directorio de Usuarios
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom:
              activeTab === 'roles' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'roles' ? '#2563eb' : '#64748b',
            padding: '10px 0',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Roles y Permisos
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Filtrar por nombre, correo, rol o permiso..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '10px',
            width: '340px',
            maxWidth: '100%',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
          }}
        />
      </div>

      {error && (
        <p
          style={{
            marginTop: '16px',
            color: '#b91c1c',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '12px 14px',
            borderRadius: '10px',
          }}
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          style={{
            marginTop: '16px',
            color: '#166534',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: '12px 14px',
            borderRadius: '10px',
          }}
        >
          {successMessage}
        </p>
      )}

      {activeTab === 'users' ? renderUsersTab() : renderRolesTab()}
    </div>
  );
}
