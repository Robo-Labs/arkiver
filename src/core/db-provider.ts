import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { childSource } from "../tables/child-source";
import { arkiveBaseSchema } from "../tables/schema";
import { chainMetadata } from "../tables/chain-metadata";
import { eq, sql } from "drizzle-orm";

export interface UpdateChainBlockParams {
  chain: string;
  blockHeight: bigint;
  type: Extract<keyof typeof chainMetadata.insertType, `${string}Block`>;
}

export interface IncrementValueParams {
  chain: string;
  value: number;
  type: Extract<keyof typeof chainMetadata.insertType, `total${string}`>;
}

export interface DbProvider {
  getChildSource(): Promise<(typeof childSource.selectType)[]>;
  getHighestProcessedBlock(chain: string): Promise<bigint>;
  updateChainBlock({
    chain,
    blockHeight,
  }: UpdateChainBlockParams): Promise<void>;
  incrementValue({ chain, value, type }: IncrementValueParams): Promise<void>;
}

export interface PgDrizzleProviderParams {
  db: PostgresJsDatabase<typeof arkiveBaseSchema>;
}

export class PgDrizzleProvider implements DbProvider {
  #db: PostgresJsDatabase<typeof arkiveBaseSchema>;

  constructor({ db }: PgDrizzleProviderParams) {
    this.#db = db;
  }

  async getChildSource() {
    return await this.#db.query.child_source.findMany();
  }

  async getHighestProcessedBlock(chain: string) {
    return (
      (await this.#db.query.chain_metadata.findFirst())
        ?.highestProcessedBlock ?? 0n
    );
  }

  async incrementValue({ chain, value, type }: IncrementValueParams) {
    await this.#db
      .update(chainMetadata.table)
      .set({
        [type]: sql`${chainMetadata.table[type]} + ${value}`,
      })
      .where(eq(chainMetadata.table.chain, chain));
  }

  async updateChainBlock({ chain, blockHeight, type }: UpdateChainBlockParams) {
    await this.#db
      .update(chainMetadata.table)
      .set({
        [type]: blockHeight,
      })
      .where(eq(chainMetadata.table.chain, chain));
  }
}
