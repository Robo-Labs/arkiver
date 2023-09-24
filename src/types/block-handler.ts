import { Block, PublicClient } from "viem";
import { Store } from "../utils/store";

export type BlockHandler = (ctx: BlockHandlerContext) => Promise<void> | void;

export interface BlockHandlerContext {
  block: Block<bigint, true>;
  client: PublicClient;
  store: Store;
  logger: unknown; // TODO @hazelnutcloud: add pinojs logger
  db: unknown; // TODO @hazelnutcloud: add drizzle db
}
