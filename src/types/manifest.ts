import { Abi } from "abitype";
import { supportedChains } from "../utils/chains";
import { EventHandler } from "./event-handler";
import { BlockHandler } from "./block-handler";

export type Chains = keyof typeof supportedChains | (string & {});

export interface ArkiveManifest<TContext extends {}> {
  dataSources: Partial<Record<Chains, DataSourceManifest<TContext>>>;
  tables: {}[];
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
  events: Record<string, EventHandler<Abi, string, TContext>>;
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
