import { createContext, useContext, useMemo, useState, useEffect } from 'react';

import type { ReactNode } from 'react';

import type { AuthUser, LoginResponse } from '../types/auth.types';

import {
  clearAuthSession,
  getCurrentSession,
  getStoredUser,
  isAuthenticated as checkIsAuthenticated,
  saveAuthSession,
  saveAuthUser,
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
    async function syncCurrentSession() {
      if (!checkIsAuthenticated()) {
        return;
      }

      try {
        const session = await getCurrentSession();
        saveAuthUser(session.usuario);
        setUser(session.usuario);
        setIsAuthenticated(true);
      } catch {
        syncAuthState();
      }
    }

    function syncAuthState() {
      setUser(getStoredUser());
      setIsAuthenticated(checkIsAuthenticated());
    }

    void syncCurrentSession();

    function handleWindowFocus() {
      void syncCurrentSession();
    }

    window.addEventListener('storage', syncAuthState);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleWindowFocus);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleWindowFocus);
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
