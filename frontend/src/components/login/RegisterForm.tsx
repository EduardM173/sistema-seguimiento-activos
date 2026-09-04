import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, register } from '../../services/auth.service';
import { useAuth } from '../../context/AuthContext';
import {
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMail,
  IconUser,
} from '../common/Icon';

export default function RegisterForm() {
  const navigate = useNavigate();
  const { setLoginData } = useAuth();

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (
      !nombres.trim() ||
      !apellidos.trim() ||
      !correo.trim() ||
      !nombreUsuario.trim() ||
      !password.trim()
    ) {
      setErrorMessage('Completa los datos obligatorios para crear la cuenta');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      setLoading(true);
      await register({
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim(),
        nombreUsuario: nombreUsuario.trim(),
        telefono: telefono.trim() || undefined,
        password,
      });

      // Log the new user straight in so registration is a single step.
      // Email confirmation is not enforced on login; if auto-login fails for
      // any reason, fall back to the "now sign in" message.
      try {
        const session = await login({
          identifier: correo.trim(),
          password,
        });
        sessionStorage.setItem('accessToken', session.accessToken);
        sessionStorage.setItem('usuario', JSON.stringify(session.usuario));
        setLoginData(session);
        navigate('/dashboard', { replace: true });
        return;
      } catch {
        setSuccessMessage(
          'Cuenta creada correctamente. Ya puedes iniciar sesión.',
        );
      }

      setNombres('');
      setApellidos('');
      setCorreo('');
      setNombreUsuario('');
      setTelefono('');
      setPassword('');
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
        <h2>Crear Cuenta</h2>
        <p>Registra tus datos para solicitar acceso al sistema.</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-form__row">
          <div className="form-group">
            <label htmlFor="nombres">Nombres</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <IconUser size={16} />
              </span>
              <input
                id="nombres"
                type="text"
                value={nombres}
                onChange={(event) => setNombres(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="apellidos">Apellidos</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <IconUser size={16} />
              </span>
              <input
                id="apellidos"
                type="text"
                value={apellidos}
                onChange={(event) => setApellidos(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="correo">Correo Electronico</label>
          <div className="input-wrapper">
            <span className="input-icon">
              <IconMail size={16} />
            </span>
            <input
              id="correo"
              type="email"
              placeholder="ejemplo@universidad.edu"
              value={correo}
              onChange={(event) => setCorreo(event.target.value)}
            />
          </div>
        </div>

        <div className="login-form__row">
          <div className="form-group">
            <label htmlFor="nombreUsuario">Usuario</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <IconUser size={16} />
              </span>
              <input
                id="nombreUsuario"
                type="text"
                value={nombreUsuario}
                onChange={(event) => setNombreUsuario(event.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="telefono">Telefono</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <IconUser size={16} />
              </span>
              <input
                id="telefono"
                type="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="register-password">Contraseña</label>
          <div className="input-wrapper">
            <span className="input-icon">
              <IconLock size={16} />
            </span>
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </div>

        {errorMessage && <div className="form-error">{errorMessage}</div>}
        {successMessage && (
          <div className="form-success">
            <IconCheck size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Registrando...' : 'Crear Cuenta'}
        </button>
      </form>

      <div className="login-card__footer">
        <span>¿Ya tienes cuenta?</span>
        <Link className="link-button" to="/">
          Iniciar sesion
        </Link>
      </div>
    </div>
  );
}
