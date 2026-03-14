import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../../services/auth.service';

export default function LoginForm() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [keepSession, setKeepSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Debe completar el usuario/correo y la contraseña');
      return;
    }

    try {
      setLoading(true);

      const response = await loginRequest({
        identifier: identifier.trim(),
        password,
      });

      if (keepSession) {
        localStorage.setItem('access_token', response.accessToken);
        localStorage.setItem('auth_user', JSON.stringify(response.usuario));
      } else {
        sessionStorage.setItem('access_token', response.accessToken);
        sessionStorage.setItem('auth_user', JSON.stringify(response.usuario));
      }

      navigate('/dashboard');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ocurrió un error inesperado';

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-card__header">
        <h2>Acceso al Sistema</h2>
        <p>Ingrese sus credenciales para continuar.</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="identifier">Correo Electrónico  Usuario</label>
          <div className="input-wrapper">
            <span className="input-icon">✉</span>
            <input
              id="identifier"
              type="text"
              placeholder="ejemplo@universidad.edu"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <div className="password-label-row">
            <label htmlFor="password">Contraseña</label>
            <button
              type="button"
              className="link-button"
              onClick={() =>
                alert('Esta opción se implementará más adelante.')
              }
            >
              ¿Olvidó su contraseña?
            </button>
          </div>

          <div className="input-wrapper">
            <span className="input-icon">🔒</span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Ingrese su contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={keepSession}
            onChange={(e) => setKeepSession(e.target.checked)}
          />
          <span>Mantener sesión iniciada</span>
        </label>

        {errorMessage && <div className="form-error">{errorMessage}</div>}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Ingresando...' : 'Iniciar Sesión →'}
        </button>
      </form>

      <div className="login-card__footer">
        <span>🛡 Conexión cifrada de alta seguridad</span>
      </div>
    </div>
  );
}