import { Abi, AbiEvent, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { GetContractReturnType, Log, PublicClient } from "viem";
import { Store } from "../utils/store";

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
  eventName: TEventName;
  client: PublicClient;
  store: Store;
  contract: GetContractReturnType<TAbi, PublicClient>;
  getTimestampMs: () => Promise<number>;
} & ExtendedContext;

// logger: unknown; // TODO @hazelnutcloud: add pinojs logger to extended context
// db: unknown; // TODO @hazelnutcloud: add drizzle db to extended context
