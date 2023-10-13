import { encodeEventTopics, maxUint256 } from "viem";
import { getAbiEvents } from "../../../utils/abi";
import { bigintMin } from "../../../utils/bigint";
import { Abi, AbiEvent } from "abitype";
import { Logger } from "pino";
import { DataSourceManifest, BlockHandler, Contract, BlockHandlerInfo } from "../../manifest-builder/manifest";
import { EventHandler } from "../../manifest-builder/event-handler";

export interface ManifestLoaderParams<TContext extends {}> {
  latestBlock: bigint;
  dataSourceManifest: DataSourceManifest<TContext>;
  logger?: Logger;
}

interface Sources<TContext extends {}> {
  wildcard: { startBlock: bigint; abiEvents: AbiEvent[] }[];
  specific: {
    sources: Record<string, bigint>;
    abiEvents: AbiEvent[];
  }[];
  blocks: {
    startBlock: bigint;
    interval: bigint;
    handler: BlockHandler<TContext>;
  }[];
}

interface AddressTopicInfo<TContext extends {}> {
  abi: Abi;
  handler: EventHandler<Abi, string, TContext>;
  contractId: string;
}

export class ManifestLoader<TContext extends {}> {
  #contracts: Record<string, Contract<TContext>>;
  #blockHandlers: BlockHandlerInfo<TContext>[];
  #latestBlock: bigint;
  #logger?: Logger;
  contractsLowestBlock: bigint;
  blocksLowestBlock: bigint;
  sources: Sources<TContext>;
  addressTopicHandlerMap: Map<
    string, // specific: address-topic0, wildcard: topic0
    AddressTopicInfo<TContext>
  >;

  constructor({
    dataSourceManifest,
    latestBlock,
    logger,
  }: ManifestLoaderParams<TContext>) {
    this.#latestBlock = latestBlock;
    this.#contracts = dataSourceManifest.contracts;
    this.#blockHandlers = dataSourceManifest.blockHandlers;
    this.#logger = logger;
    const {
      contractsLowestBlock,
      sources: contractSources,
      addressTopicHandlerMap,
    } = this.#loadContracts();
    const { blocksLowestBlock, sources: blockSources } = this.#loadBlocks();

    this.contractsLowestBlock = contractsLowestBlock;
    this.blocksLowestBlock = blocksLowestBlock;

    this.sources = {
      wildcard: contractSources.wildcard,
      specific: contractSources.specific,
      blocks: blockSources.blocks,
    };
    this.addressTopicHandlerMap = addressTopicHandlerMap;
  }

  #loadContracts() {
    let contractsLowestBlock = maxUint256;
    const sourcesRes: Omit<Sources<TContext>, "blocks"> = {
      wildcard: [],
      specific: [],
    };
    const addressTopicHandlerMap = new Map<
      string,
      AddressTopicInfo<TContext>
    >();

    for (const contract of Object.values(this.#contracts)) {
      // Get the lowest block from this contract's sources and update the contractsLowestBlock if it's lower
      const lowestBlock: bigint = Object.values(contract.sources).reduce(
        (lowestBlock: bigint, block) => {
          if (block === "live")
            return bigintMin(this.#latestBlock, lowestBlock);
          return bigintMin(block, lowestBlock);
        },
        maxUint256
      );

      if (lowestBlock < contractsLowestBlock) {
        contractsLowestBlock = lowestBlock;
      }

      // If the contract has a wildcard source, add it to the logSources and ignore the rest of the sources
      if (contract.sources["*"] !== undefined) {
        const abiEvents = getAbiEvents(
          contract.abi,
          Object.keys(contract.events)
        );
        sourcesRes.wildcard.push({
          startBlock:
            contract.sources["*"] === "live"
              ? this.#latestBlock
              : contract.sources["*"],
          abiEvents,
        });
        for (const abiEvent of abiEvents) {
          const topic0 = encodeEventTopics({
            abi: [abiEvent],
            eventName: abiEvent.name,
          })[0];
          const key = topic0.toLowerCase();
          if (addressTopicHandlerMap.has(key)) {
            this.#logger?.warn({
              source: "ManifestLoader.loadContracts",
              warning: "duplicate-topic0",
              context: {
                eventName: abiEvent.name,
                topic0,
                contractId: contract.id,
              },
            });
            continue;
          }
          addressTopicHandlerMap.set(key, {
            abi: contract.abi,
            handler: contract.events[abiEvent.name],
            contractId: contract.id,
          });
        }
        continue;
      }

      const abiEvents = getAbiEvents(
        contract.abi,
        Object.keys(contract.events)
      );

      const sources = Object.entries(contract.sources).reduce(
        (sources, [address, startBlock]) => {
          if (startBlock === "live") {
            sources[address] = this.#latestBlock;
          } else {
            sources[address] = startBlock;
          }
          return sources;
        },
        {} as Record<string, bigint>
      );

      for (const abiEvent of abiEvents) {
        const topic0 = encodeEventTopics({
          abi: [abiEvent],
          eventName: abiEvent.name,
        })[0];
        for (const address in sources) {
          const key = `${address}-${topic0}`.toLowerCase();
          if (addressTopicHandlerMap.has(key)) {
            this.#logger?.warn({
              source: "ManifestLoader.loadContracts",
              warning: "duplicate-address",
              context: {
                eventName: abiEvent.name,
                address,
                topic0,
                contractId: contract.id,
              },
            });
            continue;
          }
          addressTopicHandlerMap.set(key, {
            abi: contract.abi,
            handler: contract.events[abiEvent.name],
            contractId: contract.id,
          });
        }
      }

      sourcesRes.specific.push({
        sources,
        abiEvents,
      });
    }

    return {
      contractsLowestBlock,
      sources: sourcesRes,
      addressTopicHandlerMap,
    };
  }

  #loadBlocks() {
    let blocksLowestBlock = maxUint256;
    const sourcesRes: Pick<Sources<TContext>, "blocks"> = {
      blocks: [],
    };

    for (const blockHandlerInfo of this.#blockHandlers) {
      const startBlock =
        blockHandlerInfo.startBlockHeight === "live"
          ? this.#latestBlock
          : blockHandlerInfo.startBlockHeight;

      sourcesRes.blocks.push({
        interval: blockHandlerInfo.blockInterval,
        startBlock,
        handler: blockHandlerInfo.handler,
      });

      if (startBlock < blocksLowestBlock) {
        blocksLowestBlock = startBlock;
      }
    }

    return { blocksLowestBlock, sources: sourcesRes };
  }
}
