function getStoredUser() {
  const userFromLocal = localStorage.getItem('auth_user');
  const userFromSession = sessionStorage.getItem('auth_user');

  const rawUser = userFromLocal || userFromSession;

  return rawUser ? JSON.parse(rawUser) : null;
}

function clearAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('auth_user');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('auth_user');
}

export default function DashboardPage() {
  const user = getStoredUser();

  function handleLogout() {
    clearAuth();
    window.location.href = '/';
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>Panel Principal</h1>
      <p>Inicio de sesión completado correctamente.</p>

      {user && (
        <div style={{ marginTop: '1rem' }}>
          <p>
            <strong>Usuario:</strong> {user.firstName} {user.lastName}
          </p>
          <p>
            <strong>Correo:</strong> {user.email}
          </p>
          <p>
            <strong>Rol:</strong> {user.role.name}
          </p>
          <p>
            <strong>Área:</strong> {user.area?.name || 'Sin área'}
          </p>
        </div>
      )}

      <button
        onClick={handleLogout}
        style={{
          marginTop: '1.5rem',
          padding: '0.8rem 1rem',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}