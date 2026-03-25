import { NavLink } from 'react-router-dom';
// importa navlink para navegar entre rutas

import { useAuth } from '../../context/AuthContext';
// importa el logout global

import '../../styles/navbar.css';
// importa los estilos del navbar

type MainItem = {
  // tipo para items principales
  label: string;
  // texto del item

  icon: string;
  // icono simple por ahora

  to?: string;
  // ruta del item si ya existe
};

type BottomItem = {
  // tipo para items de abajo
  label: string;
  // texto del item

  icon: string;
  // icono simple

  action?: () => void;
  // accion opcional
};

export default function Navbar() {
  // componente global del navbar

  const { logout } = useAuth();
  // obtiene la funcion global de cerrar sesion

  const mainItems: MainItem[] = [
    // menu principal
    { label: 'Dashboard', icon: '▦', to: '/dashboard' },
    // ruta ya lista

    { label: 'Activos', icon: '≣' },
    // aun sin ruta

    { label: 'Inventario', icon: '◫' },
    // aun sin ruta

    { label: 'Transferencias', icon: '⇄' },
    // aun sin ruta

    { label: 'Reportes', icon: '▥' },
    // aun sin ruta

    { label: 'Usuarios', icon: '◌' },
    // aun sin ruta

    { label: 'Auditoría', icon: '🛡' },
    // aun sin ruta
  ];

  const bottomItems: BottomItem[] = [
    // menu inferior
    { label: 'Configuración', icon: '⚙' },
    // aun sin ruta o accion

    { label: 'Cerrar Sesión', icon: '↩', action: logout },
    // aqui si ya metemos el logout real
  ];

  return (
    <aside className="sidebar">
      {/* sidebar lateral */}

      <div className="sidebar__top">
        {/* parte de arriba */}

        <div className="sidebar__brand">
          {/* marca del sistema */}

          <div className="sidebar__logo">🛡</div>
          {/* logo simple temporal */}

          <span className="sidebar__title">ActivoGestión</span>
          {/* nombre del sistema */}
        </div>
        {/* termina la marca */}

        <button type="button" className="sidebar__primaryButton">
          {/* boton visual temporal */}
          <span className="sidebar__plus">+</span>
          {/* iconito mas */}
          <span>Nuevo Activo</span>
          {/* texto del boton */}
        </button>
        {/* termina boton principal */}

        <nav className="sidebar__nav">
          {/* navegacion principal */}

          <ul className="sidebar__menu">
            {/* lista principal */}

            {mainItems.map((item) => (
              <li key={item.label} className="sidebar__item">
                {/* item del menu */}

                {item.to ? (
                  // si tiene ruta usamos navlink
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                    }
                  >
                    {/* link del menu */}
                    <span className="sidebar__icon">{item.icon}</span>
                    {/* icono */}
                    <span className="sidebar__text">{item.label}</span>
                    {/* texto */}
                  </NavLink>
                ) : (
                  // si aun no tiene ruta usamos boton visual
                  <button type="button" className="sidebar__link">
                    {/* boton temporal */}
                    <span className="sidebar__icon">{item.icon}</span>
                    {/* icono */}
                    <span className="sidebar__text">{item.label}</span>
                    {/* texto */}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {/* termina la lista principal */}
        </nav>
        {/* termina nav principal */}
      </div>
      {/* termina parte superior */}

      <div className="sidebar__bottom">
        {/* parte de abajo */}

        <ul className="sidebar__menu">
          {/* lista inferior */}

          {bottomItems.map((item) => (
            <li key={item.label} className="sidebar__item">
              {/* item inferior */}

              <button
                type="button"
                className="sidebar__link"
                onClick={item.action}
              >
                {/* boton inferior */}
                <span className="sidebar__icon">{item.icon}</span>
                {/* icono */}
                <span className="sidebar__text">{item.label}</span>
                {/* texto */}
              </button>
            </li>
          ))}
        </ul>
        {/* termina lista inferior */}
      </div>
      {/* termina parte de abajo */}
    </aside>
  );
}