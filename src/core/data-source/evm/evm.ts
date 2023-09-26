import { Logger } from "pino";
import { ArkiveRecord } from "../../../types";
import {
  BlockHandlerInfo,
  Contract,
  DataSourceManifest,
} from "../../../types/manifest";
import { DataSource } from "../data-source";
import { EvmDataBroker } from "./data-broker";
import { EvmDataFetcher } from "./data-fetcher";
import { EvmHandlerRunner } from "./handler-runner";
import { createPublicClient, fallback, http } from "viem";
import { DbProvider } from "../../db-provider";
import { ViemDataProvider } from "./data-provider";

export interface EvmDataSourceParams<TContext extends {}> {
  chain: string;
  record: ArkiveRecord;
  dataSourceManifest: DataSourceManifest<TContext>;
  logger: Logger;
  dbProvider: DbProvider;
}

export class EvmDataSource<TContext extends {}> implements DataSource {
  #chain: string;
  #record: ArkiveRecord;
  #dataSourceManifest: DataSourceManifest<TContext>;
  #dataBroker: EvmDataBroker;
  #dataFetcher: EvmDataFetcher<TContext>;
  #handlerRunner: EvmHandlerRunner;
  #logger: Logger;
  #onSynced?: () => void;

  constructor({
    chain,
    record,
    dataSourceManifest,
    logger,
    dbProvider,
  }: EvmDataSourceParams<TContext>) {
    this.#chain = chain;
    this.#record = record;
    this.#dataSourceManifest = dataSourceManifest;
    this.#logger = logger;

    this.#dataBroker = new EvmDataBroker();

    const client = createPublicClient({
      transport: fallback(
        this.#dataSourceManifest.options.rpcUrls.map((rpcUrl) => http(rpcUrl))
      ),
      batch: {
        multicall: true,
      },
    });
    const dataProvider = new ViemDataProvider({ client });
    this.#dataFetcher = new EvmDataFetcher({
      dataBroker: this.#dataBroker,
      dataSourceManifest,
      logger,
      dataProvider,
      chain,
      dbProvider: dbProvider,
    });

    this.#handlerRunner = new EvmHandlerRunner({
      dataBroker: this.#dataBroker,
    });
  }

  async start() {
    this.#logger.info({
      event: "evmDataSource.start",
      context: { chain: this.#chain },
    });

    await this.#handlerRunner.start();
    await this.#dataFetcher.start();
  }

  onError(callback: (err: unknown) => void): void {
    // propage error handler downwards instead of propagating error upwards
    this.#dataFetcher.onError(callback);
  }

  onSynced(callback: () => void): void {
    this.#onSynced = callback;
  }
}
