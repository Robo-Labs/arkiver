import { Logger } from "pino";
import { Abi, Block } from "viem";
import { ArkiveClient } from "./client";
import { EventHandler, EventHandlerHook } from "./event-handler";

export interface ArkiveManifest<TStore extends {}> {
  dataSources: Record<string, DataSourceManifest<TStore>>;
}

export interface DataSourceManifest<TStore extends {}> {
  contracts: Record<string, Contract<TStore>>;
  options: ChainOptions;
  beforeHandle?: EventHandlerHook<TStore, string>;
  afterHandle?: EventHandlerHook<TStore, string>;
}

export interface Contract<TStore extends {}> {
  abi: Abi;
  sources: Record<string, bigint | "live">;
  factorySources: Record<string, Record<string, string>>;
  events: Record<string, EventHandler<Abi, string, string, TStore>>;
  id: string;
}

export interface ChainOptions {
  blockRange: bigint;
  rpcUrls: string[];
}
