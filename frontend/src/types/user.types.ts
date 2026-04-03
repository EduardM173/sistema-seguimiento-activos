export interface Permission {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
}

export interface Role {
  id: string;
  nombre: string;
  descripcion?: string | null;
  permisos?: Permission[];
}

export interface CreateUserRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  password: string;
  telefono?: string;
  areaId?: string;
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
  rol?: {
    id: string;
    nombre: string;
    descripcion?: string | null;
  };
}

export interface CreateUserResponse {
  message: string;
  user: User;
}

export interface UpdateUserRequest {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  nombreUsuario?: string;
  telefono?: string;
  areaId?: string;
}

export interface UpdateUserResponse {
  message: string;
  user: User;
}

export interface UpdateUserRoleRequest {
  rolId: string;
}

export interface UpdateUserRoleResponse {
  message: string;
  user: User;
}

export interface CreateRoleRequest {
  nombre: string;
  descripcion?: string;
  permisoIds?: string[];
}

export interface CreateRoleResponse {
  message: string;
  role: Role;
}

export interface UpdateRolePermissionsRequest {
  permisoIds: string[];
}

export interface UpdateRolePermissionsResponse {
  message: string;
  role: Role;
}
