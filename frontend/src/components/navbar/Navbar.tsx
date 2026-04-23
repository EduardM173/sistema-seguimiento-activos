import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  IconGrid,
  IconPackage,
  IconClipboard,
  IconArrowsLeftRight,
  IconBarChart,
  IconUsers,
  IconShield,
  IconMapPin,
  IconBell,
  IconSettings,
  IconLogOut,
} from '../common/Icon';
import '../../styles/navbar.css';

type NavIcon = React.ReactElement;

type MainItem = {
  label: string;
  icon: NavIcon;
  to?: string;
};

type BottomItem = {
  label: string;
  icon: NavIcon;
  action?: () => void;
};

export default function Navbar() {
  const { logout, hasPermission } = useAuth();

  const mainItems: MainItem[] = [
    { label: 'Dashboard',      icon: <IconGrid size={16} />,             to: '/dashboard' },
    { label: 'Activos',        icon: <IconPackage size={16} />,          to: '/activos' },
    { label: 'Inventario',     icon: <IconClipboard size={16} />,        to: '/inventario' },
    { label: 'Reportes',       icon: <IconBarChart size={16} /> },
    { label: 'Usuarios',       icon: <IconUsers size={16} />,            to: '/users' },
    { label: 'Auditoría',      icon: <IconShield size={16} /> },
    { label: 'Ubicaciones',    icon: <IconMapPin size={16} />,           to: '/locations' },
  ];

  if (hasPermission('TRANSFER_MANAGE')) {
    mainItems.splice(3, 0, {
      label: 'Transferencias',
      icon: <IconArrowsLeftRight size={16} />,
      to: '/transferencias',
    });
  }

  if (hasPermission('NOTIFICATION_VIEW')) {
    mainItems.splice(4, 0, {
      label: 'Notificaciones',
      icon: <IconBell size={16} />,
      to: '/notificaciones',
    });
  }

  const bottomItems: BottomItem[] = [
    { label: 'Configuración', icon: <IconSettings size={16} /> },
    { label: 'Cerrar Sesión', icon: <IconLogOut size={16} />,  action: logout },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        {/* Brand */}
        <div className="sidebar__brand">
          <div className="sidebar__logo">
            <IconShield size={18} color="#003B75" />
          </div>
          <span className="sidebar__title">
            ActivoGestión
            <span>Sistema de Activos</span>
          </span>
        </div>


        {/* Navigation */}
        <nav className="sidebar__nav">
          <ul className="sidebar__menu">
            {mainItems.map((item) => (
              <li key={item.label} className="sidebar__item">
                {item.to ? (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
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

      {/* Bottom */}
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
