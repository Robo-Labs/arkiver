#!/usr/bin/env bun
import pkg from "./package.json";
import { runDev } from "./src/core/run-dev";
import { defineCommand, runMain } from "citty";
import { generateMigrations } from "./src/db/postgres/generate-migrations";

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
  description: "Path to the output directory",
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
  },
  run: async ({ args }) => {
    await runDev({ manifestPath: args.manifest, migrationsDir: args.out });
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
    generateMigrations({
      manifestPath: args.manifest,
      migrationsDir: args.out,
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
