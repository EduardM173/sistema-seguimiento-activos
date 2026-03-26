import { useEffect, useState } from 'react';
import { Usuario, UsuarioAutenticado } from '../types';

interface UseAuthReturn {
  usuario: UsuarioAutenticado | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usuario: UsuarioAutenticado, token: string) => void;
  logout: () => void;
  hasPermission: (permiso: string) => boolean;
}

export const useAuth = (): UseAuthReturn => {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay usuario en localStorage o sessionStorage
    const usuarioGuardado = localStorage.getItem('usuario') || sessionStorage.getItem('usuario');
    const tokenGuardado = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');

    if (usuarioGuardado && tokenGuardado) {
      try {
        setUsuario(JSON.parse(usuarioGuardado));
      } catch (e) {
        console.error('Error al parsear usuario:', e);
        localStorage.removeItem('usuario');
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('usuario');
        sessionStorage.removeItem('accessToken');
      }
    }

    setIsLoading(false);
  }, []);

  const login = (nuevoUsuario: UsuarioAutenticado, token: string) => {
    localStorage.setItem('usuario', JSON.stringify(nuevoUsuario));
    localStorage.setItem('accessToken', token);
    setUsuario(nuevoUsuario);
  };

  const logout = () => {
    localStorage.removeItem('usuario');
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('accessToken');
    setUsuario(null);
  };

  const hasPermission = (permiso: string): boolean => {
    // Verificar permisos del usuario según su rol
    // Esta lógica dependerá de tu estructura de permisos
    if (!usuario) return false;
    // Por ahora, retornar true si el usuario está autenticado
    return true;
  };

  return {
    usuario,
    isAuthenticated: !!usuario,
    isLoading,
    login,
    logout,
    hasPermission,
  };
};

export default useAuth;
