import { drizzle as bunsqliteDrizzle } from "drizzle-orm/bun-sqlite";
import { generateMigrations } from "../db/postgres/generate-migrations";
import Database from "bun:sqlite";
import { arkiveMetadata } from "./tables/arkive-metadata";
import { chainMetadata } from "./tables/chain-metadata";
import { childSource } from "./tables/child-source";
import { BunSqliteProvider } from "./db-provider";
import pino from "pino";
import { drizzle as postgresjsDrizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import { Arkiver } from "./arkiver";
import { Manifest } from ".";
import { reexportSchema } from "../db/postgres/reexport-schema";
import { runStudio } from "../db/postgres/run-studio";

export const runDev = async ({
  manifestPath,
  migrationsDir,
  pgConnectionString,
	logLevel
}: {
  manifestPath: string;
  migrationsDir: string;
  pgConnectionString: string;
	logLevel: string
}) => {
	console.clear()
  const cwd = process.cwd();
  const bunxExe = Bun.which("bunx");
  if (!bunxExe) throw new Error("bun not installed.");
  // generate and run migrations
  const { deleteFile, schemaPath } = reexportSchema({ manifestPath });
  generateMigrations({ schemaPath, migrationsDir, bunxExe });
  const migrationDb = postgresjsDrizzle(
    postgres(pgConnectionString, { max: 1 })
  );

  try {
    await migrate(migrationDb, {
      migrationsFolder: path.join(cwd, migrationsDir),
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  // arkiver initialization
  const logger = pino({ transport: { target: "pino-pretty" }, level: logLevel });

  const sqlite = bunsqliteDrizzle(new Database("arkiver.sqlite"), {
    schema: { arkiveMetadata, chainMetadata, childSource },
  });
  const dbProvider = new BunSqliteProvider({ db: sqlite, logger });

  const { manifest } = (await import(path.join(cwd, manifestPath)))
    .default as Manifest;
  const schema = manifest.schema;
  const db = postgresjsDrizzle(postgres(pgConnectionString), { schema });
  const context = { db };

  const arkiver = new Arkiver({
    context,
    dbProvider,
    manifest,
    logger,
  });

  await arkiver.start();

	await runStudio({
		bunxExe,
		connectionString: pgConnectionString,
		schemaPath
	})

  deleteFile()
};
