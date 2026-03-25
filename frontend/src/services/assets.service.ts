import { getAccessToken } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type AssetItem = {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
  ubicacion: string;
};

export async function getAssets(): Promise<AssetItem[]> {
  const token = getAccessToken();

  const response = await fetch(`${API_URL}/assets`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'No se pudo obtener la lista de activos');
  }

  return Array.isArray(result) ? result : [];
}