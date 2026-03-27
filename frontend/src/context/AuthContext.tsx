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
  isAuthenticated: boolean;
  setLoginData: (data: LoginResponse) => void;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
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

  function logout() {
    clearAuthSession();
    setUser(null);
    setIsAuthenticated(false);
    window.location.replace('/');
  }

  function hasPermission(permissionCode: string) {
    return Boolean(
      user?.permisos?.some((permission) => permission.codigo === permissionCode),
    );
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
      isAuthenticated,
      setLoginData,
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
