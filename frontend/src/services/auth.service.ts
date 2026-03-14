import type { LoginRequest, LoginResponse } from '../types/auth.types';

const API_URL = 'http://localhost:3000';

export async function loginRequest(
  payload: LoginRequest,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message[0]
      : data.message || 'No se pudo iniciar sesión';

    throw new Error(message);
  }

  return data;
}