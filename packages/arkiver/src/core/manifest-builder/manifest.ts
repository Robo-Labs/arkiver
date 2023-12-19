import { ExtractAbiEventNames, ExtractAbiEvent } from "abitype";
import { Logger } from "pino";
import { Abi, Block, Log, GetContractReturnType, PublicClient } from "viem";
import { DataSourceBuilder } from "./data-source";
import { Store } from "../../utils/store";
import { supportedChains } from "../chains";
import { ArkiveClient } from "../client";
import { EventHandler, EventHandlerHook } from "./event-handler";

// export class Manifest<TStore extends {} = {}, TChains extends string = ""> {
//   manifest: ArkiveManifest<TStore>;

//   constructor() {
//     this.manifest = {
//       dataSources: {},
//     };
//   }

//   chain<TChain extends Exclude<Chains, TChains>>(
//     chain: TChain,
//     builderFn: (builder: DataSourceBuilder<{}, TStore>) => void
//   ): Manifest<TStore, TChains | TChain> {
//     builderFn(new DataSourceBuilder(this, chain));
//     if (this.manifest.dataSources[chain]?.options.rpcUrls.length === 0) {
//       throw new Error(`At least one RPC URL is required for chain ${chain}`);
//     }
//     return this;
//   }
// }

export interface ArkiveManifest<TStore extends {}> {
  dataSources: Record<string, DataSourceManifest<TStore>>;
}

export interface DataSourceManifest<TStore extends {}> {
  contracts: Record<string, Contract<TStore>>;
  options: ChainOptions;
	beforeHandle?: EventHandlerHook<TStore>;
	afterHandle?: EventHandlerHook<TStore>;
}

export interface Contract<TStore extends {}> {
  abi: Abi;
  sources: Record<string, bigint | "live">;
  factorySources: Record<string, Record<string, string>>;
  events: Record<string, EventHandler<Abi, string, TStore>>;
  id: string;
}

export interface ChainOptions {
  blockRange: bigint;
  rpcUrls: string[];
}

export interface BlockHandlerInfo<TStore extends {}> {
  handler: BlockHandler<TStore>;
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
