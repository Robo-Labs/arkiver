#!/usr/bin/env bun
import pkg from "./package.json";
import { runDev } from "./src/cli/run-dev";
import { defineCommand, runMain } from "citty";
import { generateMigrations } from "./src/db/postgres/generate-migrations";
import path from "node:path";

const manifestArg = {
  type: "string",
  default: "./manifest.ts",
  description: "Path to the arkive manifest file",
  valueHint: "path/to/manifest.ts",
  alias: "m",
  required: false,
} as const;

const outArg = {
  type: "string",
  default: "./migrations",
  description: "Path to the output migrations directory",
  valueHint: "path/to/migrations",
  alias: "o",
  required: false,
} as const;

const devCommand = defineCommand({
  meta: {
    description: "Run the Arkiver in development mode",
  },
  args: {
    manifest: manifestArg,
    out: outArg,
    db: {
      type: "string",
      default: "postgres://postgres:postgres@localhost:5432/arkiver",
      description: "Postgres connection string",
      required: false,
      valueHint: "postgres://user:pass@host:port/db",
      alias: "d",
    },
    logLevel: {
      type: "string",
      default: "info",
      description: "Log level",
      required: false,
      valueHint: "info|debug|trace",
      alias: "l",
    },
  },
  run: async ({ args }) => {
    await runDev({
      manifestPath: args.manifest,
      migrationsDir: args.out,
      pgConnectionString: args.db,
      logLevel: args.logLevel,
    });
  },
});

const genCommand = defineCommand({
  meta: {
    description: "Generate migration files for your Arkive schema",
  },
  args: {
    manifest: manifestArg,
    out: outArg,
  },
  run: ({ args }) => {
    const bunxExe = Bun.which("bunx");
    if (!bunxExe) throw new Error("bun not installed.");
    generateMigrations({
      bunxExe,
      migrationsDir: args.out,
      schemaPath: path.join(process.cwd(), "__schema.ts"),
    });
  },
});

const main = defineCommand({
  meta: {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
  },
  subCommands: {
    dev: devCommand,
    gen: genCommand,
  },
});

await runMain(main);
