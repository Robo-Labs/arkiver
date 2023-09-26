import { Logger } from "pino";
import { ArkiveManifest, Contract } from "../types/manifest";
import { ArkiveRecord } from "../types/record";
import { DbProvider } from "./db-provider";
import { childSource } from "../tables/child-source";
import { getChainObjFromChainName } from "../utils/chains";

export interface ArkiverParams<TContext extends {}> {
  manifest: ArkiveManifest<TContext>;
  dbProvider: DbProvider;
  record: ArkiveRecord;
  context: TContext;
  logger: Logger;
  rpcUrls?: Record<string, string[]>;
}

export class Arkiver<TContext extends {}> {
  #manifest: ArkiveManifest<TContext>;
  #dbProvider: DbProvider;
  #record: ArkiveRecord;
  #context: TContext;
  #rpcUrls?: Record<string, string[]>;
  #logger: Logger;

  constructor({
    dbProvider,
    manifest,
    rpcUrls,
    record,
    context,
    logger,
  }: ArkiverParams<TContext>) {
    this.#manifest = manifest;
    this.#rpcUrls = rpcUrls;
    this.#dbProvider = dbProvider;
    this.#record = record;
    this.#context = context;
    this.#logger = logger;
  }

  async start() {
    this.#logger.info({ event: "arkiver.start" });
    await this.#initDataSources();
  }

  async #initDataSources() {
    this.#logger.info({ event: "arkiver.initDataSources" });

    const childSources = await this.#dbProvider.getChildSource();

    await Promise.all(
      Object.entries(this.#manifest.dataSources).map(
        async ([chain, dataSource]) => {
          if (!dataSource) return;

          this.#logger.info({
            event: "arkiver.initDataSources",
            context: { chain },
          });

          const contract = mergeContracts(dataSource.contracts, childSources);

          const rpcUrls = this.#rpcUrls?.[chain] ?? dataSource.options.rpcUrls;

          if (rpcUrls.length === 0) {
            throw new Error(`No rpcUrls specified for chain ${chain}`);
          }

          dataSource.options.rpcUrls = rpcUrls;

          // const dataSource = new DataSource() // TODO @hazelnutcloud: create data source
          // dataSource.onSynced(() => {
          // dataSource.onError((err) => {

          // await dataSource.start()
        }
      )
    );
  }
}

const mergeContracts = <TContext extends {}>(
  contracts: Record<string, Contract<TContext>>,
  childSources: (typeof childSource.selectType)[]
) => {
  if (!contracts) {
    return [];
  }

  if (!childSources) {
    return contracts;
  }

  for (const spawnedSource of childSources) {
    const contract = contracts[spawnedSource.id];
    if (!contract) {
      continue;
    }
    contract.sources[spawnedSource.address] = spawnedSource.startBlockHeight;
  }

  return contracts;
};
