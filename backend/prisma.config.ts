import "dotenv/config";
import { defineConfig } from "prisma/config";

const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const host = process.env.POSTGRES_HOST || "localhost";
const port = process.env.POSTGRES_PORT || "5432";
const db = process.env.POSTGRES_DB;

if (!user || !password || !db) {
  throw new Error(
    "Faltan variables de entorno: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB"
  );
}

const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${db}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
