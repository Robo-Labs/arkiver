import { Abi, AbiEvent, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import {
  ArkiveManifest,
  DataSourceManifest,
} from "./manifest-builder/manifest";
import deepMerge from "ts-deepmerge";
import {
  EventHandler,
  EventHandlerHook,
} from "./manifest-builder/event-handler";
import { MapAbiEventToArgsWithType } from "./manifest-builder/data-source";

export interface ArkiveSettings {}

export interface ContractParams<
  TAbi extends Abi,
  TChains extends string,
  TContracts extends Record<string, { abi: Abi; chains: string }>,
  TStore extends {}
> {
  abi: TAbi;
  events: {
    [EventName in ExtractAbiEventNames<TAbi>]?: EventParams<
      TAbi,
      EventName,
      TStore
    >;
  };
  sources?: {
    [key in TChains]?: ContractSourceParams;
  };
  factorySources?: {
    [Contract in keyof TContracts]?: {
      chains: TContracts[Contract]["chains"][];
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
  TStore extends {} = {}
> = {
  handler: EventHandler<TAbi, TEventName, TStore>;
};

export interface ChainParams<TStore> {
  rpcUrls: [string, ...string[]];
  blockRange: bigint;
  beforeHandle?: EventHandlerHook<TStore>;
  afterHandle?: EventHandlerHook<TStore>;
}

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export class Arkive<
  TStore extends Record<string, unknown> = {},
  TChains extends string = "",
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
    { blockRange, rpcUrls, afterHandle, beforeHandle }: ChainParams<TStore>
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
        blockHandlers: [],
      } as DataSourceManifest<TStore>
    ) as any;

    return this;
  }

  contract<TAbi extends Abi, TName extends string>(
    name: TName,
    {
      events,
      abi,
      sources = {},
      factorySources = {},
    }: ContractParams<TAbi, TChains, TContracts, TStore>
  ): Arkive<
    TStore,
    TChains,
    TContracts & {
      [key in TName]: {
        abi: TAbi;
        chains: keyof typeof sources;
      };
    }
  > {
    return this;
  }

  start(settings?: ArkiveSettings) {}
}

const abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    type: "event",
    name: "MyEvent",
    inputs: [],
  },
] as const satisfies Abi;

const arkive = new Arkive()
  .store({
    foo: "bar" as "bar",
  })
  .chain("ethereum", {
    blockRange: 10n,
    rpcUrls: [""],
    beforeHandle: ({ store: { foo } }) => {
			console.log(foo)
		},
		afterHandle: ({ store: { foo } }) => {
			console.log(foo)
		}
  })
  .contract("erc20", {
    abi,
    events: {
      Transfer: {
        handler: async ({ store: { foo } }) => {
					console.log(foo)
				},
      },
    },
    sources: {
      ethereum: {
        startBlock: 100n,
        address: "0x12345",
      },
    },
  })
  .contract("erc721", {
    abi,
    events: {
			MyEvent: {
				handler: async ({ store: { foo } }) => {
					console.log(foo)
				}
			}
		},
    factorySources: {
      erc20: {
        chains: ["ethereum"],
        events: {
          Transfer: "from",
        },
      },
    },
  });
