import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import '../../styles/navbar.css';

type MainItem = {
  label: string;
  icon: string;
  to?: string;
};

type BottomItem = {
  label: string;
  icon: string;
  action?: () => void;
};

export default function Navbar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const mainItems: MainItem[] = [
    { label: 'Dashboard', icon: '📊', to: '/dashboard' },
    { label: 'Activos', icon: '📦', to: '/activos' },
    { label: 'Inventario', icon: '📝', to: '/inventario' },
    { label: 'Transferencias', icon: '🔄', to: '/transferencias' },
    { label: 'Reportes', icon: '📈', to: '/reportes' },
    { label: 'Usuarios', icon: '👥', to: '/users' },
    { label: 'Auditoría', icon: '🛡️', to: '/auditoria' },
  ];

  const bottomItems: BottomItem[] = [
    { label: 'Configuración', icon: '⚙️' },
    { label: 'Cerrar Sesión', icon: '↩️', action: () => { logout(); navigate('/'); } },
  ];

  const handleNewActivo = () => {
    navigate('/activos');
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
                {item.to ? (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                    }
                  >
                    <span className="sidebar__icon">{item.icon}</span>
                    <span className="sidebar__text">{item.label}</span>
                  </NavLink>
                ) : (
                  <button type="button" className="sidebar__link">
                    <span className="sidebar__icon">{item.icon}</span>
                    <span className="sidebar__text">{item.label}</span>
                  </button>
                )}
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
                onClick={item.action}
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