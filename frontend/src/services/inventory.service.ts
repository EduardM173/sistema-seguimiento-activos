const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

export interface CreateMaterialRequest {
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId: string;
}

export interface Material {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId: string;
  creadoEn: string;
  actualizadoEn: string;
  categoria: {
    id: string;
    nombre: string;
  };
}

export interface CreateMaterialResponse {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
  categoriaId: string;
  creadoEn: string;
  actualizadoEn: string;
}

export async function getMaterials(token: string): Promise<Material[]> {
  const response = await fetch(`${API_URL}/materials`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al obtener materiales');
  }

  return response.json();
}

export async function createMaterial(
  data: CreateMaterialRequest,
  token: string
): Promise<CreateMaterialResponse> {
  const response = await fetch(`${API_URL}/materials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al crear material');
  }

  return response.json();
}
