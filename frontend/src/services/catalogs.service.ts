import { http } from './http.client';
import type { ApiResponse, Categoria, Ubicacion, Area, UsuarioResumen } from '../types/assets.types';

export async function getCategorias() {
  const res = await http.get<ApiResponse<Categoria[]>>('/catalogs/categorias');
  return res.data;
}

export async function getUbicaciones() {
  const res = await http.get<ApiResponse<Ubicacion[]>>('/catalogs/ubicaciones');
  return res.data;
}

export async function getAreas() {
  const res = await http.get<ApiResponse<Area[]>>('/catalogs/areas');
  return res.data;
}

export async function getUsuarios() {
  const res = await http.get<ApiResponse<UsuarioResumen[]>>('/catalogs/usuarios');
  return res.data;
}
