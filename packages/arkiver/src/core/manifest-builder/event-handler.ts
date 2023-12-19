import { Abi, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Logger } from "pino";
import { Log, GetContractReturnType, PublicClient } from "viem";
import { Store } from "../../utils/store";
import { ArkiveClient } from "../client";
import { Prettify } from "../../utils/types";

// export const eventHandler = <
//   TParams extends {
//     schema: Record<string, unknown>;
//     abi: Abi;
//     eventName: ExtractAbiEventNames<TParams["abi"]>;
//     batchProcess: boolean;
//   },
//   THandler extends EventHandler<
//     TParams["abi"],
//     TParams["eventName"],
//     TParams["batchProcess"],
//     { db: PostgresJsDatabase<TParams["schema"]> }
//   >
// >(
//   { batchProcess }: TParams,
//   handler: THandler
// ): EventHandler<
//   TParams["abi"],
//   TParams["eventName"],
//   TParams["batchProcess"],
//   { db: PostgresJsDatabase<TParams["schema"]> }
// > => Object.assign(handler, { _batchProcess: batchProcess }) as any;

export interface BaseContext<TStore> {
  client: ArkiveClient;
  store: TStore;
  logger: Logger;
}

export type EventHandlerContext<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TStore
> = Prettify<
  {
    event: Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>, true>;
    contract: GetContractReturnType<TAbi, PublicClient>;
  } & BaseContext<TStore>
>;

export type EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TStore = {}
> = (
  ctx: EventHandlerContext<TAbi, TEventName, TStore>
) => Promise<void> | void;

export type EventHandlerHook<TStore> = (
  ctx: BaseContext<TStore> & { blockNumber: bigint }
) => Promise<void> | void;
