import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { childSource } from "./tables/child-source";
import { chainMetadata } from "./tables/chain-metadata";
import { arkiveMetadata } from "./tables/arkive-metadata";
import { eq, sql } from "drizzle-orm";
import { Logger } from "pino";
import path from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export interface UpdateChainBlockParams {
  chain: string;
  blockHeight: bigint;
  column: Extract<keyof typeof chainMetadata.$inferInsert, `${string}Block`>;
}

export interface IncrementMetadataValueParams {
  chain: string;
  value: number;
  column: Extract<keyof typeof chainMetadata.$inferInsert, `total${string}`>;
}

export interface DbProvider {
  getChildSource(): Promise<(typeof childSource.$inferSelect)[]>;
  getHighestProcessedBlock(chain: string): Promise<bigint>;
  updateChainBlock(params: UpdateChainBlockParams): Promise<void>;
  incrementMetadataValue(params: IncrementMetadataValueParams): Promise<void>;
}

type ArkiveBaseSchema = {
  childSource: typeof childSource;
  chainMetadata: typeof chainMetadata;
  arkiveMetadata: typeof arkiveMetadata;
};

export interface BunSqliteProviderParams {
  db: BunSQLiteDatabase<ArkiveBaseSchema>;
  logger?: Logger;
}

export class BunSqliteProvider implements DbProvider {
  #db: BunSQLiteDatabase<ArkiveBaseSchema>;
  #logger?: Logger;

  constructor({ db, logger }: BunSqliteProviderParams) {
    this.#db = db;
    this.#logger = logger;

    const coreMigrationsDir = path.join(import.meta.dir, "./tables/migrations");
    migrate(db, { migrationsFolder: coreMigrationsDir });
  }

  async getChildSource() {
    this.#logger?.debug({ event: "dbProvider.getChildSource" });

    return await this.#db.query.childSource.findMany();
  }

  async getHighestProcessedBlock(chain: string) {
    this.#logger?.debug({
      event: "dbProvider.getHighestProcessedBlock",
      context: { chain },
    });

    return (
      (await this.#db.query.chainMetadata.findFirst())?.highestProcessedBlock ??
      0n
    );
  }

  async incrementMetadataValue({
    chain,
    value,
    column,
  }: IncrementMetadataValueParams) {
    this.#logger?.debug({
      event: "dbProvider.incrementMetadataValue",
      context: { chain, value, column },
    });

		const valueObj = {
			[column]: value
		}

    await this.#db
      .insert(chainMetadata)
			.values({
				chain,
				highestFetchedBlock: 0n,
				highestProcessedBlock: 0n,
				totalBlocksFetched: 0,
				totalBlocksProcessed: 0,
				totalLogsFetched: 0,
				totalLogsProcessed: 0,
				...valueObj
			})
      .onConflictDoUpdate({
				target: chainMetadata.chain,
				set: {
					[column]: sql`${chainMetadata[column]} + ${value}`
				}
			});
  }

  async updateChainBlock({
    chain,
    blockHeight,
    column,
  }: UpdateChainBlockParams) {
    this.#logger?.debug({
      event: "dbProvider.updateChainBlock",
      context: { chain, blockHeight, column },
    });

		const value = {
			[column]: blockHeight
		}

    await this.#db
      .insert(chainMetadata)
			.values({
				chain,
				highestFetchedBlock: 0n,
				highestProcessedBlock: 0n,
				totalBlocksFetched: 0,
				totalBlocksProcessed: 0,
				totalLogsFetched: 0,
				totalLogsProcessed: 0,
				...value
			})
      .onConflictDoUpdate({
				target: chainMetadata.chain,
				set: {
					[column]: blockHeight
				}
			});
  }
}
