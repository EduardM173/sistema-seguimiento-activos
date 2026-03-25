export interface CreateUserRequest {
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  password: string;
}

export interface User {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  password?: string;
}

export interface CreateUserResponse {
  id: number;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  password?: string;
}