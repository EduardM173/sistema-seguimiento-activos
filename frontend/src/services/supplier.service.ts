import { ActivosService } from '@activos/config/browser';
import { getAccessToken } from './auth.service';

const API_URL = `/${ActivosService.BACKEND}/api`;

export type Supplier = {
  id: string;
  nombre: string;
  nit?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  rubro?: string | null;
  observaciones?: string | null;
  activo: boolean;
  creadoEn: string;
};

export type SupplierForm = {
  nombre: string;
  nit: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  rubro: string;
  observaciones: string;
};

type ApiEnvelope<T> = {
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
  const result = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(result.message || 'Error en la solicitud');
  }
  return result.data as T;
}

export async function getSuppliers(q = '') {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());

  return readJson<Supplier[]>(
    await fetch(`${API_URL}/suppliers?${params}`, { headers: authHeaders() }),
  );
}

export async function createSupplier(data: SupplierForm) {
  return readJson<Supplier>(
    await fetch(`${API_URL}/suppliers`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    }),
  );
}
