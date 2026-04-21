import LoginForm from '../components/login/LoginForm';
import { IconShield } from '../components/common/Icon';
import '../styles/login.css';

export default function LoginPage() {
  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-panel-left">
        <div className="login-panel-left__brand">
          <div className="login-panel-left__logo">
            <IconShield size={22} color="#003B75" />
          </div>
          <div className="login-panel-left__name">
            ActivoGestión
            <span>Portal Institucional</span>
          </div>
        </div>
        <h2 className="login-panel-left__tagline">
          Gestiona tus activos con <em>precisión</em> y eficiencia.
        </h2>
        <p className="login-panel-left__sub">
          Sistema centralizado de control, seguimiento y auditoría
          de activos institucionales.
        </p>
      </div>

      {/* Right form panel */}
      <div className="login-panel-right">
        <div className="login-container">
          {/* Mobile brand (hidden on desktop) */}
          <header className="login-brand">
            <div className="brand-logo">
              <IconShield size={20} color="#FFE000" />
            </div>
            <div>
              <h1>ActivoGestión</h1>
            </div>
          </header>

          <LoginForm />

          <footer className="login-footer">
            <div className="login-footer__links">
              <span>Soporte TI</span>
              <span>Políticas</span>
            </div>
            <p>
              © 2026 DIRECCIÓN GENERAL DE TECNOLOGÍAS DE LA INFORMACIÓN
              <br />
              SUBDIRECCIÓN DE ACTIVOS Y SUMINISTROS
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
