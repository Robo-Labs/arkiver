import { Logger } from "pino";
import { BoundedData, EvmDataQueue } from "./data-queue";
import { EvmDataFetcher } from "./data-fetcher";
import { EvmHandlerRunner } from "./handler-runner";
import { DbProvider } from "../../db-provider";
import { ViemDataProvider } from "./data-provider";
import { ManifestLoader } from "./loader";
import { bigintMax, bigintMin } from "../../../utils/bigint";
import EventEmitter from "eventemitter3";
import { createArkiveClient } from "../../client";
import { DataSourceManifest } from "../../manifest";
import { ArkiveRecord } from "../../record";
import { Mutex } from "async-mutex";

export interface EvmDataSourceParams<TStore extends {}> {
  chain: string;
  record?: ArkiveRecord;
  dataSourceManifest: DataSourceManifest<TStore>;
  dbProvider: DbProvider;
  context: TStore;
  logger?: Logger;
}

export class EvmDataSource<TStore extends {}> extends EventEmitter {
  #chain: string;
  #dataSourceManifest: DataSourceManifest<TStore>;
  #dbProvider: DbProvider;
  #context: TStore;
  #dataFetcher?: EvmDataFetcher;
  #logger?: Logger;

  constructor({
    chain,
    dataSourceManifest,
    logger,
    dbProvider,
    context,
  }: EvmDataSourceParams<TStore>) {
    super();
    this.#chain = chain;
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
    const highestProcessedBlock =
      await this.#dbProvider.getHighestProcessedBlock(this.#chain);
    const startBlock = bigintMax(contractsLowestBlock, highestProcessedBlock);

    //instantiate queue, data fetcher, handler runner
    const queue = new EvmDataQueue({ logger: this.#logger, startBlock });
    const dataFetcher = new EvmDataFetcher({
      blockRange: this.#dataSourceManifest.options.blockRange,
      logger: this.#logger,
      dataProvider,
      latestBlock,
      loader,
      chain: this.#chain,
      dbProvider: this.#dbProvider,
    });
    const handlerRunner = new EvmHandlerRunner({
      dataSourceManifest: this.#dataSourceManifest,
      client,
      context: this.#context,
      loader,
      logger: this.#logger,
      chain: this.#chain,
      dbProvider: this.#dbProvider,
			hooks: {
				afterHandle: this.#dataSourceManifest.afterHandle,
				beforeHandle: this.#dataSourceManifest.beforeHandle,
			}
    });

    // TODO: listen for errors on dataFetcher and handle them

    // connect components
    const handlerLock = new Mutex();
    dataFetcher.on("data", (data) => queue.push(data));
    // handle sequential processing of data here so we can add an option later to process in parallel
    queue.on("data", (data: BoundedData) =>
      handlerLock.runExclusive(
        async () => await handlerRunner.processData(data)
      )
    );
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
