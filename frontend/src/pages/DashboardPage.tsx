import Navbar from '../components/navbar/Navbar';
// importa el componente del navbar lateral

export default function DashboardPage() {
  // crea la pagina del dashboard

  return (
    // devuelve lo que se vera en pantalla
    <div className="dashboardPage">
      {/* contenedor general de la pagina */}

      <Navbar />
      {/* muestra el navbar lateral */}

      <main className="dashboardContent">
        {/* contenedor del contenido principal */}

        <section className="dashboardCard">
          {/* tarjeta simple de contenido */}

          <h1>Panel principal</h1>
          {/* titulo pequeño de la pagina */}
        </section>
        {/* termina la tarjeta */}
      </main>
      {/* termina el contenido principal */}
    </div>
    // termina lo que renderiza la pagina
  );
  // termina el return
}
// termina el componente