import { Abi } from "abitype";
import { supportedChains } from "../utils/chains";
import { EventHandler } from "./event-handler";
import { BlockHandler } from "./block-handler";

export type Chains = keyof typeof supportedChains | (string & {});

export interface ArkiveManifest {
  dataSources: Partial<Record<Chains, DataSource>>;
  tables: {}[];
  name: string;
  version: string;
}

export interface DataSource {
  contracts: Record<string, Contract>;
  blockHandlers: BlockHandlerInfo[];
  options: ChainOptions;
}

export interface Contract {
  abi: Abi;
  sources: Record<string, bigint>;
  factorySources: Record<string, Record<string, string>>;
  events: Record<string, EventHandler<Abi, string>>;
  id: string;
}

export interface ChainOptions {
  blockRange: bigint;
  rpcUrl: string;
}

export interface BlockHandlerInfo {
  handler: BlockHandler;
  startBlockHeight: bigint | "live";
  blockInterval: bigint;
  name: string;
}
