import { useEffect, useMemo, useState } from 'react';

import OverlayModal from '../common/OverlayModal';
import { createUser, getUsers, updateUser } from '../../services/user.service';
import type { User } from '../../types/user.types';
import '../../styles/modules.css';

interface CreateUserProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

interface FormData {
  nombres: string;
  apellidos: string;
  correo: string;
  nombreUsuario: string;
  password: string;
  telefono: string;
}

interface FormErrors {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  nombreUsuario?: string;
  password?: string;
  telefono?: string;
  general?: string;
}

const initialForm: FormData = {
  nombres: '',
  apellidos: '',
  correo: '',
  nombreUsuario: '',
  password: '',
  telefono: '',
};

export default function CreateUser({ open, onClose, userId }: CreateUserProps) {
  const isEditMode = Boolean(userId);

  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!open) return;

    let ignore = false;

    setLoadingData(isEditMode);
    setErrors({});
    setTouched({});

    async function loadUsers() {
      try {
        const users = await getUsers();

        if (ignore) return;

        setExistingUsers(users);

        if (isEditMode && userId) {
          const currentUser = users.find((user) => user.id === userId);

          if (!currentUser) {
            setErrors({ general: 'No se encontró el usuario que deseas editar.' });
            return;
          }

          setForm({
            nombres: currentUser.nombres || '',
            apellidos: currentUser.apellidos || '',
            correo: currentUser.correo || '',
            nombreUsuario: currentUser.nombreUsuario || '',
            password: '',
            telefono: currentUser.telefono || '',
          });
        } else {
          setForm(initialForm);
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setErrors({ general: 'No se pudo cargar la información de usuarios.' });
        }
      } finally {
        if (!ignore) setLoadingData(false);
      }
    }

    void loadUsers();

    return () => {
      ignore = true;
    };
  }, [open, userId, isEditMode]);

  const passwordChecks = useMemo(() => {
    const password = form.password;
    return {
      minLength: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [form.password]);

  const passwordStrength = useMemo(
    () => Object.values(passwordChecks).filter(Boolean).length,
    [passwordChecks],
  );

  const passwordStrengthLabel = useMemo(() => {
    if (passwordStrength <= 2) return 'Débil';
    if (passwordStrength <= 4) return 'Media';
    return 'Fuerte';
  }, [passwordStrength]);

  const passwordBarColor = useMemo(() => {
    if (passwordStrength <= 2) return '#ef4444';
    if (passwordStrength <= 4) return '#f59e0b';
    return '#22c55e';
  }, [passwordStrength]);

  const validateField = (name: keyof FormData, value: string): string => {
    const trimmedValue = value.trim();

    switch (name) {
      case 'nombres':
        if (!trimmedValue) return 'El campo nombres es obligatorio.';
        if (trimmedValue.length < 2) return 'Los nombres deben tener al menos 2 caracteres.';
        return '';

      case 'apellidos':
        if (trimmedValue && trimmedValue.length < 2)
          return 'Los apellidos deben tener al menos 2 caracteres.';
        return '';

      case 'correo': {
        if (!trimmedValue) return 'El correo es obligatorio.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedValue)) return 'Ingresa un correo válido.';
        const exists = existingUsers.some(
          (user) =>
            user.id !== userId &&
            user.correo.toLowerCase() === trimmedValue.toLowerCase(),
        );
        if (exists) return 'Este correo ya está registrado.';
        return '';
      }

      case 'nombreUsuario': {
        if (!trimmedValue) return 'El nombre de usuario es obligatorio.';
        if (trimmedValue.length < 4) return 'El nombre de usuario debe tener al menos 4 caracteres.';
        const exists = existingUsers.some(
          (user) =>
            user.id !== userId &&
            user.nombreUsuario.toLowerCase() === trimmedValue.toLowerCase(),
        );
        if (exists) return 'Este nombre de usuario ya existe.';
        return '';
      }

      case 'password':
        if (isEditMode) return '';
        if (!value) return 'La contraseña es obligatoria.';
        if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
        if (!/[A-Z]/.test(value)) return 'Debe incluir al menos una letra mayúscula.';
        if (!/[a-z]/.test(value)) return 'Debe incluir al menos una letra minúscula.';
        if (!/\d/.test(value)) return 'Debe incluir al menos un número.';
        if (!/[^A-Za-z0-9]/.test(value)) return 'Debe incluir al menos un carácter especial.';
        return '';

      case 'telefono':
        if (trimmedValue && trimmedValue.length < 7)
          return 'El teléfono debe tener al menos 7 dígitos.';
        return '';

      default:
        return '';
    }
  };

  const validateForm = (): FormErrors => ({
    nombres: validateField('nombres', form.nombres),
    apellidos: validateField('apellidos', form.apellidos),
    correo: validateField('correo', form.correo),
    nombreUsuario: validateField('nombreUsuario', form.nombreUsuario),
    password: validateField('password', form.password),
    telefono: validateField('telefono', form.telefono),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name as keyof FormData, value) }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name as keyof FormData, value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    setTouched({
      nombres: true, apellidos: true, correo: true,
      nombreUsuario: true, password: true, telefono: true,
    });
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) return;

    setLoading(true);
    try {
      if (isEditMode && userId) {
        await updateUser(userId, {
          nombres: form.nombres,
          apellidos: form.apellidos,
          correo: form.correo,
          nombreUsuario: form.nombreUsuario,
          telefono: form.telefono,
        });
      } else {
        await createUser({
          nombres: form.nombres,
          apellidos: form.apellidos,
          correo: form.correo,
          nombreUsuario: form.nombreUsuario,
          password: form.password,
          telefono: form.telefono || undefined,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
      setErrors((prev) => ({
        ...prev,
        general:
          error instanceof Error ? error.message : 'Ocurrió un error al guardar el usuario.',
      }));
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = isEditMode ? 'Editar Usuario' : 'Crear Usuario';
  const pageSubtitle = isEditMode
    ? 'Completa o actualiza la información básica del usuario.'
    : 'Registra un nuevo usuario para la gestión del sistema.';
  const submitLabel = isEditMode ? 'Guardar cambios' : 'Guardar usuario';

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      title={pageTitle}
      subtitle={pageSubtitle}
      disabled={loading}
      width="700px"
    >
      {loadingData ? (
        <p style={{ color: '#64748b', margin: 0 }}>Cargando información del usuario...</p>
      ) : (
        <form onSubmit={handleSubmit} className="form-container" noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label>
                Nombres <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                name="nombres"
                value={form.nombres}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ingresa los nombres"
                style={{ borderColor: errors.nombres ? '#dc2626' : undefined }}
              />
              {errors.nombres && (
                <span style={{ color: '#dc2626', fontSize: '13px' }}>{errors.nombres}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                Apellidos{' '}
                <span
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    background: '#f1f5f9',
                    borderRadius: '999px',
                    padding: '2px 8px',
                  }}
                >
                  Opcional
                </span>
              </label>
              <input
                name="apellidos"
                value={form.apellidos}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Puedes completarlo después"
                style={{ borderColor: errors.apellidos ? '#dc2626' : undefined }}
              />
              {errors.apellidos && (
                <span style={{ color: '#dc2626', fontSize: '13px' }}>{errors.apellidos}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                Correo <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                name="correo"
                type="email"
                value={form.correo}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="usuario@universidad.edu"
                style={{ borderColor: errors.correo ? '#dc2626' : undefined }}
              />
              {errors.correo && (
                <span style={{ color: '#dc2626', fontSize: '13px' }}>{errors.correo}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                Nombre de usuario <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                name="nombreUsuario"
                value={form.nombreUsuario}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ingresa el nombre de usuario"
                style={{ borderColor: errors.nombreUsuario ? '#dc2626' : undefined }}
              />
              {errors.nombreUsuario && (
                <span style={{ color: '#dc2626', fontSize: '13px' }}>{errors.nombreUsuario}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                Teléfono{' '}
                <span
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    background: '#f1f5f9',
                    borderRadius: '999px',
                    padding: '2px 8px',
                  }}
                >
                  Opcional
                </span>
              </label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ejemplo: 70000000"
                style={{ borderColor: errors.telefono ? '#dc2626' : undefined }}
              />
              {errors.telefono && (
                <span style={{ color: '#dc2626', fontSize: '13px' }}>{errors.telefono}</span>
              )}
            </div>
          </div>

          {!isEditMode && (
            <div className="form-group form-full" style={{ marginTop: '16px' }}>
              <label>
                Contraseña <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Ingresa una contraseña segura"
                style={{ borderColor: errors.password ? '#dc2626' : undefined }}
              />

              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: '#e2e8f0',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  marginTop: '10px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: '999px',
                    transition: 'all 0.3s ease',
                    width: `${(passwordStrength / 5) * 100}%`,
                    backgroundColor: passwordBarColor,
                  }}
                />
              </div>
              <p style={{ color: '#475569', fontSize: '13px', margin: '6px 0 8px' }}>
                Seguridad: <strong>{passwordStrengthLabel}</strong>
              </p>

              <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', lineHeight: '1.8' }}>
                <li style={{ color: passwordChecks.minLength ? '#16a34a' : '#94a3b8' }}>
                  Mínimo 8 caracteres
                </li>
                <li style={{ color: passwordChecks.upper ? '#16a34a' : '#94a3b8' }}>
                  Al menos una mayúscula
                </li>
                <li style={{ color: passwordChecks.lower ? '#16a34a' : '#94a3b8' }}>
                  Al menos una minúscula
                </li>
                <li style={{ color: passwordChecks.number ? '#16a34a' : '#94a3b8' }}>
                  Al menos un número
                </li>
                <li style={{ color: passwordChecks.special ? '#16a34a' : '#94a3b8' }}>
                  Al menos un carácter especial
                </li>
              </ul>

              {errors.password && (
                <span
                  style={{
                    color: '#dc2626',
                    fontSize: '13px',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  {errors.password}
                </span>
              )}
            </div>
          )}

          {errors.general && (
            <p
              style={{
                color: '#dc2626',
                fontSize: '13px',
                marginTop: '12px',
                background: '#fef2f2',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #fecaca',
              }}
            >
              {errors.general}
            </p>
          )}

          <div className="overlayModal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      )}
    </OverlayModal>
  );
}
