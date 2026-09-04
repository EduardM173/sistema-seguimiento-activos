import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import auditoriaService, { NOTIFICATIONS_REFRESH_EVENT } from '../../services/auditoria.service';
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
  IconDollarSign,
  IconX,
} from '../common/Icon';
import '../../styles/navbar.css';

type NavIcon = React.ReactElement;

type MainItem = {
  label: string;
  icon: NavIcon;
  to?: string;
  children?: { label: string; to: string }[];
};

type BottomItem = {
  label: string;
  icon: NavIcon;
  action?: () => void;
};

type NavbarProps = {
  /** Whether the off-canvas drawer is open (mobile/tablet only; ignored ≥1024px). */
  isOpen?: boolean;
  /** Called to close the drawer — backdrop click, Escape, or a route change. */
  onClose?: () => void;
};

export default function Navbar({ isOpen = false, onClose }: NavbarProps) {
  const { logout, hasPermission, user } = useAuth();
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // Controla si el submenú de Transferencias está expandido
  const [transferOpen, setTransferOpen] = useState(false);
  const [commerceOpen, setCommerceOpen] = useState(false);

  // Auto-expandir si la ruta actual es una sub-ruta de transferencias
  useEffect(() => {
    if (location.pathname.startsWith('/transferencias')) {
      setTransferOpen(true);
    }
    if (location.pathname.startsWith('/marketplace') || location.pathname.startsWith('/proveedores')) {
      setCommerceOpen(true);
    }
  }, [location.pathname]);

  // Close the mobile drawer on every navigation — covers link clicks without
  // needing an onClick handler on each NavLink.
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on Escape while the drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

    const handleRefresh = () => {
      void loadUnreadCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount();
      }
    };

    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 5000);

    window.addEventListener('focus', handleRefresh);
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasPermission]);

  const mainItems: MainItem[] = [
    { label: 'Dashboard', icon: <IconGrid size={16} />, to: '/dashboard' },
  ];

  if (hasPermission('ASSET_VIEW')) {
    mainItems.push(
      { label: 'Activos',     icon: <IconPackage size={16} />, to: '/activos' },
      { label: 'Ubicaciones', icon: <IconMapPin size={16} />,  to: '/locations' },
    );
  }

  if (hasPermission('INVENTORY_MANAGE')) {
    mainItems.push({
      label: 'Inventario',
      icon: <IconClipboard size={16} />,
      to: '/inventario',
    });
  }

  if (hasPermission('MARKETPLACE_VIEW')) {
    const children = [{ label: 'Catálogo de materiales', to: '/marketplace' }];

    if (hasPermission('SUPPLIER_MANAGE')) {
      children.push({ label: 'Registro de proveedores', to: '/proveedores' });
    }

    mainItems.push({
      label: 'Compras',
      icon: <IconDollarSign size={16} />,
      children,
    });
  }

  // Bloque Transferencias: puede tener submenú dependiendo de permisos
  const tieneTransferManage = hasPermission('TRANSFER_MANAGE');
  const tieneAssetView = hasPermission('ASSET_VIEW');

  if (tieneTransferManage || tieneAssetView) {
    const children: { label: string; to: string }[] = [];

    // Solo los que pueden gestionar transferencias ven "Transferencias"
    if (tieneTransferManage) {
      children.push({ label: 'Transferencias', to: '/transferencias' });
    }

    // Cualquiera con ASSET_VIEW ve "Recepciones" (HU21)
    if (tieneAssetView) {
      children.push({ label: 'Recepciones', to: '/transferencias/recepciones' });
    }

    if (children.length === 1 && children[0].to === '/transferencias') {
      // Solo transferencias — sin submenu
      mainItems.push({
        label: 'Transferencias',
        icon: <IconArrowsLeftRight size={16} />,
        to: '/transferencias',
      });
    } else {
      // Múltiples hijos — con submenu expandible
      mainItems.push({
        label: 'Transferencias',
        icon: <IconArrowsLeftRight size={16} />,
        children,
      });
    }
  }

  if (hasPermission('NOTIFICATION_VIEW')) {
    mainItems.push({
      label: 'Notificaciones',
      icon: <IconBell size={16} />,
      to: '/notificaciones',
    });
  }

  const canViewReports = hasPermission('REPORT_VIEW') || hasPermission('REPORT_GENERATE');

  if (canViewReports) {
    mainItems.push({
      label: 'Reportes',
      icon: <IconBarChart size={16} />,
      to: '/reportes',
    });
  }

  const isAreaManager = Boolean(
    user?.rol?.nombre?.toLowerCase().includes('responsable'),
  );

  if (hasPermission('ASSET_VIEW') && isAreaManager) {
    mainItems.push({
      label: 'Trazabilidad Área',
      icon: <IconShield size={16} />,
      to: '/auditoria/departamental',
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
    { label: 'Cerrar Sesión', icon: <IconLogOut size={16} />, action: logout },
  ];

  return (
    <>
      {/* Mobile/tablet only (≤1024px, see navbar.css): dims the page and
          closes the drawer on tap. Inert and invisible above that width. */}
      <div
        className={`sidebar-backdrop${isOpen ? ' sidebar-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
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
          <button
            type="button"
            className="sidebar__close"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          <ul className="sidebar__menu">
            {mainItems.map((item) => (
              <li key={item.label} className="sidebar__item">
                {item.children ? (
                  /* Item con submenú expandible */
                  <>
                    <button
                      type="button"
                      className={`sidebar__link sidebar__link--parent ${
                        item.children.some((c) => location.pathname.startsWith(c.to))
                          ? 'sidebar__link--active'
                          : ''
                      }`}
                      onClick={() => {
                        if (item.label === 'Compras') {
                          setCommerceOpen((v) => !v);
                        } else {
                          setTransferOpen((v) => !v);
                        }
                      }}
                      aria-expanded={item.label === 'Compras' ? commerceOpen : transferOpen}
                    >
                      <span className="sidebar__icon">{item.icon}</span>
                      <span className="sidebar__text">{item.label}</span>
                      <span className={`sidebar__chevron ${
                        (item.label === 'Compras' ? commerceOpen : transferOpen)
                          ? 'sidebar__chevron--open'
                          : ''
                      }`}>
                        ›
                      </span>
                    </button>

                    {(item.label === 'Compras' ? commerceOpen : transferOpen) && (
                      <ul className="sidebar__submenu">
                        {item.children.map((child) => (
                          <li key={child.to} className="sidebar__subitem">
                            <NavLink
                              to={child.to}
                              end
                              className={({ isActive }) =>
                                `sidebar__sublink${isActive ? ' sidebar__sublink--active' : ''}`
                              }
                            >
                              {child.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : item.to ? (
                  /* Item con ruta directa */
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
                    }
                  >
                    <span className="sidebar__icon">{item.icon}</span>
                    <span className="sidebar__text">{item.label}</span>
                    {item.label === 'Notificaciones' && unreadNotifications > 0 ? (
                      <span
                        className="sidebar__badge"
                        aria-label={`${unreadNotifications} notificaciones sin leer`}
                      >
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
    </>
  );
}
