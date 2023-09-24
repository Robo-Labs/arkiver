import { Logger } from "pino";
import { ArkiveManifest } from "../types/manifest";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ArkiveRecord } from "../types/record";

export interface ArkiverParams {
  manifest: ArkiveManifest;
  rpcUrls?: Record<string, string>;
  db: PostgresJsDatabase;
  logger: Logger;
  record: ArkiveRecord;
}

export class Arkiver {
  #manifest: ArkiveManifest;
  #rpcUrls?: Record<string, string>;
  #db: PostgresJsDatabase;
  #logger: Logger;
  #record: ArkiveRecord;

  constructor({ db, manifest, rpcUrls, logger, record }: ArkiverParams) {
    this.#manifest = manifest;
    this.#rpcUrls = rpcUrls;
    this.#db = db;
    this.#logger = logger.child({
      arkiveName: manifest.name,
      arkiveId: record.id,
      deploymentId: record.deployment.id,
      deploymentStage: record.deployment.stage,
    });
    this.#record = record;
  }

  async start() {
    this.#logger.info("Starting arkiver");
  }
}
