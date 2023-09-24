import { Logger } from "pino";
import { ArkiveManifest } from "../types/manifest";
import { ArkiveRecord } from "../types/record";
import { DbProvider } from "./db-provider";

export interface ArkiverParams {
  manifest: ArkiveManifest;
  rpcUrls?: Record<string, string>;
  dbProvider: DbProvider;
  record: ArkiveRecord;
}

export class Arkiver {
  #manifest: ArkiveManifest;
  #rpcUrls?: Record<string, string>;
  #dbProvider: DbProvider;
  #record: ArkiveRecord;

  constructor({ dbProvider, manifest, rpcUrls, record }: ArkiverParams) {
    this.#manifest = manifest;
    this.#rpcUrls = rpcUrls;
    this.#dbProvider = dbProvider;
    this.#record = record;
  }

  async start() {}
}
