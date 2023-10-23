import { ExtractAbiEventNames, ExtractAbiEvent } from "abitype";
import { Logger } from "pino";
import { Abi, Block, Log, GetContractReturnType, PublicClient } from "viem";
import { DataSourceBuilder } from "./data-source";
import { Store } from "../../utils/store";
import { supportedChains } from "../chains";
import { ArkiveClient } from "../client";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventHandler } from "./event-handler";

export const manifestVersion = "v1";

export class Manifest<TContext extends {} = {}, TChains extends Chains = ""> {
  manifest: ArkiveManifest<TContext>;

  constructor(name: string) {
    if (name.search(/[^a-zA-Z0-9_-]/g) !== -1) {
      throw new Error(`Invalid name: ${name}`);
    }
    const formattedName = name.replace(" ", "-").toLowerCase();

    this.manifest = {
      name: formattedName,
      version: manifestVersion,
      dataSources: {},
      schema: {},
    };
  }

  chain<TChain extends Exclude<Chains, TChains>>(
    chain: TChain,
    builderFn: (builder: DataSourceBuilder<{}, TContext>) => void
  ): Manifest<TContext, TChains | TChain> {
    builderFn(new DataSourceBuilder(this, chain));
    if (this.manifest.dataSources[chain]?.options.rpcUrls.length === 0) {
      throw new Error(`At least one RPC URL is required for chain ${chain}`);
    }
    return this;
  }

  schema<TSchema extends Record<string, unknown>>(
    schema: TSchema
  ): Manifest<TContext & { db: PostgresJsDatabase<TSchema> }, TChains> {
    this.manifest.schema = schema;
    return this;
  }
}

export type Chains = keyof typeof supportedChains | (string & {});

export interface ArkiveManifest<TContext extends {}> {
  dataSources: Partial<Record<Chains, DataSourceManifest<TContext>>>;
  schema: Record<string, unknown>;
  name: string;
  version: string;
}

export interface DataSourceManifest<TContext extends {}> {
  contracts: Record<string, Contract<TContext>>;
  blockHandlers: BlockHandlerInfo<TContext>[];
  options: ChainOptions;
}

export interface Contract<TContext extends {}> {
  abi: Abi;
  sources: Record<string, bigint | "live">;
  factorySources: Record<string, Record<string, string>>;
  events: Record<string, EventHandler<Abi, string, boolean, TContext>>;
  id: string;
}

export interface ChainOptions {
  blockRange: bigint;
  rpcUrls: string[];
}

export interface BlockHandlerInfo<TContext extends {}> {
  handler: BlockHandler<TContext>;
  startBlockHeight: bigint | "live";
  blockInterval: bigint;
  name: string;
}

export type BlockHandler<ExtendedContext extends {}> = (
  ctx: BlockHandlerContext<ExtendedContext>
) => Promise<void> | void;

export type BlockHandlerContext<ExtendedContext extends {}> = {
  block: Block<bigint, false>;
  client: ArkiveClient;
  store: Store;
  logger: Logger;
} & ExtendedContext;
