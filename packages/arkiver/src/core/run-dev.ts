import { drizzle } from "drizzle-orm/bun-sqlite";
import { generateMigrations } from "../db/postgres/generate-migrations";
import Database from "bun:sqlite";
import { arkiveMetadata } from "./tables/arkive-metadata";
import { chainMetadata } from "./tables/chain-metadata";
import { childSource } from "./tables/child-source";
import { BunSqliteProvider } from "./db-provider";
import pino from "pino";

export const runDev = async ({
  manifestPath,
  migrationsDir,
}: {
  manifestPath: string;
  migrationsDir: string;
}) => {
  generateMigrations({ manifestPath, migrationsDir });

  const sqlite = drizzle(new Database("arkiver.sqlite"), {
    schema: { arkiveMetadata, chainMetadata, childSource },
  });

  const logger = pino({ transport: { target: "pino-pretty" } });

  const dbProvider = new BunSqliteProvider({ db: sqlite, logger });
};
