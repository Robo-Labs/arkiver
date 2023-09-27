import { Client, Transport, Chain, PublicRpcSchema, PublicActions } from "viem";

export type ArkiveClient = Client<
  Transport,
  Chain,
  undefined,
  PublicRpcSchema,
  PublicActions<Transport, Chain> & {
    getBlockTimestamp: (params: GetBlockTimestampParameters) => Promise<bigint>;
  }
>;

export type GetBlockTimestampParameters =
  | { blockNumber: bigint; blockHash?: never; cacheTime?: number }
  | { blockNumber?: never; blockHash: `0x${string}`; cacheTime?: number };
