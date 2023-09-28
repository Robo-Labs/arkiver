import { Logger } from "pino";
import { ArkiveRecord } from "../../../types";
import { DataSourceManifest } from "../../../types/manifest";
import { EvmDataQueue } from "./data-queue";
import { EvmDataFetcher } from "./data-fetcher";
import { EvmHandlerRunner } from "./handler-runner";
import { DbProvider } from "../../db-provider";
import { ViemDataProvider } from "./data-provider";
import { ManifestLoader } from "./loader";
import { bigintMax, bigintMin } from "../../../utils/bigint";
import EventEmitter from "eventemitter3";
import { createArkiveClient } from "../../../utils/client";

export interface EvmDataSourceParams<TContext extends {}> {
  chain: string;
  record: ArkiveRecord;
  dataSourceManifest: DataSourceManifest<TContext>;
  dbProvider: DbProvider;
  context: TContext;
  logger?: Logger;
}

export class EvmDataSource<TContext extends {}> extends EventEmitter {
  #chain: string;
  #record: ArkiveRecord;
  #dataSourceManifest: DataSourceManifest<TContext>;
  #dbProvider: DbProvider;
  #context: TContext;
  #dataFetcher?: EvmDataFetcher;
  #logger?: Logger;

  constructor({
    chain,
    record,
    dataSourceManifest,
    logger,
    dbProvider,
    context,
  }: EvmDataSourceParams<TContext>) {
    super();
    this.#chain = chain;
    this.#record = record;
    this.#dataSourceManifest = dataSourceManifest;
    this.#logger = logger;
    this.#dbProvider = dbProvider;
    this.#context = context;
  }

  async start() {
    this.#logger?.info({
      event: "evmDataSource.start",
      context: { chain: this.#chain },
    });

    // create viem data provider
    const client = createArkiveClient({
      rpcUrls: this.#dataSourceManifest.options.rpcUrls,
    });
    const dataProvider = new ViemDataProvider({ client, logger: this.#logger });

    // fetch latest block
    const latestBlock = await dataProvider.fetchLatestBlock();

    // load manifest
    const loader = new ManifestLoader({
      dataSourceManifest: this.#dataSourceManifest,
      latestBlock,
      logger: this.#logger,
    });

    // determine startblock
    const contractsLowestBlock = loader.contractsLowestBlock;
    const blocksLowestBlock = loader.blocksLowestBlock;
    const lowestBlock = bigintMin(contractsLowestBlock, blocksLowestBlock);
    const highestProcessedBlock =
      await this.#dbProvider.getHighestProcessedBlock(this.#chain);
    const startBlock = bigintMax(lowestBlock, highestProcessedBlock);

    //instantiate queue, data fetcher, handler runner
    const queue = new EvmDataQueue({ logger: this.#logger, startBlock });
    const dataFetcher = new EvmDataFetcher({
      blockRange: this.#dataSourceManifest.options.blockRange,
      logger: this.#logger,
      dataProvider,
      latestBlock,
      loader,
    });
    const handlerRunner = new EvmHandlerRunner({
      dataSourceManifest: this.#dataSourceManifest,
      client,
      context: this.#context,
      loader,
      logger: this.#logger,
    });

    // connect components
    dataFetcher.on("data", (data) => queue.push(data));
    queue.on("data", (data) => handlerRunner.processData(data));
    handlerRunner.on("error", (error) => {
      this.#logger?.error({
        source: "evmDataSource.handlerRunner",
        error,
      });
      dataFetcher.stop();
    });

    this.#dataFetcher = dataFetcher;

    // start data fetcher
    dataFetcher.start(startBlock);
  }

  stop() {
    this.#dataFetcher?.stop();
  }
}
