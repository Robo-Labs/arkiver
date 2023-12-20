import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  driver: "pg",
  schema: "./schema/index.ts",
  dbCredentials: {
    connectionString: dbUrl,
  },
	out: "./drizzle"
});
