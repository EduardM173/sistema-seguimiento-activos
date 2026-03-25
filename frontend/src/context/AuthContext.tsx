import { createContext, useContext, useMemo, useState, useEffect } from 'react';
// importa hooks y contexto de react

import type { ReactNode } from 'react';
// importa el tipo para children

import type { AuthUser, LoginResponse } from '../types/auth.types';
// importa tipos de auth

import {
  clearAuthSession,
  getStoredUser,
  isAuthenticated as checkIsAuthenticated,
  saveAuthSession,
} from '../services/auth.service';
// importa las utilidades de auth

type AuthContextType = {
  // define lo que va a exponer el contexto
  user: AuthUser | null;
  // usuario actual o null

  isAuthenticated: boolean;
  // dice si hay sesion activa

  setLoginData: (data: LoginResponse) => void;
  // guarda la sesion luego del login

  logout: () => void;
  // cierra sesion en cualquier parte
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
// crea el contexto y arranca indefinido

type AuthProviderProps = {
  // props del provider
  children: ReactNode;
  // todo lo que va envuelto por el provider
};

export function AuthProvider({ children }: AuthProviderProps) {
  // crea el provider global

  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  // carga el usuario ya guardado si existe

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(checkIsAuthenticated());
  // revisa si ya habia token guardado

  function setLoginData(data: LoginResponse) {
    // esta funcion se usa apenas el login sale bien

    saveAuthSession(data);
    // guarda token y usuario

    setUser(data.usuario);
    // actualiza el usuario en memoria

    setIsAuthenticated(true);
    // marca que la sesion esta activa
  }

  function logout() {
    // esta funcion hace el logout completo

    clearAuthSession();
    // borra token y usuario del navegador

    setUser(null);
    // limpia el usuario en memoria

    setIsAuthenticated(false);
    // marca que ya no hay sesion

    window.location.replace('/');
    // manda al login de forma inmediata y limpia
  }

  useEffect(() => {
    // esto ayuda a mantener el estado sincronizado

    function syncAuthState() {
      // vuelve a leer el estado desde storage
      setUser(getStoredUser());
      // actualiza usuario

      setIsAuthenticated(checkIsAuthenticated());
      // actualiza si hay sesion o no
    }

    window.addEventListener('storage', syncAuthState);
    // escucha cambios de storage

    return () => {
      // limpia el listener cuando ya no se use
      window.removeEventListener('storage', syncAuthState);
      // evita fugas raras
    };
  }, []);
  // corre una sola vez

  const value = useMemo(
    () => ({
      // arma el valor del contexto
      user,
      // usuario actual

      isAuthenticated,
      // estado de sesion

      setLoginData,
      // guardar login

      logout,
      // cerrar sesion
    }),
    [user, isAuthenticated],
  );
  // memoriza el valor para evitar renders innecesarios

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  // envuelve toda la app con el contexto
}

export function useAuth() {
  // hook para usar auth facilmente

  const context = useContext(AuthContext);
  // obtiene el contexto actual

  if (!context) {
    // si se usa fuera del provider
    throw new Error('useAuth debe usarse dentro de AuthProvider');
    // lanzamos error para detectar el problema
  }

  return context;
  // devuelve el contexto listo para usar
}