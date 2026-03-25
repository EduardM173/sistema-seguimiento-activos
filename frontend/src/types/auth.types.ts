export type AuthUser = {
  id: number;

  nombres: string;
  apellidos: string;

  correo: string;
  nombreUsuario: string;

  estado: string;

  rol: {
    id: number;
    nombre: string;
  };

  area: {
    id: number;
    nombre: string;
  } | null;
};

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  usuario: AuthUser;
};