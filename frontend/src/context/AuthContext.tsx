import { createContext, useContext, useMemo, useState, useEffect } from 'react';

import type { ReactNode } from 'react';

import type { AuthUser, LoginResponse } from '../types/auth.types';

import {
  clearAuthSession,
  getStoredUser,
  isAuthenticated as checkIsAuthenticated,
  saveAuthSession,
} from '../services/auth.service';

type AuthContextType = {
  user: AuthUser | null;
  /** Alias for `user` — exposed for compatibility with the hooks-based consumers. */
  usuario: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setLoginData: (data: LoginResponse) => void;
  /** Alternative login API: accepts (usuario, token) separately. */
  login: (usuario: AuthUser, token: string) => void;
  logout: () => void;
  hasPermission: (permiso: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(checkIsAuthenticated());

  function setLoginData(data: LoginResponse) {
    saveAuthSession(data);
    setUser(data.usuario);
    setIsAuthenticated(true);
  }

  function login(usuario: AuthUser, token: string) {
    setLoginData({ usuario, accessToken: token });
  }

  function logout() {
    clearAuthSession();
    setUser(null);
    setIsAuthenticated(false);
    window.location.replace('/');
  }

  function hasPermission(_permiso: string): boolean {
    return isAuthenticated;
  }

  useEffect(() => {
    function syncAuthState() {
      setUser(getStoredUser());
      setIsAuthenticated(checkIsAuthenticated());
    }

    window.addEventListener('storage', syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      usuario: user,
      isAuthenticated,
      isLoading: false,
      setLoginData,
      login,
      logout,
      hasPermission,
    }),
    [user, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}