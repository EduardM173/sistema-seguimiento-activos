import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { createUser, getUsers, updateUser } from '../../services/user.service';
import type { User } from '../../types/user.types';

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

export default function CreateUser() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);

  useEffect(() => {
    let ignore = false;

    async function loadUsers() {
      try {
        const users = await getUsers();

        if (ignore) {
          return;
        }

        setExistingUsers(users);

        if (isEditMode) {
          const currentUser = users.find((user) => user.id === id);

          if (!currentUser) {
            setErrors({
              general: 'No se encontro el usuario que deseas editar.',
            });
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
        }
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setErrors({
            general: 'No se pudo cargar la informacion de usuarios.',
          });
        }
      } finally {
        if (!ignore) {
          setLoadingData(false);
        }
      }
    }

    loadUsers();

    return () => {
      ignore = true;
    };
  }, [id, isEditMode]);

  const passwordChecks = useMemo(() => {
    const password = form.password;

    return {
      minLength: password.length >= 8,
      upper: /[A-ZA-Z]/.test(password) && /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [form.password]);

  const passwordStrength = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length;
  }, [passwordChecks]);

  const passwordStrengthLabel = useMemo(() => {
    if (passwordStrength <= 2) return 'Debil';
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
        if (trimmedValue.length < 2) {
          return 'Los nombres deben tener al menos 2 caracteres.';
        }
        return '';

      case 'apellidos':
        if (trimmedValue && trimmedValue.length < 2) {
          return 'Los apellidos deben tener al menos 2 caracteres.';
        }
        return '';

      case 'correo': {
        if (!trimmedValue) return 'El correo es obligatorio.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedValue)) return 'Ingresa un correo valido.';

        const exists = existingUsers.some(
          (user) =>
            user.id !== id &&
            user.correo.toLowerCase() === trimmedValue.toLowerCase(),
        );

        if (exists) return 'Este correo ya esta registrado.';

        return '';
      }

      case 'nombreUsuario': {
        if (!trimmedValue) return 'El nombre de usuario es obligatorio.';
        if (trimmedValue.length < 4) {
          return 'El nombre de usuario debe tener al menos 4 caracteres.';
        }

        const exists = existingUsers.some(
          (user) =>
            user.id !== id &&
            user.nombreUsuario.toLowerCase() === trimmedValue.toLowerCase(),
        );

        if (exists) return 'Este nombre de usuario ya existe.';

        return '';
      }

      case 'password':
        if (isEditMode) return '';
        if (!value) return 'La contrasena es obligatoria.';
        if (value.length < 8) {
          return 'La contrasena debe tener al menos 8 caracteres.';
        }
        if (!/[A-Z]/.test(value)) {
          return 'Debe incluir al menos una letra mayuscula.';
        }
        if (!/[a-z]/.test(value)) {
          return 'Debe incluir al menos una letra minuscula.';
        }
        if (!/\d/.test(value)) return 'Debe incluir al menos un numero.';
        if (!/[^A-Za-z0-9]/.test(value)) {
          return 'Debe incluir al menos un caracter especial.';
        }
        return '';

      case 'telefono':
        if (trimmedValue && trimmedValue.length < 7) {
          return 'El telefono debe tener al menos 7 digitos.';
        }
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

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateField(name as keyof FormData, value),
      }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: validateField(name as keyof FormData, value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();

    setTouched({
      nombres: true,
      apellidos: true,
      correo: true,
      nombreUsuario: true,
      password: true,
      telefono: true,
    });

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((error) => error);
    if (hasErrors) {
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && id) {
        await updateUser(id, {
          nombres: form.nombres,
          apellidos: form.apellidos,
          correo: form.correo,
          nombreUsuario: form.nombreUsuario,
          telefono: form.telefono,
        });

        navigate('/users', {
          state: {
            successMessage: 'Usuario actualizado correctamente.',
          },
        });
        return;
      }

      await createUser({
        nombres: form.nombres,
        apellidos: form.apellidos,
        correo: form.correo,
        nombreUsuario: form.nombreUsuario,
        password: form.password,
        telefono: form.telefono || undefined,
      });

      navigate('/users', {
        state: {
          successMessage: 'Usuario creado correctamente.',
        },
      });
    } catch (error) {
      console.error(error);
      setErrors((prev) => ({
        ...prev,
        general:
          error instanceof Error
            ? error.message
            : 'Ocurrio un error al guardar el usuario.',
      }));
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = isEditMode ? 'Editar Usuario' : 'Crear Usuario';
  const pageSubtitle = isEditMode
    ? 'Completa o actualiza la informacion basica del usuario.'
    : 'Registra un nuevo usuario para la gestion del sistema.';
  const submitLabel = isEditMode ? 'Guardar cambios' : 'Guardar usuario';

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>{pageTitle}</h1>
            <p style={subtitleStyle}>{pageSubtitle}</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/users')}
            style={secondaryButtonStyle}
          >
            Volver
          </button>
        </div>

        {loadingData ? (
          <p style={helperStyle}>Cargando informacion del usuario...</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Nombres</label>
                <input
                  name="nombres"
                  value={form.nombres}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ingresa los nombres"
                  style={inputStyle(errors.nombres)}
                />
                {errors.nombres && <p style={errorStyle}>{errors.nombres}</p>}
              </div>

              <div>
                <label style={labelStyle}>
                  Apellidos
                  <span style={optionalLabelStyle}>Opcional</span>
                </label>
                <input
                  name="apellidos"
                  value={form.apellidos}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Puedes completarlo despues"
                  style={inputStyle(errors.apellidos)}
                />
                {errors.apellidos && <p style={errorStyle}>{errors.apellidos}</p>}
              </div>

              <div>
                <label style={labelStyle}>Correo</label>
                <input
                  name="correo"
                  type="email"
                  value={form.correo}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="usuario@universidad.edu"
                  style={inputStyle(errors.correo)}
                />
                {errors.correo && <p style={errorStyle}>{errors.correo}</p>}
              </div>

              <div>
                <label style={labelStyle}>Nombre de usuario</label>
                <input
                  name="nombreUsuario"
                  value={form.nombreUsuario}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ingresa el nombre de usuario"
                  style={inputStyle(errors.nombreUsuario)}
                />
                {errors.nombreUsuario && (
                  <p style={errorStyle}>{errors.nombreUsuario}</p>
                )}
              </div>

              <div>
                <label style={labelStyle}>
                  Telefono
                  <span style={optionalLabelStyle}>Opcional</span>
                </label>
                <input
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ejemplo: 70000000"
                  style={inputStyle(errors.telefono)}
                />
                {errors.telefono && <p style={errorStyle}>{errors.telefono}</p>}
              </div>
            </div>

            {!isEditMode && (
              <div style={{ marginTop: '20px' }}>
                <label style={labelStyle}>Contrasena</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Ingresa una contrasena segura"
                  style={inputStyle(errors.password)}
                />

                <div style={progressContainerStyle}>
                  <div
                    style={{
                      ...progressBarStyle,
                      width: `${(passwordStrength / 5) * 100}%`,
                      backgroundColor: passwordBarColor,
                    }}
                  />
                </div>

                <p style={{ ...helperStyle, marginTop: '8px' }}>
                  Seguridad de la contrasena: <strong>{passwordStrengthLabel}</strong>
                </p>

                <ul style={rulesListStyle}>
                  <li style={ruleItemStyle(passwordChecks.minLength)}>
                    Minimo 8 caracteres
                  </li>
                  <li style={ruleItemStyle(passwordChecks.upper)}>
                    Al menos una mayuscula
                  </li>
                  <li style={ruleItemStyle(passwordChecks.lower)}>
                    Al menos una minuscula
                  </li>
                  <li style={ruleItemStyle(passwordChecks.number)}>
                    Al menos un numero
                  </li>
                  <li style={ruleItemStyle(passwordChecks.special)}>
                    Al menos un caracter especial
                  </li>
                </ul>

                {errors.password && <p style={errorStyle}>{errors.password}</p>}
              </div>
            )}

            {errors.general && (
              <p style={{ ...errorStyle, marginTop: '16px' }}>{errors.general}</p>
            )}

            <div style={actionsStyle}>
              <button
                type="button"
                onClick={() => navigate('/users')}
                style={secondaryButtonStyle}
              >
                Cancelar
              </button>

              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? 'Guardando...' : submitLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: '32px',
};

const cardStyle: React.CSSProperties = {
  maxWidth: '950px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '32px',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '24px',
  gap: '16px',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '36px',
  fontWeight: 700,
  color: '#1e293b',
};

const subtitleStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  fontSize: '16px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '20px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '8px',
  fontWeight: 600,
  color: '#334155',
  fontSize: '14px',
};

const optionalLabelStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: '12px',
  color: '#64748b',
  backgroundColor: '#f1f5f9',
  borderRadius: '999px',
  padding: '2px 8px',
};

const inputStyle = (error?: string): React.CSSProperties => ({
  width: '100%',
  padding: '12px 14px',
  borderRadius: '10px',
  border: error ? '1px solid #ef4444' : '1px solid #cbd5e1',
  outline: 'none',
  fontSize: '15px',
  boxSizing: 'border-box',
  backgroundColor: '#fff',
});

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '13px',
  marginTop: '6px',
  marginBottom: 0,
};

const helperStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: '14px',
  margin: 0,
};

const progressContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '10px',
  backgroundColor: '#e2e8f0',
  borderRadius: '999px',
  overflow: 'hidden',
  marginTop: '12px',
};

const progressBarStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '999px',
  transition: 'all 0.3s ease',
};

const rulesListStyle: React.CSSProperties = {
  marginTop: '10px',
  paddingLeft: '20px',
  color: '#475569',
  fontSize: '14px',
};

const ruleItemStyle = (valid: boolean): React.CSSProperties => ({
  color: valid ? '#16a34a' : '#64748b',
  marginBottom: '4px',
});

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  marginTop: '28px',
};

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: '10px',
  padding: '12px 18px',
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#334155',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  padding: '12px 18px',
  cursor: 'pointer',
  fontWeight: 600,
};
