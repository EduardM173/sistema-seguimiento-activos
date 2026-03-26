// frontend/src/services/user.service.ts
import type { 
  CreateUserRequest, 
  CreateUserResponse, 
  User, 
  Rol,
  PermisosRol,
  RolConPermisos 
} from '../types/user.types';
import { getAccessToken } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Función para obtener headers con autenticación
const getAuthHeaders = (): HeadersInit => {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('Token agregado a headers');
  } else {
    console.warn('No hay token disponible para la petición');
  }
  
  return headers;
};

// --- FUNCIONES DE USUARIOS ---

export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudieron obtener los usuarios');
  }

  return result;
}

export async function updateUserRole(userId: string, rolId: string): Promise<any> {
  const response = await fetch(`${API_URL}/users/${userId}/role`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ rolId }),
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.message || 'Error al actualizar el rol');
  }
  
  return result;
}

export async function getRoles(): Promise<Rol[]> {
  const response = await fetch(`${API_URL}/users/roles`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Error al obtener roles');
  }

  return result;
}

// --- NUEVAS FUNCIONES PARA ROLES Y PERMISOS ---

/**
 * Obtiene todos los roles disponibles para el select
 */
export async function getRolesForSelect(): Promise<Rol[]> {
  console.log('Obteniendo roles para select...');
  const token = getAccessToken();
  console.log('Token para /roles/select:', token ? `Presente (${token.substring(0, 30)}...)` : 'No hay token');
  
  const response = await fetch(`${API_URL}/roles/select`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  console.log('Respuesta status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', response.status, errorText);
    throw new Error(`Error ${response.status}: ${errorText || 'No autorizado'}`);
  }

  const result = await response.json();
  console.log('Roles obtenidos:', result);
  return result;
}

/**
 * Obtiene los permisos de un rol específico
 */
export async function getPermisosByRol(rolId: string): Promise<{ rol: { id: string; nombre: string; descripcion: string }; permisos: PermisosRol }> {
  console.log('Obteniendo permisos para rol:', rolId);
  
  const response = await fetch(`${API_URL}/roles/${rolId}/permisos`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', response.status, errorText);
    throw new Error(`Error ${response.status}: No se pudieron obtener los permisos`);
  }

  const result = await response.json();
  console.log('Permisos obtenidos:', result);
  return result;
}

/**
 * Actualiza los permisos de un rol específico
 */
export async function updatePermisos(rolId: string, permisos: PermisosRol): Promise<any> {
  console.log('Actualizando permisos para rol:', rolId);
  
  const response = await fetch(`${API_URL}/roles/${rolId}/permisos`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ permisos }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response:', response.status, errorText);
    throw new Error(`Error ${response.status}: No se pudieron actualizar los permisos`);
  }

  const result = await response.json();
  return result;
}