import type { Config } from "drizzle-kit";

export default {
  schema: "./schema.ts",
  driver: "pg",
  dbCredentials: {
    connectionString: "postgres://postgres:postgres@localhost:5432/postgres",
  },
} satisfies Config;
