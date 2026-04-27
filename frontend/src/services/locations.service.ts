import { http } from './http.client';
import type { ApiResponse } from '../types/assets.types';

export type LocationItem = {
  id: string;
  nombre: string;
  edificio: string | null;
  piso: string | null;
  ambiente: string | null;
  descripcion: string | null;
  creadoEn: string;
  actualizadoEn: string;
  _count?: { activos: number; areas: number };
};

export type AreaManagerItem = {
  id: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  correo: string;
  rol: { nombre: string };
  area: { id: string; nombre: string } | null;
};

export type AreaItem = {
  id: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: {
    id: string;
    nombre: string;
    edificio: string | null;
    piso: string | null;
    ambiente: string | null;
  } | null;
  encargado: {
    id: string;
    nombres: string;
    apellidos: string;
    correo: string;
    rol: { nombre: string };
  } | null;
  _count?: { usuarios: number; activos: number };
};

export type CreateLocationPayload = {
  nombre: string;
  edificio?: string;
  piso?: string;
  ambiente?: string;
  descripcion?: string;
};

export type CreateAreaPayload = {
  nombre: string;
  descripcion?: string;
  ubicacionId?: string;
  encargadoId?: string;
};

export type UpdateLocationPayload = Partial<CreateLocationPayload>;

export type SearchLocationsParams = {
  pattern?: string;
  edificio?: string;
  piso?: string;
  ambiente?: string;
  page?: number;
  pageSize?: number;
};

export async function searchLocations(params: SearchLocationsParams = {}) {
  const query = new URLSearchParams();
  if (params.pattern) query.set('pattern', params.pattern);
  if (params.edificio) query.set('edificio', params.edificio);
  if (params.piso) query.set('piso', params.piso);
  if (params.ambiente) query.set('ambiente', params.ambiente);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  return http.get<ApiResponse<LocationItem[]>>(`/locations${qs ? `?${qs}` : ''}`);
}

export async function getLocationById(id: string) {
  return http.get<ApiResponse<LocationItem>>(`/locations/${encodeURIComponent(id)}`);
}

export async function createLocation(payload: CreateLocationPayload) {
  return http.post<ApiResponse<LocationItem>>('/locations', payload);
}

export async function updateLocation(id: string, payload: UpdateLocationPayload) {
  return http.patch<ApiResponse<LocationItem>>(`/locations/${encodeURIComponent(id)}`, payload);
}

export async function deleteLocation(id: string) {
  return http.delete<ApiResponse<null>>(`/locations/${encodeURIComponent(id)}`);
}

export async function getAreasForLocations() {
  return http.get<ApiResponse<AreaItem[]>>('/locations/areas');
}

export async function getAreaResponsibles() {
  return http.get<ApiResponse<AreaManagerItem[]>>('/locations/areas/responsables');
}

export async function createArea(payload: CreateAreaPayload) {
  return http.post<ApiResponse<AreaItem>>('/locations/areas', payload);
}

export async function generateAssetCode() {
  return http.get<ApiResponse<{ code: string }>>('/assets/generate-code');
}
