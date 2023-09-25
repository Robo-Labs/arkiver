import { Abi, PublicClient, createPublicClient, http, maxUint256 } from "viem";
import { EvmDataBroker } from "./data-broker";
import { Logger } from "pino";
import { Contract, DataSourceManifest } from "../../../types/manifest";
import { EventHandler } from "../../../types";

export interface EvmDataFetcherParams<TContext extends {}> {
  dataBroker: EvmDataBroker;
  logger: Logger;
  dataSourceManifest: DataSourceManifest<TContext>;
}

export class EvmDataFetcher<TContext extends {}> {
  #dataBroker: EvmDataBroker;
  #rpcUrl: string;
  #blockRange: bigint;
  #client: PublicClient;
  #logger: Logger;
  #contracts: Record<string, Contract>;
  #state: {
    latestBlock: bigint;
  };
  #logSources: {
    agnostic: Map<
      string,
      { abi: Abi; handler: EventHandler<Abi, string, TContext> }
    >;
  };

  constructor({
    dataBroker,
    logger,
    dataSourceManifest: {
      blockHandlers,
      contracts,
      options: { blockRange, rpcUrl },
    },
  }: EvmDataFetcherParams<TContext>) {
    this.#dataBroker = dataBroker;
    this.#blockRange = blockRange;
    this.#rpcUrl = rpcUrl;
    this.#logger = logger;
    this.#contracts = contracts;
    this.#client = createPublicClient({
      transport: http(rpcUrl),
      batch: {
        multicall: true,
      },
    });
    this.#state = {
      latestBlock: 0n,
    };
    this.#logSources = {
      agnostic: new Map(),
    };
  }

  async start() {
    this.#logger.debug({
      event: "evmDataFetcher.start",
      context: { rpcUrl: this.#rpcUrl },
    });

    await this.updateLatestBlock();
  }

  async updateLatestBlock() {
    this.#logger.debug({ event: "evmDataFetcher.updateLatestBlockStart" });

    const latestBlock = await this.#client.getBlockNumber();

    this.#logger.debug({
      event: "evmDataFetcher.updateLatestBlockEnd",
      context: { latestBlock },
    });

    this.#state.latestBlock = latestBlock;
  }

  #loadContracts() {
    let contractsLowestBlock = maxUint256;

    for (const [contractName, contract] of Object.entries(this.#contracts)) {
      if (contract.sources["*"] !== undefined) {
      }
    }
  }
}
