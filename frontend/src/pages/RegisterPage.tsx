import RegisterForm from '../components/login/RegisterForm';
import { IconShield } from '../components/common/Icon';
import '../styles/login.css';

export default function RegisterPage() {
  return (
    <div className="login-page">
      <div className="login-panel-left">
        <div className="login-panel-left__brand">
          <div className="login-panel-left__logo">
            <IconShield size={22} color="#003B75" />
          </div>
          <div className="login-panel-left__name">
            ActivoGestion
            <span>Portal Institucional</span>
          </div>
        </div>
      </div>

      <div className="login-panel-right">
        <div className="login-container">
          <header className="login-brand">
            <div className="brand-logo">
              <IconShield size={20} color="#FFE000" />
            </div>
            <div>
              <h1>ActivoGestion</h1>
            </div>
          </header>

          <RegisterForm />

          <footer className="login-footer">
            <p>
              © 2026 DIRECCION GENERAL DE TECNOLOGIAS DE LA INFORMACION
              <br />
              SUBDIRECCION DE ACTIVOS Y SUMINISTROS
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
