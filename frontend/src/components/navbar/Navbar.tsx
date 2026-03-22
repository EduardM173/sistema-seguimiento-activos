import '../../styles/navbar.css';
// importa el css del navbar

type MenuItem = {
// define la forma de cada item del menu
  label: string;
// guarda el nombre que se vera
  icon: string;
// guarda un icono simple de texto
  active?: boolean;
// marca si el item esta activo o no
};
// cierra el tipo del item

const mainItems: MenuItem[] = [
// lista principal del menu
  { label: 'Dashboard', icon: '▦', active: true },
// este queda activo por defecto
  { label: 'Activos', icon: '≣' },
// item de activos
  { label: 'Inventario', icon: '◫' },
// item de inventario
  { label: 'Transferencias', icon: '⇄' },
// item de transferencias
  { label: 'Reportes', icon: '▥' },
// item de reportes
  { label: 'Usuarios', icon: '◌' },
// item de usuarios
  { label: 'Auditoría', icon: '🛡' },
// item de auditoria
];
// termina la lista principal

const bottomItems: MenuItem[] = [
// lista de abajo del navbar
  { label: 'Configuración', icon: '⚙' },
// item de configuracion
  { label: 'Cerrar Sesión', icon: '↩' },
// item para cerrar sesion
];
// termina la lista de abajo

export default function Navbar() {
// crea el componente del navbar
  return (
// devuelve la estructura visual
    <aside className="sidebar">
      {/* contenedor principal del sidebar */}

      <div className="sidebar__top">
        {/* parte superior del sidebar */}

        <div className="sidebar__brand">
          {/* bloque del logo y nombre */}

          <div className="sidebar__logo">🛡</div>
          {/* logo simple por ahora */}

          <span className="sidebar__title">ActivoGestión</span>
          {/* nombre del sistema */}
        </div>
        {/* termina el bloque del logo */}

        <button type="button" className="sidebar__primaryButton">
          {/* boton principal */}

          <span className="sidebar__plus">+</span>
          {/* simbolo de sumar */}

          <span>Nuevo Activo</span>
          {/* texto del boton */}
        </button>
        {/* termina el boton principal */}

        <nav className="sidebar__nav">
          {/* navegacion principal */}

          <ul className="sidebar__menu">
            {/* lista del menu principal */}

            {mainItems.map((item) => (
              <li key={item.label} className="sidebar__item">
                {/* cada item del menu */}

                <button
                  type="button"
                  className={`sidebar__link ${item.active ? 'sidebar__link--active' : ''}`}
                >
                  {/* boton visual del item */}

                  <span className="sidebar__icon">{item.icon}</span>
                  {/* icono simple del item */}

                  <span className="sidebar__text">{item.label}</span>
                  {/* nombre del item */}
                </button>
                {/* termina el boton del item */}
              </li>
            ))}
            {/* recorre y pinta todos los items principales */}
          </ul>
          {/* termina la lista principal */}
        </nav>
        {/* termina la navegacion principal */}
      </div>
      {/* termina la parte superior */}

      <div className="sidebar__bottom">
        {/* parte inferior del sidebar */}

        <ul className="sidebar__menu">
          {/* lista inferior */}

          {bottomItems.map((item) => (
            <li key={item.label} className="sidebar__item">
              {/* cada item inferior */}

              <button type="button" className="sidebar__link">
                {/* boton visual inferior */}

                <span className="sidebar__icon">{item.icon}</span>
                {/* icono simple inferior */}

                <span className="sidebar__text">{item.label}</span>
                {/* texto del item inferior */}
              </button>
              {/* termina el boton inferior */}
            </li>
          ))}
          {/* recorre y pinta los items de abajo */}
        </ul>
        {/* termina la lista inferior */}
      </div>
      {/* termina la parte inferior */}
    </aside>
  );
// termina lo que renderiza el componente
}
// termina el componente