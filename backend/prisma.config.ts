// Prisma 7 CLI config. Prisma 7 removed `url` from the schema datasource block,
// so `prisma migrate deploy` (run in the backend container on start — see
// docker-compose.prod.yml) reads the connection string from here.
// The NestJS runtime does NOT use this file; it connects through the PrismaPg
// driver adapter built from POSTGRES_* (see src/common/prisma.service.ts).
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
