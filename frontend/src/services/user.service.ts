import type { CreateUserRequest, CreateUserResponse, User } from '../types/user.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudieron obtener los usuarios');
  }

  return result;
}