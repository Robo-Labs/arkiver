import { Abi, AbiEvent, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { GetContractReturnType, Log, PublicClient } from "viem";
import { Store } from "../utils/store";

export type EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>
> = (ctx: EventHandlerContext<TAbi, TEventName>) => Promise<void> | void;

export type EventHandlerContext<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>
> = {
  event: Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>, true>;
  eventName: TEventName;
  client: PublicClient;
  store: Store;
  contract: GetContractReturnType<TAbi, PublicClient>;
  logger: unknown; // TODO @hazelnutcloud: add pinojs logger
  db: unknown; // TODO @hazelnutcloud: add drizzle db
  getTimestampMs: () => Promise<number>;
};
