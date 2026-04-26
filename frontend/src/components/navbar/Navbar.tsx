import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import auditoriaService from '../../services/auditoria.service';
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!hasPermission('NOTIFICATION_VIEW')) {
      setUnreadNotifications(0);
      return;
    }

    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const total = await auditoriaService.obtenerContador();
        if (!cancelled) {
          setUnreadNotifications(total);
        }
      } catch {
        if (!cancelled) {
          setUnreadNotifications(0);
        }
      }
    }

    void loadUnreadCount();
    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasPermission]);

  const mainItems: MainItem[] = [
    { label: 'Dashboard',      icon: <IconGrid size={16} />,             to: '/dashboard' },
  ];

  if (hasPermission('ASSET_VIEW')) {
    mainItems.push(
      { label: 'Activos', icon: <IconPackage size={16} />, to: '/activos' },
      { label: 'Ubicaciones', icon: <IconMapPin size={16} />, to: '/locations' },
    );
  }

  if (hasPermission('INVENTORY_MANAGE')) {
    mainItems.push({
      label: 'Inventario',
      icon: <IconClipboard size={16} />,
      to: '/inventario',
    });
  }

  if (hasPermission('TRANSFER_MANAGE')) {
    mainItems.push({
      label: 'Transferencias',
      icon: <IconArrowsLeftRight size={16} />,
      to: '/transferencias',
    });
  }

  if (hasPermission('NOTIFICATION_VIEW')) {
    mainItems.push({
      label: 'Notificaciones',
      icon: <IconBell size={16} />,
      to: '/notificaciones',
    });
  }

  if (hasPermission('REPORT_VIEW')) {
    mainItems.push({
      label: 'Reportes',
      icon: <IconBarChart size={16} />,
      to: '/reportes',
    });
  }

  if (hasPermission('AUDIT_VIEW')) {
    mainItems.push({
      label: 'Auditoría',
      icon: <IconShield size={16} />,
      to: '/auditoria',
    });
  }

  if (hasPermission('USER_MANAGE')) {
    mainItems.push({
      label: 'Usuarios',
      icon: <IconUsers size={16} />,
      to: '/users',
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
                    {item.label === 'Notificaciones' && unreadNotifications > 0 ? (
                      <span className="sidebar__badge" aria-label={`${unreadNotifications} notificaciones sin leer`}>
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    ) : null}
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