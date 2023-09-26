import { Abi, PublicClient, encodeEventTopics, maxUint256 } from "viem";
import { EvmDataBroker } from "./data-broker";
import { Logger } from "pino";
import {
  BlockHandlerInfo,
  Contract,
  DataSourceManifest,
} from "../../../types/manifest";
import { DbProvider } from "../../db-provider";
import { bigintMax, bigintMin } from "../../../utils/bigint";

export interface EvmDataFetcherParams<TContext extends {}> {
  dataBroker: EvmDataBroker;
  logger: Logger;
  dataSourceManifest: DataSourceManifest<TContext>;
  client: PublicClient;
  chain: string;
  dbProvider: DbProvider;
  concurrency?: number;
  waitNewBlockMs?: number;
  maxRetries?: number;
}

export class EvmDataFetcher<TContext extends {}> {
  #dataBroker: EvmDataBroker;
  #blockRange: bigint;
  #client: PublicClient;
  #logger: Logger;
  #contracts: Record<string, Contract<TContext>>;
  #blockHandlers: BlockHandlerInfo<TContext>[];
  #state: {
    latestBlock: bigint;
  };
  #sources: {
    wildcard: { startBlock: bigint; abi: Abi; topic0: string }[];
    specific: {
      sources: Record<string, bigint>;
      abi: Abi;
      topic0s: string[];
    }[];
    blocks: { startBlock: bigint; interval: bigint }[];
  };
  #chain: string;
  #dbProvider: DbProvider;
  #config: {
    maxRetries: number;
    concurrency: number;
    waitNewBlockMs: number;
  };
  #errorHandler?: (err: unknown) => void;

  constructor({
    dataBroker,
    logger,
    dataSourceManifest: {
      blockHandlers,
      contracts,
      options: { blockRange },
    },
    client,
    chain,
    dbProvider,
    concurrency = 5,
    waitNewBlockMs = 1000,
    maxRetries = 5,
  }: EvmDataFetcherParams<TContext>) {
    this.#dataBroker = dataBroker;
    this.#blockRange = blockRange;
    this.#logger = logger;
    this.#contracts = contracts;
    this.#blockHandlers = blockHandlers;
    this.#client = client;
    this.#chain = chain;
    this.#dbProvider = dbProvider;
    this.#config = {
      maxRetries,
      concurrency,
      waitNewBlockMs,
    };
    this.#state = {
      latestBlock: 0n,
    };
    this.#sources = {
      wildcard: [],
      specific: [],
      blocks: [],
    };
  }

  async start() {
    this.#logger.debug({
      event: "evmDataFetcher.start",
      context: {
        chain: this.#chain,
        blockRange: this.#blockRange,
      },
    });

    await this.updateLatestBlock();

    const contractsLowestBlock = this.loadContracts();
    const blocksLowestBlock = this.loadBlocks();
    const lowestBlock = bigintMin(contractsLowestBlock, blocksLowestBlock);

    const highestProcessedBlock = await this.getHighestProcessedBlock();

    const startBlock = bigintMax(lowestBlock, highestProcessedBlock);

    this.startBatchProcess(startBlock).then((success) => {
      if (success) this.startLiveBlockProcess();
    });
  }

  async startBatchProcess(startBlock: bigint) {
    const workers = [...new Array(this.#config.concurrency)];
    const failedBlocks: {
      block: { start: bigint; end: bigint };
      error: unknown;
      retry: number;
    }[] = [];
    try {
      await Promise.all(
        workers.map(async (_, offset) => {
          let taskIndex = 0;
          while (true) {
            const failedBlock = failedBlocks.pop();

            if (failedBlock) {
              try {
                await this.processBlock(
                  failedBlock.block.start,
                  failedBlock.block.end
                );
              } catch (error) {
                const retry = failedBlock.retry + 1;
                this.#logger.error({
                  source: "evmDataFetcher.processBlock",
                  context: {
                    block: failedBlock.block,
                    error,
                    retry,
                  },
                });
                const newFailedBlock = {
                  block: failedBlock.block,
                  error,
                  retry,
                };
                if (retry > this.#config.maxRetries) {
                  throw newFailedBlock;
                }
                failedBlocks.push(newFailedBlock);
              }
              continue;
            }

            const nextBlock =
              startBlock +
              BigInt(this.#config.concurrency * taskIndex + offset) *
                this.#blockRange;

            if (nextBlock > this.#state.latestBlock) break;

            const endBlock = bigintMin(
              nextBlock + this.#blockRange - 1n,
              this.#state.latestBlock
            );

            try {
              await this.processBlock(nextBlock, endBlock);
            } catch (error) {
              this.#logger.error({
                source: "evmDataFetcher.processBlock",
                context: { block: nextBlock, error, retry: 0 },
              });
              failedBlocks.push({
                block: { start: nextBlock, end: endBlock },
                error,
                retry: 0,
              });
            }

            taskIndex++;
          }
        })
      );
      return true;
    } catch (error) {
      if (this.#errorHandler) {
        this.#errorHandler({
          error,
          source: "evmDataFetcher.startBatchProcess",
        });
      } else {
        this.#logger.error({
          source: "evmDataFetcher.startBatchProcess",
          context: { error, uncaught: true },
        });
      }
      return false;
    }
  }

  async startLiveBlockProcess() {
    while (true) {
      const startBlock = this.#state.latestBlock + 1n;
      await this.updateLatestBlock();

      if (startBlock > this.#state.latestBlock) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.#config.waitNewBlockMs)
        );
        continue;
      }

      const process = async (retries: number) => {
        try {
          await this.processBlock(startBlock, this.#state.latestBlock);
        } catch (error) {
          this.#logger.error({
            source: "evmDataFetcher.processBlock",
            context: { block: startBlock, error, retry: retries },
          });
          if (retries > this.#config.maxRetries) {
            throw error;
          }
          await process(retries + 1);
        }
      };
      try {
        await process(0);
      } catch (error) {
        if (this.#errorHandler) {
          this.#errorHandler({
            error,
            source: "evmDataFetcher.startLiveBlockProcess",
          });
        } else {
          this.#logger.error({
            source: "evmDataFetcher.startLiveBlockProcess",
            context: { error, uncaught: true },
          });
        }
        break;
      }
    }
  }

  async processBlock(startBlock: bigint, endBlock: bigint) {
    // TODO @hazelnutcloud: implement
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

  loadContracts() {
    let contractsLowestBlock = maxUint256;

    for (const contract of Object.values(this.#contracts)) {
      // Get the lowest block from this contract's sources and update the contractsLowestBlock if it's lower
      const lowestBlock: bigint = Object.values(contract.sources).reduce(
        (lowestBlock: bigint, block) => {
          if (block === "live")
            return bigintMin(this.#state.latestBlock, lowestBlock);
          return bigintMin(block, lowestBlock);
        },
        maxUint256
      );

      if (lowestBlock < contractsLowestBlock) {
        contractsLowestBlock = lowestBlock;
      }

      // If the contract has a wildcard source, add it to the logSources and ignore the rest of the sources
      if (contract.sources["*"] !== undefined) {
        for (const eventName in contract.events) {
          const topic0 = encodeEventTopics({
            abi: contract.abi,
            eventName,
          })[0];

          const startBlock =
            contract.sources["*"] === "live"
              ? this.#state.latestBlock
              : contract.sources["*"];

          this.#sources.wildcard.push({
            topic0,
            abi: contract.abi,
            startBlock,
          });
        }
        continue;
      }

      const topic0s = Object.keys(contract.events).map(
        (eventName) =>
          encodeEventTopics({
            abi: contract.abi,
            eventName,
          })[0]
      );

      const sources = Object.entries(contract.sources).reduce(
        (sources, [address, startBlock]) => {
          if (startBlock === "live") {
            sources[address] = this.#state.latestBlock;
          } else {
            sources[address] = startBlock;
          }
          return sources;
        },
        {} as Record<string, bigint>
      );

      this.#sources.specific.push({
        sources,
        abi: contract.abi,
        topic0s,
      });
    }

    return contractsLowestBlock;
  }

  loadBlocks() {
    let blocksLowestBlock = maxUint256;

    for (const blockHandlerInfo of this.#blockHandlers) {
      const startBlock =
        blockHandlerInfo.startBlockHeight === "live"
          ? this.#state.latestBlock
          : blockHandlerInfo.startBlockHeight;

      this.#sources.blocks.push({
        interval: blockHandlerInfo.blockInterval,
        startBlock,
      });

      if (startBlock < blocksLowestBlock) {
        blocksLowestBlock = startBlock;
      }
    }

    return blocksLowestBlock;
  }

  async getHighestProcessedBlock() {
    return await this.#dbProvider.getHighestProcessedBlock(this.#chain);
  }

  onError(callback: (err: unknown) => void): void {
    this.#errorHandler = callback;
  }
}
