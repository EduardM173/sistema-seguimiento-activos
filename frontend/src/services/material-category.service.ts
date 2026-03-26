const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export interface MaterialCategory {
  id: string;
  nombre: string;
  descripcion?: string;
}

export async function getMaterialCategories(token: string): Promise<MaterialCategory[]> {
  const response = await fetch(`${API_URL}/material-categories`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener categorías');
  }

  return response.json();
}
