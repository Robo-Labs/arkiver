import { Abi, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { GetContractReturnType, Log, PublicClient } from "viem";
import { Store } from "../utils/store";
import { Logger } from "pino";
import { ArkiveClient } from "./client";

export type EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  ExtendedContext = {}
> = (
  ctx: EventHandlerContext<TAbi, TEventName, ExtendedContext>
) => Promise<void> | void;

export type EventHandlerContext<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  ExtendedContext = {}
> = {
  event: Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>, true>;
  client: ArkiveClient;
  store: Store;
  contract: GetContractReturnType<TAbi, PublicClient>;
  logger: Logger;
} & ExtendedContext;
