import { Abi, PublicClient, getContract } from "viem";
import { Data } from "./data-queue";
import { Mutex } from "async-mutex";
import { ManifestLoader } from "./loader";
import { Logger } from "pino";
import { ArkiveClient } from "../../client";
import { Store } from "../../../utils/store";
import { retry } from "../../../utils/promise";
import EventEmitter from "eventemitter3";
import { DataSourceManifest, EventHandler } from "../../manifest-builder/manifest";

export interface EvmHandlerRunnerParams<TContext extends {}> {
  dataSourceManifest: DataSourceManifest<TContext>;
  client: ArkiveClient;
  context: TContext;
  loader: ManifestLoader<TContext>;
  logger?: Logger;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class EvmHandlerRunner<TContext extends {}> extends EventEmitter {
  #client: ArkiveClient;
  #processLock: Mutex;
  #context: TContext;
  #loader: ManifestLoader<TContext>;
  #logger?: Logger;
  #config: {
    maxRetries: number;
    retryDelayMs: number;
  };
  #store: Store;

  constructor({
    dataSourceManifest: { contracts, blockHandlers },
    client,
    context,
    loader,
    logger,
    maxRetries = 5,
    retryDelayMs = 500,
  }: EvmHandlerRunnerParams<TContext>) {
    super();
    this.#client = client;
    this.#processLock = new Mutex();
    this.#context = context;
    this.#loader = loader;
    this.#logger = logger;
    this.#store = new Store({ max: 1000 });
    this.#config = {
      maxRetries,
      retryDelayMs,
    };
  }

  async processData({ blocks, logs }: Data) {
    await this.#processLock.runExclusive(async () => {
      this.#logger?.debug({
        event: "evmHandlerRunner.processData",
        context: { blocks: blocks.length, logs: logs.length },
      });
      const merged: (
        | { number: bigint; blockNumber?: never }
        | { number?: never; blockNumber: bigint }
      )[] = [...blocks, ...logs];
      const sorted = merged.sort((a, b) => {
        const aBlock = a.blockNumber !== undefined ? a.blockNumber : a.number;
        const bBlock = b.blockNumber !== undefined ? b.blockNumber : b.number;

        return Number(aBlock - bBlock);
      });

      for (const item of sorted) {
        if (item.blockNumber !== undefined) {
          // log
          await this.#processLog(item as Data["logs"][number]);
        } else {
          // block
          await this.#processBlock(item as Data["blocks"][number]);
        }
      }
    });
  }

  async #processLog(log: Data["logs"][number]) {
    const topic0 = log.topics[0];
    const address = log.address;

    let handler: EventHandler<Abi, string, TContext>;
    let abi: Abi;
    let contractId: string;

    const specific = this.#loader.addressTopicHandlerMap.get(
      `${address}-${topic0}`.toLocaleLowerCase()
    );
    if (specific !== undefined) {
      handler = specific.handler;
      abi = specific.abi;
      contractId = specific.contractId;
    } else {
      if (!topic0) {
        this.#logger?.warn({
          source: "evmHandlerRunner.#processLog",
          context: { log },
          warning: "topic0-not-found",
        });
        return;
      }

      const wildcard = this.#loader.addressTopicHandlerMap.get(
        topic0.toLowerCase()
      );
      if (wildcard === undefined) {
        this.#logger?.warn({
          source: "evmHandlerRunner.#processLog",
          context: { log },
          warning: "unexpected-topic0",
        });
        return;
      }

      handler = wildcard.handler;
      abi = wildcard.abi;
      contractId = wildcard.contractId;
    }

    const contract = getContract({
      abi,
      address,
      publicClient: this.#client,
    });
    try {
      await retry({
        callback: async () =>
          handler({
            ...this.#context,
            client: this.#client,
            contract,
            event: log,
            logger: this.#logger!.child({
              event: log.eventName,
              contract: contractId,
            }),
            store: this.#store,
          }),
        maxRetries: this.#config.maxRetries,
        retryDelayMs: this.#config.retryDelayMs,
      });
    } catch (error) {
      this.emit("error", error);
    }
  }

  async #processBlock(block: Data["blocks"][number]) {
    const blockSources = this.#loader.sources.blocks.filter(
      (blockSource) =>
        (block.number - blockSource.startBlock) % blockSource.interval === 0n
    );

    if (blockSources.length === 0) {
      this.#logger?.warn({
        source: "evmHandlerRunner.#processBlock",
        context: { block },
        warning: "no-block-sources",
      });
      return;
    }

    try {
      await retry({
        callback: async () =>
          await Promise.all(
            blockSources.map((blockSource) =>
              blockSource.handler({
                ...this.#context,
                block,
                client: this.#client,
                logger: this.#logger!.child({
                  blockHandler: blockSource.handler.name,
                }),
                store: this.#store,
              })
            )
          ),
        maxRetries: this.#config.maxRetries,
        retryDelayMs: this.#config.retryDelayMs,
      });
    } catch (error) {
      this.emit("error", error);
    }
  }
}
