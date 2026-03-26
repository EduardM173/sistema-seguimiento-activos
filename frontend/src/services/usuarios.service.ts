import { apiClient } from './api.config';
import type { Usuario, CreateUsuarioDTO, UpdateUsuarioDTO, FiltrosUsuarios, Rol, Permiso, CambiarPasswordDTO } from '../types/usuarios.types';
import type { PaginatedResponse, ApiResponse } from '../types';

export const usuariosService = {
  // Obtener lista de usuarios
  obtenerTodos: async (filtros?: FiltrosUsuarios) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Usuario>>('/usuarios', {
        params: filtros,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener un usuario específico
  obtenerPorId: async (id: string) => {
    try {
      const response = await apiClient.get<ApiResponse<Usuario>>(`/usuarios/${id}`);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Crear nuevo usuario
  crear: async (datos: CreateUsuarioDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<Usuario>>('/usuarios', datos);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar usuario
  actualizar: async (id: string, datos: UpdateUsuarioDTO) => {
    try {
      const response = await apiClient.put<ApiResponse<Usuario>>(`/usuarios/${id}`, datos);
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Eliminar usuario
  eliminar: async (id: string) => {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/usuarios/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Cambiar contraseña del usuario actual
  cambiarPassword: async (datos: CambiarPasswordDTO) => {
    try {
      const response = await apiClient.post<ApiResponse<void>>('/usuarios/cambiar-password', datos);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Resetear contraseña (admin)
  resetearPassword: async (usuarioId: string) => {
    try {
      const response = await apiClient.post<ApiResponse<{ password: string }>>(
        `/usuarios/${usuarioId}/resetear-password`
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener roles disponibles
  obtenerRoles: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Rol[]>>('/usuarios/roles');
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Obtener permisos disponibles
  obtenerPermisos: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Permiso[]>>('/usuarios/permisos');
      return response.data.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Asignar rol a usuario
  asignarRol: async (usuarioId: string, rolId: string) => {
    try {
      const response = await apiClient.post<ApiResponse<Usuario>>(
        `/usuarios/${usuarioId}/roles`,
        { rolId }
      );
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Buscar usuarios
  buscar: async (termino: string) => {
    try {
      const response = await apiClient.get<PaginatedResponse<Usuario>>('/usuarios/buscar', {
        params: { q: termino },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Exportar usuarios
  exportar: async (formato: 'excel' | 'csv') => {
    try {
      const response = await apiClient.get(`/usuarios/exportar/${formato}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener estadísticas de usuarios
  obtenerEstadisticas: async () => {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/usuarios/estadisticas');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  // Obtener usuario actual
  obtenerPerfil: async () => {
    try {
      const response = await apiClient.get<ApiResponse<Usuario>>('/usuarios/perfil');
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },
};

export default usuariosService;
