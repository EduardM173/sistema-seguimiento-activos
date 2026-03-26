// Permiso del sistema
export interface Permiso {
  id: string;
  nombre: string;
  descripcion?: string;
  modulo: string;
  accion: "crear" | "leer" | "actualizar" | "eliminar" | "exportar" | "aprobar";
  activo: boolean;
}

// Rol del sistema
export interface Rol {
  id: string;
  nombre: string;
  descripcion?: string;
  permisos?: Permiso[];
  rol_permisos?: RolPermiso[];
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Relación entre Rol y Permiso
export interface RolPermiso {
  id: string;
  rolId: string;
  rol?: Rol;
  permisoId: string;
  permiso?: Permiso;
}

// Usuario del sistema
export interface Usuario {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  areaId?: string;
  area?: {
    id: string;
    nombre: string;
  };
  rolId: string;
  rol?: Rol;
  telefonoOficina?: string;
  telefonoPersonal?: string;
  departamento?: string;
  cargo?: string;
  foto?: string;
  estado: "activo" | "inactivo" | "bloqueado" | "pendiente";
  ultimaConexion?: Date;
  intentosFallidos: number;
  requiereChangioPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// DTO para crear usuario
export interface CreateUsuarioDTO {
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  areaId?: string;
  rolId: string;
  telefonoOficina?: string;
  telefonoPersonal?: string;
  departamento?: string;
  cargo?: string;
  password?: string; // Generado automáticamente si no se proporciona
}

// DTO para actualizar usuario
export interface UpdateUsuarioDTO {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  areaId?: string;
  rolId?: string;
  telefonoOficina?: string;
  telefonoPersonal?: string;
  departamento?: string;
  cargo?: string;
  estado?: "activo" | "inactivo" | "bloqueado";
}

// DTO para asignar rol
export interface AsignarRolDTO {
  rolesIds: string[];
}

// DTO para cambiar contraseña
export interface CambiarPasswordDTO {
  passwordActual: string;
  passwordNueva: string;
  passwordConfirm: string;
}

// DTO para resetear contraseña (admin)
export interface ResetearPasswordDTO {
  nuevaPassword?: string;
}

// Filtros para usuarios
export interface FiltrosUsuarios {
  estado?: "activo" | "inactivo" | "bloqueado" | "pendiente";
  rol?: string;
  area?: string;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

// Respuesta de auditoría de acceso
export interface RegistroAcceso {
  id: string;
  usuarioId: string;
  usuario?: Usuario;
  accion: string;
  recurso: string;
  resultado: "exitoso" | "fallido";
  fechaHora: Date;
  direccionIP?: string;
  detalles?: string;
}
