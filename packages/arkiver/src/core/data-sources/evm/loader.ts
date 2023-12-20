import { encodeEventTopics, maxUint256 } from "viem";
import { getAbiEvents } from "../../../utils/abi";
import { bigintMin } from "../../../utils/bigint";
import { Abi, AbiEvent } from "abitype";
import { Logger } from "pino";
import {
  DataSourceManifest,
  Contract,
} from "../../manifest";
import { EventHandler } from "../../event-handler";

export interface ManifestLoaderParams<TStore extends {}> {
  latestBlock: bigint;
  dataSourceManifest: DataSourceManifest<TStore>;
  logger?: Logger;
}

interface Sources<TStore extends {}> {
  wildcard: { startBlock: bigint; abiEvents: AbiEvent[] }[];
  specific: {
    sources: Record<string, bigint>;
    abiEvents: AbiEvent[];
  }[];
}

export interface AddressTopicInfo<TStore extends {}> {
  abi: Abi;
  handler: EventHandler<Abi, string, string, TStore>;
  contractId: string;
}

export class ManifestLoader<TStore extends {}> {
  #contracts: Record<string, Contract<TStore>>;
  #latestBlock: bigint;
  #logger?: Logger;
  contractsLowestBlock: bigint;
  sources: Sources<TStore>;
  addressTopicHandlerMap: Map<
    string, // specific: address-topic0, wildcard: topic0
    AddressTopicInfo<TStore>
  >;

  constructor({
    dataSourceManifest,
    latestBlock,
    logger,
  }: ManifestLoaderParams<TStore>) {
    this.#latestBlock = latestBlock;
    this.#contracts = dataSourceManifest.contracts;
    this.#logger = logger;
    const {
      contractsLowestBlock,
      sources: contractSources,
      addressTopicHandlerMap,
    } = this.#loadContracts();

    this.contractsLowestBlock = contractsLowestBlock;

    this.sources = {
      wildcard: contractSources.wildcard,
      specific: contractSources.specific,
    };
    this.addressTopicHandlerMap = addressTopicHandlerMap;
  }

  #loadContracts() {
    let contractsLowestBlock = maxUint256;
    const sourcesRes: Omit<Sources<TStore>, "blocks"> = {
      wildcard: [],
      specific: [],
    };
    const addressTopicHandlerMap = new Map<
      string,
      AddressTopicInfo<TStore>
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
}
