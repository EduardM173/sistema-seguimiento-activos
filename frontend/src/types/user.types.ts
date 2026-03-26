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
  id: string; // tu backend usa cuid() → string
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
}

export interface CreateUserResponse {
  message: string;
  user: User;
}