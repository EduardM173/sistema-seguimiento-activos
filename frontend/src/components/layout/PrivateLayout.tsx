import { Outlet } from 'react-router-dom';
// importa outlet para mostrar la pagina interna

import Navbar from '../navbar/Navbar';
// importa el navbar global

export default function PrivateLayout() {
  // layout base para todas las paginas privadas

  return (
    <div className="appLayout">
      {/* contenedor general del area privada */}

      <Navbar />
      {/* navbar lateral global */}

      <main className="appContent">
        {/* aqui va cambiando el contenido de cada pagina */}
        <Outlet />
        {/* renderiza la pagina hija */}
      </main>
    </div>
  );
}