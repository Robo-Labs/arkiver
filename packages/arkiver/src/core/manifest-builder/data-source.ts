import {
  Abi,
  AbiEventParameter,
  AbiType,
  ExtractAbiEventNames,
  ExtractAbiEvents,
} from "abitype";
import {
  BlockHandler,
  BlockHandlerInfo,
  ChainOptions,
  Chains,
  Contract,
  DataSourceManifest,
  Manifest,
} from "./manifest";
import { getChainObjFromChainName } from "../chains";
import { EventHandler } from "./event-handler";

export class DataSourceBuilder<
  TContracts extends Record<string, Abi>,
  TContext extends {}
> {
  dataSource: DataSourceManifest<TContext>;
  builder: Manifest<TContext, Chains>;
  chain: Chains;

  constructor(manifest: Manifest<TContext, Chains>, chain: Chains) {
    this.builder = manifest;
    this.chain = chain;

    const dataSource: DataSourceManifest<TContext> = this.builder.manifest
      .dataSources[chain] ?? {
      options: {
        blockRange: 1000n,
        rpcUrls:
          (getChainObjFromChainName(chain)?.rpcUrls.public.http as
            | string[]
            | undefined) ?? [],
      },
      blockHandlers: [],
      contracts: {},
    };
    this.builder.manifest.dataSources[chain] = this.dataSource = dataSource;
  }

  setOptions(options: Partial<ChainOptions>) {
    this.dataSource.options = {
      ...this.dataSource.options,
      ...options,
    };
    return this;
  }

  contract<TContractName extends string, TAbi extends Abi>({
    abi,
    name,
    eventHandlers = {},
    factorySources = {},
    sources = {},
  }: AddContractParams<
    TAbi,
    TContractName,
    TContracts,
    TContext
  >): DataSourceBuilder<
    TContracts & { [key in TContractName]: TAbi },
    TContext
  > {
    if (this.dataSource.contracts[name]) {
      throw new Error(`Contract with name '${name}' already defined.`);
    }

    this.dataSource.contracts[name] = {
      abi,
      events: eventHandlers as any,
      factorySources: factorySources as any,
      id: name,
      sources,
    };

    return this as any;
  }

  blockHandler({
    blockInterval,
    handler,
    startBlockHeight,
  }: AddBlockHandlerParams<TContext>) {
    this.dataSource.blockHandlers.push({
      handler,
      startBlockHeight,
      blockInterval,
      name: handler.name,
    });

    return this;
  }
}

export interface AddBlockHandlerParams<TContext extends {}> {
  startBlockHeight: BlockHandlerInfo<TContext>["startBlockHeight"];
  blockInterval: bigint;
  handler: BlockHandler<TContext>;
}

export interface AddContractParams<
  TAbi extends Abi,
  TContractName extends string,
  TContracts extends Record<string, Abi>,
  TContext extends {}
> {
  abi: TAbi;
  name: TContractName extends keyof TContracts
    ? `Contract with name '${TContractName}' already defined.`
    : TContractName;
  sources?: Contract<TContext>["sources"];
  factorySources?: {
    [KeyContractName in keyof TContracts]?: MapAbiEventToArgsWithType<
      TContracts[KeyContractName],
      "address"
    >;
  };
  eventHandlers?: Partial<{
    [eventName in ExtractAbiEventNames<TAbi>]: EventHandler<
      TAbi,
      eventName,
      boolean,
      TContext
    >;
  }>;
}

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
