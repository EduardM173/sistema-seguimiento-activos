// frontend/src/services/auth.service.ts
import type { LoginRequest, LoginResponse, AuthUser } from '../types/auth.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'access_token';
const AUTH_USER_KEY = 'auth_user';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudo iniciar sesión');
  }

  // Guardar automáticamente al hacer login exitoso
  saveAuthSession(result);
  
  return result;
}

export function saveAuthSession(data: LoginResponse): void {
  console.log('Guardando token:', data.accessToken);
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.usuario));
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  console.log('Token obtenido:', token ? 'Presente' : 'No hay token');
  return token;
}

export function getStoredUser(): AuthUser | null {
  const rawUser = localStorage.getItem(AUTH_USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}