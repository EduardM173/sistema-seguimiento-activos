import { http } from './http.client';
import type {
  ApiResponse,
  AssetListItem,
  AssetDetail,
  CreateAssetPayload,
  UpdateAssetPayload,
  SearchAssetsParams,
  Categoria,
  Ubicacion,
} from '../types/assets.types';

export type { AssetListItem } from '../types/assets.types';

export async function searchAssets(params: SearchAssetsParams = {}) {
  const query = new URLSearchParams();

  if (params.q) query.set('q', params.q);
  if (params.estado) query.set('estado', params.estado);
  if (params.categoriaId) query.set('categoriaId', params.categoriaId);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  return http.get<ApiResponse<AssetListItem[]>>(`/assets${qs ? `?${qs}` : ''}`);
}

export async function getAssetById(id: string) {
  return http.get<ApiResponse<AssetDetail>>(`/assets/${encodeURIComponent(id)}`);
}

export async function createAsset(payload: CreateAssetPayload) {
  return http.post<ApiResponse<AssetDetail>>('/assets', payload);
}

export async function updateAsset(id: string, payload: UpdateAssetPayload) {
  return http.patch<ApiResponse<AssetDetail>>(`/assets/${encodeURIComponent(id)}`, payload);
}

export async function deleteAsset(id: string) {
  return http.delete<ApiResponse<AssetDetail>>(`/assets/${encodeURIComponent(id)}`);
}

export async function getCategorias() {
  return http.get<ApiResponse<Categoria[]>>('/catalogs/categorias');
}

export async function getUbicaciones() {
  return http.get<ApiResponse<Ubicacion[]>>('/catalogs/ubicaciones');
}