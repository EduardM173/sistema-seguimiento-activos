import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';
import '../../styles/navbar.css';

type MenuItem = {
  label: string;
  icon: string;
  path: string;
};

const mainItems: MenuItem[] = [
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { label: 'Activos', icon: '📦', path: '/activos' },
  { label: 'Inventario', icon: '📝', path: '/inventario' },
  { label: 'Transferencias', icon: '🔄', path: '/transferencias' },
  { label: 'Reportes', icon: '📈', path: '/reportes' },
  { label: 'Usuarios', icon: '👥', path: '/usuarios' },
  { label: 'Auditoría', icon: '🛡️', path: '/auditoria' },
];

const bottomItems: MenuItem[] = [
  { label: 'Cerrar Sesión', icon: '↩️', path: '/' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleNavClick = (path: string, label: string) => {
    if (label === 'Cerrar Sesión') {
      logout();
      navigate('/');
      return;
    }
    navigate(path);
  };

  const handleNewActivo = () => {
    navigate('/activos');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="sidebar__brand">
          <div className="sidebar__logo">🛡</div>
          <span className="sidebar__title">ActivoGestión</span>
        </div>

        <button 
          type="button" 
          className="sidebar__primaryButton"
          onClick={handleNewActivo}
        >
          <span className="sidebar__plus">+</span>
          <span>Nuevo Activo</span>
        </button>

        <nav className="sidebar__nav">
          <ul className="sidebar__menu">
            {mainItems.map((item) => (
              <li key={item.label} className="sidebar__item">
                <button
                  type="button"
                  className={`sidebar__link ${isActive(item.path) ? 'sidebar__link--active' : ''}`}
                  onClick={() => handleNavClick(item.path, item.label)}
                >
                  <span className="sidebar__icon">{item.icon}</span>
                  <span className="sidebar__text">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="sidebar__bottom">
        <ul className="sidebar__menu">
          {bottomItems.map((item) => (
            <li key={item.label} className="sidebar__item">
              <button
                type="button"
                className="sidebar__link"
                onClick={() => handleNavClick(item.path, item.label)}
              >
                <span className="sidebar__icon">{item.icon}</span>
                <span className="sidebar__text">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}