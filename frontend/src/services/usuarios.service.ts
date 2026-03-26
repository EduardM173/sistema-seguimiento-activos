import { http as apiClient } from './http.client';
import type { Usuario, CreateUsuarioDTO, UpdateUsuarioDTO, FiltrosUsuarios, Rol, Permiso, CambiarPasswordDTO } from '../types/usuarios.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const usuariosService = {
  // Obtener lista de usuarios
  obtenerTodos: async (filtros?: FiltrosUsuarios) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Usuario>>('/users', {
        params: filtros,
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un usuario específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<Usuario>>(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Crear nuevo usuario
  crear: async (datos: CreateUsuarioDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<Usuario>>('/users', datos);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar usuario
  actualizar: async (id: string, datos: UpdateUsuarioDTO) => {
    try {
      const response = await apiClient.put<ApiResponse<Usuario>>(`/users/${id}`, datos);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar usuario
  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/users/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Cambiar contraseña del usuario actual
  cambiarPassword: async (datos: CambiarPasswordDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<void>>('/users/cambiar-password', datos);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Resetear contraseña (admin)
  resetearPassword: async (usuarioId: string) => {
    try {
      const response = await apiClient.post<ApiResponse<{ password: string }>>(
        `/users/${usuarioId}/resetear-password`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener roles disponibles
  obtenerRoles: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Rol[]>>('/users/roles');
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Obtener permisos disponibles
  obtenerPermisos: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Permiso[]>>('/users/permissions');
      return response.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Asignar rol a usuario
  asignarRol: async (usuarioId: string, rolId: string) => {
    try {
      const response = await apiClient.patch<ApiResponse<Usuario>>(
        `/users/${usuarioId}/role`,
        { rolId }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Buscar usuarios
  buscar: async (termino: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Usuario>>('/users/buscar', {
        params: { q: termino },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Exportar usuarios
  exportar: async (formato: 'excel' | 'csv') => {
    try {
      const response = await apiClient.get(`/users/exportar/${formato}`, {
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Obtener estadísticas de usuarios
  obtenerEstadisticas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/users/estadisticas');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener usuario actual
  obtenerPerfil: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Usuario>>('/usuarios/perfil');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default usuariosService;
