export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface UsuarioAutenticado {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  estado: string;
  rol: {
    id: string;
    nombre: string;
  };
  area: {
    id: string;
    nombre: string;
  } | null;
}

export interface LoginResponse {
  accessToken: string;
  usuario: UsuarioAutenticado;
}