import { Logger } from "pino";
import { ArkiveManifest, Contract } from "./manifest-builder/manifest";
import { ArkiveRecord } from "./record";
import { DbProvider } from "./db-provider";
import { childSource } from "./tables/child-source";
import { EvmDataSource } from "./data-sources/evm/evm";

export interface ArkiverParams<TContext extends {}> {
  manifest: ArkiveManifest<TContext>;
  dbProvider: DbProvider;
  record?: ArkiveRecord;
  context: TContext;
  logger?: Logger;
  rpcUrls?: Record<string, string[]>;
}

export class Arkiver<TContext extends {}> {
  #manifest: ArkiveManifest<TContext>;
  #dbProvider: DbProvider;
  #record?: ArkiveRecord;
  #context: TContext;
  #dataSources: EvmDataSource<TContext>[] = [];
  #rpcUrls?: Record<string, string[]>;
  #logger?: Logger;

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
    this.#logger?.info({ event: "arkiver.start" });
    await this.#initDataSources();
  }

  async #initDataSources() {
    this.#logger?.info({ event: "arkiver.initDataSources" });

    await Promise.all(
      Object.entries(this.#manifest.dataSources).map(
        async ([chain, dataSourceManifest]) => {
          if (!dataSourceManifest) return;

          this.#logger?.info({
            event: "arkiver.initDataSources",
            context: { chain },
          });

					const childSources = await this.#dbProvider.getChildSource(chain);

          const contract = mergeContracts(
            dataSourceManifest.contracts,
            childSources
          );

          const rpcUrls =
            this.#rpcUrls?.[chain] ?? dataSourceManifest.options.rpcUrls;

          if (rpcUrls.length === 0) {
            throw new Error(`No rpcUrls specified for chain ${chain}`);
          }

          dataSourceManifest.options.rpcUrls = rpcUrls;

          const dataSource = new EvmDataSource({
            chain,
            context: this.#context,
            dataSourceManifest,
            dbProvider: this.#dbProvider,
            record: this.#record,
            logger: this.#logger,
          });

          dataSource.on("error", (error) => {
            this.#logger?.error({
              event: "arkiver.initDataSources",
              context: { chain },
              error,
            });
            this.stop();
          });

          this.#dataSources.push(dataSource);

          await dataSource.start();
        }
      )
    );
  }

  stop() {
    this.#dataSources.forEach((dataSource) => dataSource.stop());
  }
}

const mergeContracts = <TContext extends {}>(
  contracts: Record<string, Contract<TContext>>,
  childSources: (typeof childSource.$inferSelect)[]
) => {
  if (!contracts) {
    return [];
  }

  if (!childSources) {
    return contracts;
  }

  for (const spawnedSource of childSources) {
    const contract = contracts[spawnedSource.contract];
    if (!contract) {
      continue;
    }
    contract.sources[spawnedSource.address] = spawnedSource.startBlockHeight;
  }

  return contracts;
};
