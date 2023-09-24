import { Block, PublicClient } from "viem";
import { Store } from "../utils/store";

export type BlockHandler = <ExtendedContext = {}>(
  ctx: BlockHandlerContext<ExtendedContext>
) => Promise<void> | void;

export type BlockHandlerContext<ExtendedContext = {}> = {
  block: Block<bigint, true>;
  client: PublicClient;
  store: Store;
} & ExtendedContext;

// logger: unknown; // TODO @hazelnutcloud: add pinojs logger to extended context
// db: unknown; // TODO @hazelnutcloud: add drizzle db to extended context
