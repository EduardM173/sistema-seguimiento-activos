export type AuthUser = {
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

  permisos: {
    id: string;
    codigo: string;
    nombre: string;
  }[];
};

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  usuario: AuthUser;
};