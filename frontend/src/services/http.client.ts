import { getAccessToken, clearAuthSession } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class HttpError extends Error {
  status: number;
  errors?: string[];

  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.errors = errors;
  }
}

export type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  skipAuth?: boolean;
  params?: Record<string, any>;
  responseType?: 'json' | 'blob';
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, params, responseType = 'json', ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v));
      }
    }
    const qsStr = qs.toString();
    if (qsStr) url += (endpoint.includes('?') ? '&' : '?') + qsStr;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearAuthSession();
    window.location.replace('/');
    throw new HttpError('Sesión expirada', 401);
  }

  if (responseType === 'blob') {
    if (!response.ok) {
      throw new HttpError('Error al descargar archivo', response.status);
    }
    return response.blob() as unknown as T;
  }

  const result = await response.json();

  if (!response.ok) {
    throw new HttpError(
      result.message || 'Error en la solicitud',
      response.status,
      result.errors,
    );
  }

  return result as T;
}

export const http = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
