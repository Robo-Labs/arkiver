import { Block } from "viem";
import { Store } from "../utils/store";
import { Logger } from "pino";
import { ArkiveClient } from "./client";

export type BlockHandler<ExtendedContext extends {}> = (
  ctx: BlockHandlerContext<ExtendedContext>
) => Promise<void> | void;

export type BlockHandlerContext<ExtendedContext extends {}> = {
  block: Block<bigint, false>;
  client: ArkiveClient;
  store: Store;
  logger: Logger;
} & ExtendedContext;
