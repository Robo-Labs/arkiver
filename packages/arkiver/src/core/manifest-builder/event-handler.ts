import { Abi, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Logger } from "pino";
import { Log, GetContractReturnType, PublicClient } from "viem";
import { Store } from "../../utils/store";
import { ArkiveClient } from "../client";
import { Prettify } from "../../utils/types";

export const eventHandler = <
  TParams extends {
    schema: Record<string, unknown>;
    abi: Abi;
    eventName: ExtractAbiEventNames<TParams["abi"]>;
    batchProcess: boolean;
  },
  THandler extends _EventHandler<
    TParams["abi"],
    TParams["eventName"],
    TParams["batchProcess"],
    { db: PostgresJsDatabase<TParams["schema"]> }
  >
>(
  { batchProcess }: TParams,
  handler: THandler
): EventHandler<
  TParams["abi"],
  TParams["eventName"],
  TParams["batchProcess"],
  { db: PostgresJsDatabase<TParams["schema"]> }
> => Object.assign(handler, { _batchProcess: batchProcess }) as any;

export type EventHandlerContext<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TBatchProcess extends boolean,
  ExtendedContext = {}
> = {
  event: TBatchProcess extends true
    ? undefined
    : Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>, true>;
  events: TBatchProcess extends false
    ? undefined
    : Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>, true>[];
  client: ArkiveClient;
  store: Store;
  contract: TBatchProcess extends true
    ? undefined
    : GetContractReturnType<TAbi, PublicClient>;
  logger: Logger;
} & ExtendedContext;

type _EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TBatchProcess extends boolean,
  ExtendedContext = {}
> = (
  ctx: EventHandlerContext<TAbi, TEventName, TBatchProcess, ExtendedContext>
) => Promise<void> | void;

export type EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TBatchProcess extends boolean,
  ExtendedContext = {}
> = _EventHandler<TAbi, TEventName, TBatchProcess, ExtendedContext> & {
  _batchProcess: TBatchProcess;
};
