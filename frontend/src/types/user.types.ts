// frontend/src/types/user.types.ts
export interface CreateUserRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  password: string;
  telefono?: string;
  areaId?: string;
  rolId?: string; // AÑADIDO: para asignar rol al crear usuario
}

export interface User {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  telefono?: string | null;
  areaId?: string | null;
  rolId?: string;
  estado?: string;
  creadoEn?: string;
  actualizadoEn?: string;
  rol?: {  // AÑADIDO: para incluir información del rol
    id: string;
    nombre: string;
  };
}

export interface CreateUserResponse {
  message: string;
  user: User;
}

// NUEVO: Tipos para roles y permisos
export interface Rol {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface PermisosRol {
  [modulo: string]: {
    ver: boolean;
    crear: boolean;
    actualizar: boolean;
    eliminar: boolean;
  };
}

export interface RolConPermisos {
  id: string;
  nombre: string;
  descripcion: string;
  permisos: PermisosRol;
}
