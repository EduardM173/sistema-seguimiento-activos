import { ActivosService } from '@activos/config/browser';
import { getAccessToken } from './auth.service';

const API_URL = `/${ActivosService.BACKEND}/api`;

export type MarketplaceKind = 'ACTIVO' | 'MATERIAL';

export type MarketplaceItem = {
  id: string;
  kind: MarketplaceKind;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  detalle?: string | null;
  estado?: string | null;
  imagenUrl?: string | null;
};

export type PurchaseRequest = {
  id: string;
  tipo: MarketplaceKind;
  estado: string;
  cantidad: number;
  nota?: string | null;
  item?: MarketplaceItem | null;
  creadoEn: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

function authHeaders() {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const result = (await response.json()) as ApiEnvelope<T> | T;

  if (!response.ok) {
    const message =
      typeof result === 'object' && result && 'message' in result
        ? String((result as ApiEnvelope<T>).message)
        : 'Error en la solicitud';
    throw new Error(message);
  }

  if (typeof result === 'object' && result && 'data' in result) {
    return (result as ApiEnvelope<T>).data as T;
  }

  return result as T;
}

export async function searchMarketplaceItems(
  kind: MarketplaceKind,
  query: string,
): Promise<MarketplaceItem[]> {
  const params = new URLSearchParams({
    tipo: kind,
  });
  if (query.trim()) params.set('q', query.trim());

  const data = await readJson<any[]>(
    await fetch(`${API_URL}/purchases/catalog?${params}`, { headers: authHeaders() }),
  );

  return data.map((item) => ({
    id: item.id,
    kind: item.kind ?? kind,
    codigo: item.codigo,
    nombre: item.nombre,
    descripcion: item.descripcion,
    categoria: item.categoria ?? null,
    detalle: item.detalle ?? null,
    estado: item.estado ?? null,
    imagenUrl: null,
  }));
}

export async function createPurchaseRequest(
  item: MarketplaceItem,
  cantidad: number,
  nota: string,
): Promise<PurchaseRequest> {
  const body =
    item.kind === 'ACTIVO'
      ? { tipo: item.kind, activoId: item.id, cantidad, nota }
      : { tipo: item.kind, materialId: item.id, cantidad, nota };

  return readJson<PurchaseRequest>(
    await fetch(`${API_URL}/purchases`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export async function getMyPurchaseRequests(): Promise<PurchaseRequest[]> {
  return readJson<PurchaseRequest[]>(
    await fetch(`${API_URL}/purchases/mine`, { headers: authHeaders() }),
  );
}
