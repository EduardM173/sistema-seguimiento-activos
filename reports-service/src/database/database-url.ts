export function buildDatabaseUrl(): string {
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB;

  if (user && password && db) {
    return `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error(
    'Faltan variables de entorno para la base de datos: POSTGRES_USER, POSTGRES_PASSWORD y POSTGRES_DB',
  );
}
