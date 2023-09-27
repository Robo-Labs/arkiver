import { AbiEvent } from "abitype";
import {
  GetBlockReturnType,
  GetLogsReturnType,
  WatchBlockNumberReturnType,
} from "viem";
import { ArkiveClient } from "../../../types/client";
import { Logger } from "pino";

export interface EvmDataProvider {
  fetchSpecificLogs({
    endBlock,
    startBlock,
    contracts,
  }: {
    startBlock: bigint;
    endBlock: bigint;
    contracts: {
      sources: Record<string, bigint>;
      abiEvents: AbiEvent[];
    }[];
  }): Promise<GetLogsReturnType<undefined, AbiEvent[], true, bigint, bigint>>;

  fetchWildcardLogs({
    startBlock,
    endBlock,
    sources,
  }: {
    startBlock: bigint;
    endBlock: bigint;
    sources: { startBlock: bigint; abiEvents: AbiEvent[] }[];
  }): Promise<GetLogsReturnType<undefined, AbiEvent[], true, bigint, bigint>>;

  fetchBlocks({
    startBlock,
    endBlock,
    sources,
  }: {
    startBlock: bigint;
    endBlock: bigint;
    sources: { startBlock: bigint; interval: bigint }[];
  }): Promise<GetBlockReturnType[]>;

  fetchLatestBlock(): Promise<bigint>;

  onBlock(
    handler: (blockNumber: bigint) => void,
    errorHandler: (error: Error) => void
  ): WatchBlockNumberReturnType;
}

export interface EvmDataProviderParams {
  client: ArkiveClient;
  logger?: Logger;
}

export class ViemDataProvider implements EvmDataProvider {
  #client: ArkiveClient;
  #logger?: Logger;

  constructor({ client, logger }: EvmDataProviderParams) {
    this.#client = client;
    this.#logger = logger;
  }

  async fetchSpecificLogs({
    endBlock,
    startBlock,
    contracts,
  }: {
    startBlock: bigint;
    endBlock: bigint;
    contracts: {
      sources: Record<string, bigint>;
      abiEvents: AbiEvent[];
    }[];
  }) {
    const addresses = [];
    const events = [];

    for (const contract of contracts) {
      const filteredSources = Object.entries(contract.sources)
        .filter(
          ([source, sourceStartBlock]) =>
            sourceStartBlock <= endBlock && sourceStartBlock >= startBlock
        )
        .map(([source]) => source);

      if (filteredSources.length === 0) continue;

      addresses.push(...filteredSources);
      events.push(...contract.abiEvents);
    }

    if (addresses.length === 0) return [];

    const logs = await this.#client.getLogs({
      address: addresses as `0x${string}`[],
      fromBlock: startBlock,
      toBlock: endBlock,
      events,
      strict: true,
    });

    this.#logger?.info({
      event: "ViemDataProvider.fetchSpecificLogs",
      context: { startBlock, endBlock, logs: logs.length },
    });

    return logs;
  }

  async fetchWildcardLogs({
    startBlock,
    endBlock,
    sources,
  }: {
    startBlock: bigint;
    endBlock: bigint;
    sources: { startBlock: bigint; abiEvents: AbiEvent[] }[];
  }) {
    const events = sources
      .filter(
        ({ startBlock: sourceStartBlock }) =>
          sourceStartBlock <= endBlock && sourceStartBlock >= startBlock
      )
      .flatMap(({ abiEvents }) => abiEvents);

    if (events.length === 0) return [];

    const logs = await this.#client.getLogs({
      fromBlock: startBlock,
      toBlock: endBlock,
      events,
      strict: true,
    });

    this.#logger?.debug({
      event: "ViemDataProvider.fetchWildcardLogs",
      context: { startBlock, endBlock, logs: logs.length },
    });

    return logs;
  }

  async fetchBlocks({
    startBlock,
    endBlock,
    sources,
  }: {
    startBlock: bigint;
    endBlock: bigint;
    sources: { startBlock: bigint; interval: bigint }[];
  }) {
    const blockNumbers = new Set<bigint>();

    for (const source of sources) {
      if (source.startBlock > endBlock) continue;

      let lowerBoundIndex = (startBlock - source.startBlock) / source.interval;

      const lowerBoundBlock =
        source.startBlock + lowerBoundIndex * source.interval;

      if (lowerBoundBlock < startBlock) {
        if (lowerBoundBlock + source.interval > endBlock) {
          // out of range
          continue;
        }
        lowerBoundIndex++;
      }

      const upperBoundIndex = (endBlock - source.startBlock) / source.interval;

      for (let index = lowerBoundIndex; index <= upperBoundIndex; index++) {
        blockNumbers.add(source.startBlock + index * source.interval);
      }
    }

    if (blockNumbers.size === 0) return [];

    const blocks = await Promise.all(
      Array.from(blockNumbers).map(async (blockNumber) => {
        return await this.#client.getBlock({ blockNumber });
      })
    );

    this.#logger?.debug({
      event: "ViemDataProvider.fetchBlocks",
      context: { startBlock, endBlock, blocks: blocks.length },
    });

    return blocks;
  }

  onBlock(
    handler: (blockNumber: bigint) => void,
    errorHandler: (error: Error) => void
  ) {
    const unwatch = this.#client.watchBlockNumber({
      emitOnBegin: true,
      emitMissed: true,
      onBlockNumber: handler,
      onError: errorHandler,
    });
    return unwatch;
  }

  async fetchLatestBlock() {
    return await this.#client.getBlockNumber();
  }
}
