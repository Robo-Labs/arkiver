import { Block, PublicClient } from "viem";
import { Store } from "../utils/store";
import { Logger } from "pino";

export type BlockHandler = <ExtendedContext = {}>(
  ctx: BlockHandlerContext<ExtendedContext>
) => Promise<void> | void;

export type BlockHandlerContext<ExtendedContext = {}> = {
  block: Block<bigint, true>;
  client: PublicClient;
  store: Store;
  logger: Logger;
} & ExtendedContext;

// db: unknown; // TODO @hazelnutcloud: add drizzle db to extended context
