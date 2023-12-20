import { Abi, ExtractAbiEvent, ExtractAbiEventNames } from "abitype";
import { Logger } from "pino";
import { Log, GetContractReturnType, PublicClient } from "viem";
import { ArkiveClient } from "./client";
import { Prettify } from "../utils/types";

export interface BaseContext<TStore, TChains extends string> {
  client: ArkiveClient;
  store: TStore;
  logger: Logger;
  chain: TChains;
}

export type EventHandlerContext<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TStore,
  TChains extends string
> = Prettify<
  {
    event: Log<bigint, number, false, ExtractAbiEvent<TAbi, TEventName>, true>;
    contract: GetContractReturnType<TAbi, PublicClient>;
  } & BaseContext<TStore, TChains>
>;

export type EventHandler<
  TAbi extends Abi,
  TEventName extends ExtractAbiEventNames<TAbi>,
  TChains extends string,
  TStore = {}
> = (
  ctx: EventHandlerContext<TAbi, TEventName, TStore, TChains>
) => Promise<void> | void;

export type EventHandlerHook<TStore, TChains extends string> = (
  ctx: BaseContext<TStore, TChains> & { blockNumber: bigint }
) => Promise<void> | void;
