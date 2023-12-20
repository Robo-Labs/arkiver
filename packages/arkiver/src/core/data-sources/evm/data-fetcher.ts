import { Logger } from "pino";
import { bigintMax, bigintMin } from "../../../utils/bigint";
import { EvmDataProvider } from "./data-provider";
import { ManifestLoader } from "./loader";
import { EventEmitter } from "eventemitter3";
import { Data } from "./data-queue";
import { retry } from "../../../utils/promise";
import { WatchBlockNumberReturnType } from "viem";
import { DbProvider } from "../../db-provider";
import { Mutex } from "async-mutex";

export interface EvmDataFetcherParams {
  loader: ManifestLoader<any>;
  blockRange: bigint;
  dataProvider: EvmDataProvider;
  latestBlock: bigint;
  dbProvider: DbProvider;
  chain: string;
  concurrency?: number;
  waitNewBlockMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  logger?: Logger;
  fetchDelayMs?: number;
}

export class EvmDataFetcher extends EventEmitter {
  #dataProvider: EvmDataProvider;
  #loader: ManifestLoader<any>;
  #latestBlock: bigint;
  #config: {
    maxRetries: number;
    concurrency: number;
    waitNewBlockMs: number;
    retryDelayMs: number;
    blockRange: bigint;
    fetchDelayMs: number;
  };
  #dbProvider: DbProvider;
  #chain: string;
  #highestFetchedBlock = 0n;
  #totalLogsFetched = 0;
  #newBlockLock = new Mutex();
  unwatch?: WatchBlockNumberReturnType;
  #logger?: Logger;

  constructor({
    loader,
    logger,
    blockRange,
    dataProvider,
    latestBlock,
    dbProvider,
    chain,
    concurrency = 5,
    waitNewBlockMs = 1000,
    maxRetries = 5,
    retryDelayMs = 500,
    fetchDelayMs = 500,
  }: EvmDataFetcherParams) {
    super();
    this.#loader = loader;
    this.#logger = logger;
    this.#dataProvider = dataProvider;
    this.#config = {
      maxRetries,
      concurrency,
      waitNewBlockMs,
      retryDelayMs,
      blockRange,
      fetchDelayMs,
    };
    this.#dbProvider = dbProvider;
    this.#chain = chain;
    this.#latestBlock = latestBlock;
  }

  start(startBlock: bigint, historicalOnly?: true) {
    this.#logger?.debug({
      event: "evmDataFetcher.start",
      context: {
        config: this.#config,
        startBlock,
      },
    });

    this.#startBatchProcess(startBlock).then((success) => {
      if (success && !historicalOnly) this.#startLiveBlockProcess();
    });
  }

  async #startBatchProcess(startBlock: bigint) {
    const workers = new Array(this.#config.concurrency).fill(0);
    let contUpdateDbLoop = true;
    const updateDbLoop = async () => {
      if (!contUpdateDbLoop) return;
      await this.#updateDb();
      setTimeout(updateDbLoop, 1000);
    };
    updateDbLoop();
    try {
      await Promise.all(
        workers.map(async (_, offset) => {
          let taskIndex = 0;
          while (true) {
            const nextBlock =
              startBlock +
              BigInt(this.#config.concurrency * taskIndex + offset) *
                this.#config.blockRange;

            if (nextBlock > this.#latestBlock) break;

            const endBlock = bigintMin(
              nextBlock + this.#config.blockRange - 1n,
              this.#latestBlock
            );

            await this.#processBlock(nextBlock, endBlock);

            this.#highestFetchedBlock = bigintMax(
              this.#highestFetchedBlock,
              endBlock
            );

            await new Promise((resolve) =>
              setTimeout(resolve, this.#config.fetchDelayMs)
            );

            taskIndex++;
          }
        })
      );
      return true;
    } catch (error) {
      this.emit("error", error);
      return false;
    } finally {
      contUpdateDbLoop = false;
    }
  }

  async #startLiveBlockProcess() {
    const logger = this.#logger;
    const lock = this.#newBlockLock;
    this.unwatch = this.#dataProvider.onBlock(
      async (newBlock) => {
        await lock.acquire();
        try {
          logger?.info(`New block: ${newBlock}`);
          let startBlock = this.#latestBlock + 1n;
          if (startBlock > newBlock) return;
          while (true) {
            // lowest of either the end of the range or the latest block
            const rangeEnd = startBlock + this.#config.blockRange - 1n;
            const endBlock = bigintMin(rangeEnd, newBlock);
            try {
              await this.#processBlock(startBlock, endBlock);
            } catch (error) {
              this.emit("error", error);
              return;
            }
            // if we've reached the end of the range, break
            if (rangeEnd > newBlock) break;
            startBlock += this.#config.blockRange;
          }
          this.#latestBlock = newBlock;

          if (newBlock > this.#highestFetchedBlock) {
            this.#highestFetchedBlock = newBlock;
            await this.#updateDb();
          }
        } finally {
          lock.release();
        }
      },
      (error) => {
        this.emit("error", error);
      }
    );
  }

  async #processBlock(startBlock: bigint, endBlock: bigint) {
    const res = await retry({
      callback: () =>
        Promise.all([
          this.#dataProvider.fetchSpecificLogs({
            startBlock,
            endBlock,
            contracts: this.#loader.sources.specific,
          }),
          this.#dataProvider.fetchWildcardLogs({
            startBlock,
            endBlock,
            sources: this.#loader.sources.wildcard,
          }),
        ]),
      maxRetries: this.#config.maxRetries,
      retryDelayMs: this.#config.retryDelayMs,
    });

    this.#logger?.debug({
      event: "evmDataFetcher.#processBlock",
      context: {
        startBlock,
        endBlock,
        logs: res[0].length + res[1].length,
      },
    });

    this.emit("data", {
      logs: res[0].concat(res[1]),
      startBlock,
      endBlock,
    } satisfies Data);

    this.#totalLogsFetched += res[0].length + res[1].length;
  }

  async #updateDb() {
    await Promise.all([
      this.#dbProvider.updateChainBlock({
        chain: this.#chain,
        blockHeight: this.#highestFetchedBlock,
        column: "highestFetchedBlock",
      }),
      this.#totalLogsFetched > 0 &&
        this.#dbProvider.incrementMetadataValue({
          chain: this.#chain,
          value: this.#totalLogsFetched,
          column: "totalLogsFetched",
        })
    ]);

    this.#totalLogsFetched = 0;
  }

  stop() {
    this.unwatch?.();
  }
}
