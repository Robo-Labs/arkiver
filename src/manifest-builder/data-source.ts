import { Abi, ExtractAbiEventNames } from "abitype";
import {
  BlockHandler,
  ChainOptions,
  Chains,
  Contract,
  DataSource,
  EventHandler,
} from "../types";
import { Manifest } from "./manifest";
import { getChainObjFromChainName } from "../utils/chains";
import { MapAbiEventToArgsWithType } from "../types/abi";

export class DataSourceBuilder<TContracts extends Record<string, Abi>> {
  dataSource: DataSource;
  builder: Manifest<Chains>;
  chain: Chains;

  constructor(
    manifest: Manifest<Chains>,
    chain: Chains,
    options: Partial<ChainOptions> = {}
  ) {
    this.builder = manifest;
    this.chain = chain;

    const dataSource: DataSource = this.builder.manifest.dataSources[chain] ?? {
      options: {
        blockRange: options.blockRange ?? 1000n,
        rpcUrl:
          options.rpcUrl ??
          getChainObjFromChainName(chain)?.rpcUrls.public.http[0] ??
          "",
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
  }: AddContractParams<TAbi, TContractName, TContracts>): DataSourceBuilder<
    TContracts & { [key in TContractName]: TAbi }
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
  }: AddBlockHandlerParams) {
    this.dataSource.blockHandlers.push({
      handler,
      startBlockHeight,
      blockInterval,
      name: handler.name,
    });

    return this;
  }
}

export interface AddBlockHandlerParams {
  startBlockHeight: bigint | "live";
  blockInterval: bigint;
  handler: BlockHandler;
}

export type AddContractParams<
  TAbi extends Abi,
  TContractName extends string,
  TContracts extends Record<string, Abi>
> = {
  abi: TAbi;
  name: TContractName extends keyof TContracts
    ? `Contract with name '${TContractName}' already defined.`
    : TContractName;
  sources?: Record<string, bigint>;
  factorySources?: {
    [KeyContractName in keyof TContracts]?: MapAbiEventToArgsWithType<
      TContracts[KeyContractName],
      "address"
    >;
  };
  eventHandlers?: Partial<{
    [eventName in ExtractAbiEventNames<TAbi>]: EventHandler<TAbi, eventName>;
  }>;
};
