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

export interface EvmDataSourceParams<TContext extends {}> {
  chain: string;
  record: ArkiveRecord;
  dataSourceManifest: DataSourceManifest<TContext>;
  logger: Logger;
}

export class EvmDataSource<TContext extends {}> implements DataSource {
  #chain: string;
  #record: ArkiveRecord;
  #dataSourceManifest: DataSourceManifest<TContext>;
  #dataBroker: EvmDataBroker;
  #dataFetcher: EvmDataFetcher<TContext>;
  #handlerRunner: EvmHandlerRunner;
  #logger: Logger;
  #onError?: (err: unknown) => void;
  #onSynced?: () => void;

  constructor({
    chain,
    record,
    dataSourceManifest,
    logger,
  }: EvmDataSourceParams<TContext>) {
    this.#chain = chain;
    this.#record = record;
    this.#dataSourceManifest = dataSourceManifest;
    this.#logger = logger;

    this.#dataBroker = new EvmDataBroker();
    this.#dataFetcher = new EvmDataFetcher({
      dataBroker: this.#dataBroker,
      dataSourceManifest,
      logger,
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
    this.#onError = callback;
  }

  onSynced(callback: () => void): void {
    this.#onSynced = callback;
  }
}
