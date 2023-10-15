import { Abi, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Logger } from "pino";
import { Log, GetContractReturnType, PublicClient } from "viem";
import { Store } from "../../utils/store";
import { ArkiveClient } from "../client";

export const eventHandler = <
  TSchema extends Record<string, unknown>,
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  THandler extends EventHandler<
    TAbi,
    TEventName,
    { db: PostgresJsDatabase<TSchema> }
  >
>(_: {
  schema: TSchema;
  abi: TAbi;
  eventName: TEventName;
}, handler: THandler): THandler => handler;

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

export type EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  ExtendedContext = {}
> = (
  ctx: EventHandlerContext<TAbi, TEventName, ExtendedContext>
) => Promise<void> | void;