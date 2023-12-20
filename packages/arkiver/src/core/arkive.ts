import { Abi, AbiEventParameter, AbiType, ExtractAbiEventNames, ExtractAbiEvents } from "abitype";
import {
  ArkiveManifest,
  DataSourceManifest,
} from "./manifest";
import deepMerge from "ts-deepmerge";
import {
  EventHandler,
  EventHandlerHook,
} from "./event-handler";
import { Arkiver } from "./arkiver";
import { BunSqliteProvider } from "./db-provider";
import { Logger, pino, Level } from "pino";
import { drizzle } from "drizzle-orm/bun-sqlite";
import Database from "bun:sqlite";
import { arkiveMetadata, chainMetadata, childSource } from "./tables";

export type MapAbiEventToArgsWithType<
  TAbi extends Abi,
  TType extends AbiType
> = {
  [TEvent in ExtractAbiEvents<TAbi> as TEvent["name"]]?: TEvent["inputs"][number] extends infer TEventInput extends AbiEventParameter
    ? TEventInput extends { type: TType }
      ? TEventInput["name"]
      : never
    : never;
};

export interface ArkiveSettings {
  logger?: Logger;
  logLevel?: Level;
}

export interface ContractParams<
  TAbi extends Abi,
  TChains extends string,
  TContracts extends Record<string, { abi: Abi; chains: string }>,
  TStore extends {},
  TSources extends Partial<Record<TChains, ContractSourceParams[]>>
> {
  abi: TAbi;
  events: {
    [EventName in ExtractAbiEventNames<TAbi>]?: EventParams<
      TAbi,
      EventName,
      Extract<keyof TSources, string>,
      TStore
    >;
  };
  sources?: TSources;
  factorySources?: {
    [Contract in keyof TContracts]?: {
      chains: TContracts[Contract]["chains"][] | "all";
      events: MapAbiEventToArgsWithType<TContracts[Contract]["abi"], "address">;
    };
  };
}

export interface ContractSourceParams {
  startBlock: bigint;
  address: string;
}

export type EventParams<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TChains extends string,
  TStore extends {} = {}
> = {
  handler: EventHandler<TAbi, TEventName, TChains, TStore>;
};

export interface ChainParams<TStore, TChain extends string> {
  rpcUrls: string[];
  blockRange: bigint;
  beforeHandle?: EventHandlerHook<TStore, TChain>;
  afterHandle?: EventHandlerHook<TStore, TChain>;
}
export class Arkive<
  TStore extends Record<string, unknown> = {},
  TChains extends string = never,
  TContracts extends Record<string, { abi: Abi; chains: TChains }> = {}
> {
  #manifest: ArkiveManifest<TStore>;
  #store: TStore;

  constructor(settings?: ArkiveSettings) {
    this.#manifest = { dataSources: {} };
    this.#store = {} as TStore;
  }

  store<TData extends Record<string, any>>(
    data: TData
  ): Arkive<TStore & TData, TChains, TContracts> {
    this.#store = deepMerge(this.#store, data) as any;
    return this as any;
  }

  chain<TChain extends string>(
    chain: TChain,
    {
      blockRange,
      rpcUrls,
      afterHandle,
      beforeHandle,
    }: ChainParams<TStore, TChain>
  ): Arkive<TStore, TChains | TChain, TContracts> {
    this.#manifest.dataSources[chain] = deepMerge(
      this.#manifest.dataSources[chain] ?? {},
      {
        options: {
          blockRange,
          rpcUrls,
        },
        afterHandle,
        beforeHandle,
        contracts: {},
      } as DataSourceManifest<TStore>
    ) as any;

    return this as any;
  }

  contract<
    TAbi extends Abi,
    TName extends string,
    TSources extends Partial<Record<TChains, ContractSourceParams[]>>
  >(
    name: TName,
    {
      events,
      abi,
      sources,
      factorySources,
    }: ContractParams<TAbi, TChains, TContracts, TStore, TSources>
  ): Arkive<
    TStore,
    TChains,
    TContracts & {
      [key in TName]: {
        abi: TAbi;
        chains: keyof TSources;
      };
    }
  > {
    sources ??= {} as TSources;
    factorySources ??= {};

    const eventsFormatted = Object.fromEntries(
      Object.entries(events).map(([eventName, param]) => [
        eventName,
        (param as any).handler,
      ])
    );

    for (const chain in sources) {
      const source = sources[chain];

      this.#manifest.dataSources[chain].contracts[name] = {
        abi,
        sources: Object.fromEntries(
          source?.map(({ address, startBlock }) => [address, startBlock]) ?? []
        ),
        events: eventsFormatted,
        factorySources: {},
        id: name,
      };
    }

    for (const contract in factorySources) {
      const { chains, events } = factorySources[contract]!;
      let chainsArr =
        chains === "all" ? Object.keys(this.#manifest.dataSources) : chains;
      for (const chain of chainsArr) {
        if (!this.#manifest.dataSources[chain].contracts[contract]) continue; // check if parent contract exists in this chain

        if (!this.#manifest.dataSources[chain].contracts[name]) {
          this.#manifest.dataSources[chain].contracts[name] = {
            abi,
            sources: {},
            events: eventsFormatted,
            factorySources: {},
            id: name,
          };
        }

        this.#manifest.dataSources[chain].contracts[name].factorySources[
          contract
        ] = events as Record<string, string>;
      }
    }

    return this;
  }

  beforeHandle<TChain extends "all" | TChains[]>({
    chains,
    hook,
  }: {
    chains: TChain;
    hook: EventHandlerHook<
      TStore,
      TChain extends "all" ? TChains : TChain[number]
    >;
  }) {
    const chainsArr =
      chains === "all"
        ? Object.keys(this.#manifest.dataSources)
        : (chains as TChains[]);

    for (const chain of chainsArr) {
      this.#manifest.dataSources[chain].beforeHandle = hook as any;
    }

    return this;
  }

  afterHandle<TChain extends "all" | TChains[]>({
    chains,
    hook,
  }: {
    chains: TChain;
    hook: EventHandlerHook<
      TStore,
      TChain extends "all" ? TChains : TChain[number]
    >;
  }) {
    const chainsArr =
      chains === "all"
        ? Object.keys(this.#manifest.dataSources)
        : (chains as TChains[]);

    for (const chain of chainsArr) {
      this.#manifest.dataSources[chain].afterHandle = hook as any;
    }
    return this;
  }

  start(settings?: ArkiveSettings) {
    const logger =
      settings?.logger ??
      pino({
        transport: { target: "pino-pretty" },
        level: settings?.logLevel ?? "info",
      });

    const isProduction = process.env.NODE_ENV === "production";

    const sqlitePath = (() => {
      if (isProduction) {
        const sqliteUrl = process.env["SQLITE_URL"];
        if (!sqliteUrl) throw new Error("SQLITE_URL not set.");
        return new URL(sqliteUrl).pathname;
      } else {
        return "arkiver.sqlite";
      }
    })();

    const sqlite = drizzle(new Database(sqlitePath), {
      schema: { arkiveMetadata, chainMetadata, childSource },
    });

    const dbProvider = new BunSqliteProvider({
      logger,
      db: sqlite,
    });

    const arkiver = new Arkiver({
      context: this.#store,
      manifest: this.#manifest,
      dbProvider,
      logger,
    });

		return arkiver.start()
  }
}
