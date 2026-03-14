import LoginForm from '../components/login/LoginForm';
import '../styles/login.css';

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-background-word">ACTIVO</div>

      <div className="login-container">
        <header className="login-brand">
          <div className="brand-logo">🛡</div>
          <div>
            <h1>ActivoGestión</h1>
            <h2>Portal Institucional</h2>
            <p>Sistema Central de Gestión de Activos</p>
          </div>
        </header>

        <LoginForm />

        <footer className="login-footer">
          <div className="login-footer__links">
            
          </div>

          <p>
            © 2026 DIRECCIÓN GENERAL DE TECNOLOGÍAS DE LA INFORMACIÓN
            <br />
            SUBDIRECCIÓN DE ACTIVOS Y SUMINISTROS
          </p>
        </footer>
      </div>
    </div>
  );
}