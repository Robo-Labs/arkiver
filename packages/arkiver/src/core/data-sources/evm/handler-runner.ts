import { Abi, getContract } from "viem";
import { BoundedData, Data } from "./data-queue";
import { AddressTopicInfo, ManifestLoader } from "./loader";
import { Logger } from "pino";
import { ArkiveClient } from "../../client";
import { retry } from "../../../utils/promise";
import EventEmitter from "eventemitter3";
import { DataSourceManifest } from "../../manifest";
import { DbProvider } from "../../db-provider";
import {
  EventHandler,
  EventHandlerHook,
} from "../../event-handler";

export interface EvmHandlerRunnerParams<TStore extends {}> {
  dataSourceManifest: DataSourceManifest<TStore>;
  client: ArkiveClient;
  context: TStore;
  loader: ManifestLoader<TStore>;
  dbProvider: DbProvider;
  chain: string;
  hooks: {
    beforeHandle?: EventHandlerHook<TStore, string>;
    afterHandle?: EventHandlerHook<TStore, string>;
  };
  logger?: Logger;
  maxRetries?: number;
  retryDelayMs?: number;
}

type DiscreteLog<TStore extends {}> = {
  log: Data["logs"][number];
} & AddressTopicInfo<TStore>;

type GroupedLogs<TStore extends {}> = AddressTopicInfo<TStore> & {
  logs: Data["logs"];
  log?: never;
};

export class EvmHandlerRunner<TStore extends {}> extends EventEmitter {
  #client: ArkiveClient;
  #store: TStore;
  #loader: ManifestLoader<TStore>;
  #dbProvider: DbProvider;
  #chain: string;
  #highestProcessedBlock = 0n;
  #hooks: {
    beforeHandle?: EventHandlerHook<TStore, string>;
    afterHandle?: EventHandlerHook<TStore, string>;
  };
  #logger?: Logger;
  #config: {
    maxRetries: number;
    retryDelayMs: number;
  };

  constructor({
    dataSourceManifest: { contracts },
    client,
    context,
    loader,
    logger,
    dbProvider,
    chain,
    hooks,
    maxRetries = 5,
    retryDelayMs = 500,
  }: EvmHandlerRunnerParams<TStore>) {
    super();
    this.#client = client;
    this.#store = context;
    this.#loader = loader;
    this.#logger = logger;
    this.#dbProvider = dbProvider;
    this.#hooks = hooks;
    this.#chain = chain;
    this.#config = {
      maxRetries,
      retryDelayMs,
    };
  }

  async processData({ data: { logs }, endBlock, startBlock }: BoundedData) {
    this.#logger?.debug({
      event: "evmHandlerRunner.processData",
      context: { logs: logs.length },
    });

    const discreteLogs: DiscreteLog<TStore>[] = [];

    for (const log of logs) {
      const topic0 = log.topics[0];
      const address = log.address;

      let handler: EventHandler<Abi, string, string, TStore>;
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

      discreteLogs.push({ log, abi, contractId, handler });
    }

    await this.#hooks.beforeHandle?.({
      blockNumber: startBlock,
      chain: this.#chain,
      client: this.#client,
      logger: this.#logger!,
      store: this.#store,
    });
    await this.#processDiscrete(discreteLogs);
    await this.#hooks.afterHandle?.({
      blockNumber: endBlock,
      chain: this.#chain,
      client: this.#client,
      logger: this.#logger!,
      store: this.#store,
    });

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
    ]);
  }

  async #processDiscrete(logs: DiscreteLog<TStore>[]) {
    const sorted = logs.sort((a, b) => {
      return Number(a.log.blockNumber - b.log.blockNumber);
    });

    for (const item of sorted) {
      await this.#processLog(item as DiscreteLog<TStore>);
    }
  }

  async #processLog({ log, abi, contractId, handler }: DiscreteLog<TStore>) {
    const contract = getContract({
      abi,
      address: log.address,
      publicClient: this.#client,
    });

    try {
      await retry({
        callback: async () =>
          handler({
            store: this.#store,
            client: this.#client,
            contract,
            event: log,
            logger: this.#logger!.child({
              event: log.eventName,
              contract: contractId,
            }),
            chain: this.#chain,
          }),
        maxRetries: this.#config.maxRetries,
        retryDelayMs: this.#config.retryDelayMs,
      });
    } catch (error) {
      console.error(error);
      this.emit("error", error);
    }
  }
}
