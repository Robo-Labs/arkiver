import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { BaseManifest } from "./base-manifest";

export class Manifest<
  TSchema extends Record<string, unknown>
> extends BaseManifest<{ db: PostgresJsDatabase<TSchema> }> {
  constructor(schema: TSchema) {
    const name = process.env.ARKIVE_NAME;
    if (!name) throw new Error("No name provided for manifest");
    super(name);
  }
}
