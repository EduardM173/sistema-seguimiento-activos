import { useEffect, useMemo, useState } from 'react';
import CreateUser from '../../components/users/CreateUser';

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
import { SmartTable } from '../../components/common/SmartTable';
import type { ColumnDef, ActionDef } from '../../components/common/SmartTable';
import { FilterRow } from '../../components/common/FilterRow';
import { useModalUrlSync } from '@/deeplink';
import '../../styles/assets.css';

type TabKey = 'users' | 'roles';

type PermissionMatrixState = Record<string, Record<string, boolean>>;

export default function UserList() {
  const { user: authUser } = useAuth();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Deeplink URL sync — `?modal=create-user` and `?modal=edit-user&userId=...`.
  useModalUrlSync('create-user', showCreateModal, setShowCreateModal);
  useModalUrlSync(
    'edit-user',
    Boolean(editingUserId),
    (open) => { if (!open) setEditingUserId(null); },
  );

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
    backgroundColor: 'transparent',
    border: 'none',
    borderTop: '1px solid var(--color-border-light)',
    borderRadius: 0,
    padding: '24px 0 0',
    marginTop: '32px',
  };

  const renderUsersTab = () => {
    const userColumns: ColumnDef<User>[] = [
      {
        id: 'nombre',
        header: 'Nombre',
        accessor: (u) => `${u.nombres} ${u.apellidos}`,
        primary: true,
        width: 220,
        sortable: true,
        render: (value, u) => {
          const missing = getMissingUserFields(u);
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {value as string}
              {missing.length > 0 && (
                <span
                  title={`Datos incompletos: ${missing.join(', ')}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '999px',
                    background: 'var(--color-warning-light)',
                    color: 'var(--color-warning)',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  !
                </span>
              )}
            </span>
          );
        },
      },
      { id: 'nombreUsuario', header: 'Usuario',  accessor: 'nombreUsuario', width: 150, sortable: true },
      { id: 'correo',        header: 'Correo',   accessor: 'correo',        width: 220, sortable: true },
      {
        id: 'rol',
        header: 'Rol',
        accessor: (u) => u.rol?.nombre ?? 'Sin rol',
        width: 150,
        render: (v) => (
          <span
            style={{
              background: 'var(--color-primary-muted)',
              color: 'var(--color-primary-light)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {v as string}
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        accessor: 'estado',
        width: 130,
        render: (v, u) => {
          const isActive = String(v) === 'ACTIVO';
          const missing = getMissingUserFields(u);
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  background: isActive ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                  color: isActive ? 'var(--color-success)' : 'var(--color-danger)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {String(v) || 'Sin estado'}
              </span>
              {missing.length > 0 && (
                <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem', fontWeight: 600 }}>
                  Incompleto
                </span>
              )}
            </span>
          );
        },
      },
    ];

    const userActions: ActionDef<User>[] = [
      {
        label: 'Editar',
        icon: '✏️',
        onClick: (u) => setEditingUserId(u.id),
      },
    ];

    return (
      <div className="assetsTable__wrap" style={{ marginTop: 20 }}>
        <SmartTable<User>
          columns={userColumns}
          data={filteredUsers}
          loading={loading}
          keyExtractor={(u) => u.id}
          emptyMessage="No hay usuarios para mostrar."
          onRowClick={(u) => setEditingUserId(u.id)}
          actions={userActions}
        />
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
          <p style={{ margin: 0, color: 'var(--color-warning)' }}>
            No tienes el permiso necesario para gestionar roles y permisos.
          </p>
        </div>
      );
    }

    return (
      <>
        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Asignación de roles a usuarios</h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>
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
              <tr style={{ backgroundColor: 'var(--glass-bg)', textAlign: 'left' }}>
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
                    <tr key={currentUser.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '12px' }}>
                        {currentUser.nombres} {currentUser.apellidos}
                      </td>
                      <td style={{ padding: '12px' }}>{currentUser.correo}</td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            backgroundColor: 'var(--glass-bg)',
                            color: 'var(--color-text-bright)',
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
                            borderRadius: 0,
                            border: 'none',
                            borderBottom: '1px solid var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-text-bright)',
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
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveRole(currentUser)}
                          disabled={
                            savingUserId === currentUser.id ||
                            !selectedRoleId ||
                            selectedRoleId === currentRoleId
                          }
                        >
                          {savingUserId === currentUser.id ? 'Guardando…' : 'Guardar'}
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
          <p style={{ color: 'var(--color-text-secondary)' }}>
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
                <tr style={{ backgroundColor: 'var(--glass-bg)' }}>
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
                  <tr key={permission.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{permission.nombre}</div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
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
              className="btn btn-primary"
              onClick={handleSaveMatrix}
              disabled={savingMatrix}
            >
              {savingMatrix ? 'Guardando matriz…' : 'Guardar cambios de matriz'}
            </button>
          </div>
        </div>

        <div style={sectionCardStyle}>
          <h3 style={{ marginTop: 0 }}>Crear nuevo rol</h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>
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
                  padding: '10px 0',
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-bright)',
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
                  padding: '10px 0',
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-bright)',
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
                      padding: '10px 0',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border-light)',
                      borderRadius: 0,
                      backgroundColor: 'transparent',
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
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        {permission.codigo}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <button
                className="btn btn-success"
                onClick={handleCreateRole}
                disabled={creatingRole}
              >
                {creatingRole ? 'Creando rol…' : 'Crear rol'}
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
          <p style={{ marginTop: 0, color: 'var(--color-text-secondary)' }}>
            Administra el acceso del personal universitario y configura permisos por
            roles.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'white',
            padding: '10px 16px',
            borderRadius: 'var(--radius-base)',
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
          borderBottom: '1px solid var(--color-border-light)',
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
            color: activeTab === 'users' ? 'var(--color-accent)' : '#64748b',
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
            color: activeTab === 'roles' ? 'var(--color-accent)' : '#64748b',
            padding: '10px 0',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Roles y Permisos
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <FilterRow
          elements={[
            {
              type: 'search',
              key: 'search',
              label: 'BUSCAR',
              placeholder: 'Filtrar por nombre, correo, rol o permiso...',
            },
          ]}
          onChange={(q) => setFilter(q.search ?? '')}
        />
      </div>

      {error && (
        <p
          style={{
            marginTop: '16px',
            color: 'var(--color-danger)',
            backgroundColor: 'var(--color-danger-light)',
            border: '1px solid rgba(239,68,68,0.30)',
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
            color: 'var(--color-success)',
            backgroundColor: 'var(--color-success-light)',
            border: '1px solid rgba(34,197,94,0.30)',
            padding: '12px 14px',
            borderRadius: '10px',
          }}
        >
          {successMessage}
        </p>
      )}

      {activeTab === 'users' ? renderUsersTab() : renderRolesTab()}

      <CreateUser
        open={showCreateModal || Boolean(editingUserId)}
        userId={editingUserId ?? undefined}
        onClose={() => {
          setShowCreateModal(false);
          setEditingUserId(null);
          void loadAllData();
        }}
      />
    </div>
  );
}
