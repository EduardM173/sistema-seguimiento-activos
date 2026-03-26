/**
 * Constructs the PostgreSQL connection URL from individual environment variables.
 * This ensures consistency — the DB credentials are defined once in .env
 * and the URL is always derived from them.
 */
export function buildDatabaseUrl(): string {
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB;

  if (!user || !password || !db) {
    throw new Error(
      'Faltan variables de entorno para la base de datos. ' +
      'Verifique que POSTGRES_USER, POSTGRES_PASSWORD y POSTGRES_DB estén definidas en el archivo .env',
    );
  }

  return `postgresql://${user}:${password}@${host}:${port}/${db}`;
}
