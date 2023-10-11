import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { childSource } from "./tables/child-source";
import { chainMetadata } from "./tables/chain-metadata";
import { arkiveMetadata } from "./tables/arkive-metadata"
import { eq, sql } from "drizzle-orm";
import { Logger } from "pino";

export interface UpdateChainBlockParams {
  chain: string;
  blockHeight: bigint;
  type: Extract<keyof typeof chainMetadata.$inferInsert, `${string}Block`>;
}

export interface IncrementValueParams {
  chain: string;
  value: number;
  type: Extract<keyof typeof chainMetadata.$inferInsert, `total${string}`>;
}

export interface DbProvider {
  getChildSource(): Promise<(typeof childSource.$inferSelect)[]>;
  getHighestProcessedBlock(chain: string): Promise<bigint>;
  updateChainBlock({
    chain,
    blockHeight,
  }: UpdateChainBlockParams): Promise<void>;
  incrementValue({ chain, value, type }: IncrementValueParams): Promise<void>;
}

type ArkiveBaseSchema = {
	childSource: typeof childSource;
	chainMetadata: typeof chainMetadata;
	arkiveMetadata: typeof arkiveMetadata;
}

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
      (await this.#db.query.chainMetadata.findFirst())
        ?.highestProcessedBlock ?? 0n
    );
  }

  async incrementValue({ chain, value, type }: IncrementValueParams) {
    this.#logger?.debug({
      event: "dbProvider.incrementValue",
      context: { chain, value, type },
    });

    await this.#db
      .update(chainMetadata)
      .set({
        [type]: sql`${chainMetadata[type]} + ${value}`,
      })
      .where(eq(chainMetadata.chain, chain));
  }

  async updateChainBlock({ chain, blockHeight, type }: UpdateChainBlockParams) {
    this.#logger?.debug({
      event: "dbProvider.updateChainBlock",
      context: { chain, blockHeight, type },
    });

    await this.#db
      .update(chainMetadata)
      .set({
        [type]: blockHeight,
      })
      .where(eq(chainMetadata.chain, chain));
  }
}
