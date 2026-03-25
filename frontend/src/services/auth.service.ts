import type { LoginRequest, LoginResponse, AuthUser } from '../types/auth.types';
// importa los tipos para no andar inventando estructuras

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// toma la url del backend desde vite y si no existe usa localhost

const ACCESS_TOKEN_KEY = 'access_token';
// esta es la clave donde se guarda el token

const AUTH_USER_KEY = 'auth_user';
// esta es la clave donde se guarda el usuario

export async function login(data: LoginRequest): Promise<LoginResponse> {
  // esta funcion hace la peticion al backend para iniciar sesion

  const response = await fetch(`${API_URL}/auth/login`, {
    // hace el post al endpoint de login
    method: 'POST',
    // metodo post porque vamos a enviar datos

    headers: {
      // cabeceras de la peticion
      'Content-Type': 'application/json',
      // indicamos que estamos mandando json
    },

    body: JSON.stringify(data),
    // convierte los datos a json
  });

  const result = await response.json();
  // convierte la respuesta en json

  if (!response.ok) {
    // si el backend respondio con error entramos aqui
    throw new Error(result.message || 'No se pudo iniciar sesión');
    // lanza el error para mostrarlo en el form
  }

  return result;
  // devuelve el token y el usuario
}

export function saveAuthSession(data: LoginResponse): void {
  // guarda la sesion en el navegador

  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  // guarda el token

  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.usuario));
  // guarda el usuario convertido a texto
}

export function getAccessToken(): string | null {
  // intenta leer el token guardado

  const localToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  // busca el token en localstorage

  const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  // tambien busca por si algun dia se guardo en sessionstorage

  return localToken || sessionToken;
  // devuelve el que exista
}

export function getStoredUser(): AuthUser | null {
  // intenta recuperar el usuario guardado

  const localUser = localStorage.getItem(AUTH_USER_KEY);
  // busca en localstorage

  const sessionUser = sessionStorage.getItem(AUTH_USER_KEY);
  // busca en sessionstorage

  const rawUser = localUser || sessionUser;
  // toma el que exista

  if (!rawUser) {
    // si no hay nada guardado
    return null;
    // devuelve null
  }

  try {
    // intenta convertir el texto a objeto
    return JSON.parse(rawUser) as AuthUser;
    // devuelve el usuario ya convertido
  } catch {
    // si el json estaba roto entra aqui
    return null;
    // evita que toda la app falle
  }
}

export function clearAuthSession(): void {
  // limpia todo lo relacionado a la sesion

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  // borra token de localstorage

  localStorage.removeItem(AUTH_USER_KEY);
  // borra usuario de localstorage

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  // borra token de sessionstorage

  sessionStorage.removeItem(AUTH_USER_KEY);
  // borra usuario de sessionstorage
}

export function isAuthenticated(): boolean {
  // revisa si hay token guardado

  return Boolean(getAccessToken());
  // si hay token devuelve true, si no false
}