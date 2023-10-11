import { Logger } from "pino";
import { bigintMin } from "../../../utils/bigint";
import { EvmDataProvider } from "./data-provider";
import { ManifestLoader } from "./loader";
import { EventEmitter } from "eventemitter3";
import { Data } from "./data-queue";
import { retry } from "../../../utils/promise";
import { WatchBlockNumberReturnType } from "viem";

export interface EvmDataFetcherParams {
  loader: ManifestLoader<any>;
  blockRange: bigint;
  dataProvider: EvmDataProvider;
  latestBlock: bigint;
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
  unwatch?: WatchBlockNumberReturnType;
  #logger?: Logger;

  constructor({
    loader,
    logger,
    blockRange,
    dataProvider,
    latestBlock,
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
    this.#latestBlock = latestBlock;
  }

  start(startBlock: bigint) {
    this.#logger?.debug({
      event: "evmDataFetcher.start",
      context: {
        config: this.#config,
        startBlock,
      },
    });

    this.#startBatchProcess(startBlock).then((success) => {
      if (success) this.#startLiveBlockProcess();
    });
  }

  async #startBatchProcess(startBlock: bigint) {
    const workers = [...new Array(this.#config.concurrency)];
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
    }
  }

  async #startLiveBlockProcess() {
    this.unwatch = this.#dataProvider.onBlock(
      async (blockNumber) => {
        let startBlock = this.#latestBlock + 1n;
        if (startBlock > blockNumber) return;
        while (true) {
          const endBlock = bigintMin(
            startBlock + this.#config.blockRange - 1n,
            blockNumber
          );
          try {
            await this.#processBlock(startBlock, endBlock);
          } catch (error) {
            this.emit("error", error);
            return;
          }
          if (startBlock + this.#config.blockRange - 1n > endBlock) break;
          startBlock += this.#config.blockRange;
        }
        this.#latestBlock = blockNumber;
      },
      (error) => {
        this.emit("error", error);
      }
    );
  }

  async #processBlock(startBlock: bigint, endBlock: bigint) {
    try {
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
            this.#dataProvider.fetchBlocks({
              startBlock,
              endBlock,
              sources: this.#loader.sources.blocks,
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
          blocks: res[2].length,
        },
      });

      this.emit("data", {
        logs: res[0].concat(res[1]),
        blocks: res[2],
        startBlock,
        endBlock,
      } satisfies Data);
    } catch (error) {
      throw error;
    }
  }

  stop() {
    this.unwatch?.();
  }
}
