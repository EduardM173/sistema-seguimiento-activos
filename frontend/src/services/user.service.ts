import { getAccessToken } from './auth.service';
import type {
  CreateRoleRequest,
  CreateRoleResponse,
  CreateUserRequest,
  CreateUserResponse,
  Permission,
  Role,
  UpdateRolePermissionsRequest,
  UpdateRolePermissionsResponse,
  UpdateUserRoleRequest,
  UpdateUserRoleResponse,
  User,
} from '../types/user.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function buildHeaders(): HeadersInit {
  const token = getAccessToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function createUser(
  data: CreateUserRequest,
): Promise<CreateUserResponse> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudo crear el usuario');
  }

  return result;
}

export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudieron obtener los usuarios');
  }

  return Array.isArray(result) ? result : [];
}

export async function getRoles(): Promise<Role[]> {
  const response = await fetch(`${API_URL}/users/roles`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudieron obtener los roles');
  }

  return Array.isArray(result) ? result : [];
}

export async function getPermissions(): Promise<Permission[]> {
  const response = await fetch(`${API_URL}/users/permissions`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudieron obtener los permisos');
  }

  return Array.isArray(result) ? result : [];
}

export async function updateUserRole(
  userId: string,
  data: UpdateUserRoleRequest,
): Promise<UpdateUserRoleResponse> {
  const response = await fetch(`${API_URL}/users/${userId}/role`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudo actualizar el rol');
  }

  return result;
}

export async function createRole(
  data: CreateRoleRequest,
): Promise<CreateRoleResponse> {
  const response = await fetch(`${API_URL}/users/roles`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudo crear el rol');
  }

  return result;
}

export async function updateRolePermissions(
  roleId: string,
  data: UpdateRolePermissionsRequest,
): Promise<UpdateRolePermissionsResponse> {
  const response = await fetch(`${API_URL}/users/roles/${roleId}/permissions`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudieron actualizar los permisos');
  }

  return result;
}