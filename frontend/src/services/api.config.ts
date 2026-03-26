// Configuración centralizada de la API
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private static instance: AxiosInstance;

  static getInstance(): AxiosInstance {
    if (!ApiClient.instance) {
      ApiClient.instance = axios.create({
        baseURL: BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Interceptor para agregar el token de autenticación
      ApiClient.instance.interceptors.request.use((config: any) => {
        const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      });

      // Interceptor para manejar errores
      ApiClient.instance.interceptors.response.use(
        (response: any) => response,
        (error: any) => {
          if (error.response?.status === 401) {
            // Token expirado o no válido
            localStorage.removeItem('accessToken');
            localStorage.removeItem('usuario');
            sessionStorage.removeItem('accessToken');
            sessionStorage.removeItem('usuario');
            window.location.href = '/';
          }
          return Promise.reject(error);
        }
      );
    }

    return ApiClient.instance;
  }
}

export const apiClient = ApiClient.getInstance();

export const fetchWithAuth = async (
  url: string,
  options: AxiosRequestConfig = {}
) => {
  return apiClient.get(url, options);
};

export const postWithAuth = async (
  url: string,
  data: any,
  options: AxiosRequestConfig = {}
) => {
  return apiClient.post(url, data, options);
};

export const putWithAuth = async (
  url: string,
  data: any,
  options: AxiosRequestConfig = {}
) => {
  return apiClient.put(url, data, options);
};

export const deleteWithAuth = async (
  url: string,
  options: AxiosRequestConfig = {}
) => {
  return apiClient.delete(url, options);
};

export default apiClient;
