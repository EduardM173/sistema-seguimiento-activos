// frontend/src/types/auth.types.ts
export type AuthUser = {
  id: string;
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  estado: string;
  rolId: string;
  rol: {
    id: string;
    nombre: string;
  };
  area: {
    id: string;
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