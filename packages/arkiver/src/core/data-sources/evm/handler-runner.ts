import { Abi, getContract } from "viem";
import { BoundedData, Data } from "./data-queue";
import { AddressTopicInfo, ManifestLoader } from "./loader";
import { Logger } from "pino";
import { ArkiveClient } from "../../client";
import { Store } from "../../../utils/store";
import { retry } from "../../../utils/promise";
import EventEmitter from "eventemitter3";
import { DataSourceManifest } from "../../manifest-builder/manifest";
import { DbProvider } from "../../db-provider";
import { EventHandler } from "../../manifest-builder/event-handler";

export interface EvmHandlerRunnerParams<TContext extends {}> {
  dataSourceManifest: DataSourceManifest<TContext>;
  client: ArkiveClient;
  context: TContext;
  loader: ManifestLoader<TContext>;
  dbProvider: DbProvider;
  chain: string;
  logger?: Logger;
  maxRetries?: number;
  retryDelayMs?: number;
}

type DiscreteLog<TContext extends {}> = {
  log: Data["logs"][number];
  logs?: never;
} & AddressTopicInfo<TContext>;

type GroupedLogs<TContext extends {}> = AddressTopicInfo<TContext> & {
  logs: Data["logs"];
  log?: never;
};

export class EvmHandlerRunner<TContext extends {}> extends EventEmitter {
  #client: ArkiveClient;
  #context: TContext;
  #loader: ManifestLoader<TContext>;
  #dbProvider: DbProvider;
  #chain: string;
  #highestProcessedBlock = 0n;
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
    dbProvider,
    chain,
    maxRetries = 5,
    retryDelayMs = 500,
  }: EvmHandlerRunnerParams<TContext>) {
    super();
    this.#client = client;
    this.#context = context;
    this.#loader = loader;
    this.#logger = logger;
    this.#dbProvider = dbProvider;
    this.#chain = chain;
    this.#store = new Store({ max: 1000 });
    this.#config = {
      maxRetries,
      retryDelayMs,
    };
  }

  async processData({ data: { blocks, logs }, endBlock }: BoundedData) {
    this.#logger?.debug({
      event: "evmHandlerRunner.processData",
      context: { blocks: blocks.length, logs: logs.length },
    });

    const batchLogs: Record<string, GroupedLogs<TContext>> = {};
    const discreteLogs: DiscreteLog<TContext>[] = [];

    for (const log of logs) {
      const topic0 = log.topics[0];
      const address = log.address;

      let handler: EventHandler<Abi, string, boolean, TContext>;
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
          continue;
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
          continue;
        }

        handler = wildcard.handler;
        abi = wildcard.abi;
        contractId = wildcard.contractId;
      }

      const isBatchProcess = handler._batchProcess;

      if (isBatchProcess) {
        const id = `${contractId}-${topic0}`;

        const existingGroup = batchLogs[id];

        if (existingGroup) {
          existingGroup.logs.push(log);
          continue;
        }

        batchLogs[id] = {
          abi,
          contractId,
          handler,
          logs: [log],
        };
      } else {
        discreteLogs.push({ log, abi, contractId, handler });
      }
    }

    await Promise.all([
      this.#processDiscrete(discreteLogs, blocks),
      this.#processBatch(batchLogs),
    ]);

    await Promise.all([
      (async () => {
        if (endBlock > this.#highestProcessedBlock) {
          this.#highestProcessedBlock = endBlock;
          await this.#dbProvider.updateChainBlock({
            chain: this.#chain,
            blockHeight: endBlock,
            column: "highestProcessedBlock",
          });
        }
      })(),
      logs.length > 0 &&
        this.#dbProvider.incrementMetadataValue({
          chain: this.#chain,
          value: logs.length,
          column: "totalLogsProcessed",
        }),
      blocks.length > 0 &&
        this.#dbProvider.incrementMetadataValue({
          chain: this.#chain,
          value: blocks.length,
          column: "totalBlocksProcessed",
        }),
    ]);
  }

  async #processBatch(groupedLogs: Record<string, GroupedLogs<TContext>>) {
    await Promise.all(
      Object.values(groupedLogs).map(this.#processLog.bind(this))
    );
  }

  async #processDiscrete(
    logs: DiscreteLog<TContext>[],
    blocks: Data["blocks"]
  ) {
    const merged: (
      | { number: bigint; log?: never }
      | { number?: never; log: { blockNumber: bigint } }
    )[] = [...blocks, ...logs];

    const sorted = merged.sort((a, b) => {
      const aBlock =
        a.log?.blockNumber !== undefined ? a.log.blockNumber : a.number;
      const bBlock =
        b.log?.blockNumber !== undefined ? b.log.blockNumber : b.number;

      if (aBlock === undefined || bBlock === undefined) {
        throw new Error("Unexpected undefined block number");
      }

      return Number(aBlock - bBlock);
    });

    for (const item of sorted) {
      if (item.log?.blockNumber !== undefined) {
        // log
        await this.#processLog(item as DiscreteLog<TContext>);
      } else {
        // block
        await this.#processBlock(item as Data["blocks"][number]);
      }
    }
  }

  async #processLog({
    log,
    logs,
    abi,
    contractId,
    handler,
  }: DiscreteLog<TContext> | GroupedLogs<TContext>) {
    const contract = log
      ? getContract({
          abi,
          address: log.address,
          publicClient: this.#client,
        })
      : undefined;

    try {
      await retry({
        callback: async () =>
          handler({
            ...this.#context,
            client: this.#client,
            contract,
            event: log,
            logger: this.#logger!.child({
              event: log?.eventName ?? logs?.[0].eventName,
              contract: contractId,
            }),
            store: this.#store,
            events: logs,
          }),
        maxRetries: this.#config.maxRetries,
        retryDelayMs: this.#config.retryDelayMs,
      });
    } catch (error) {
      console.error(error);
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
