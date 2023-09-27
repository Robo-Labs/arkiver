import {
  Chain,
  FallbackTransport,
  createPublicClient,
  fallback,
  http,
} from "viem";
import { ArkiveClient, GetBlockTimestampParameters } from "../types/client";
import { withCache } from "./cache";

export const createArkiveClient = ({
  rpcUrls,
}: {
  rpcUrls: string[];
}): ArkiveClient =>
  createPublicClient<FallbackTransport, Chain>({
    transport: fallback(rpcUrls.map((rpcUrl) => http(rpcUrl))),
    batch: {
      multicall: true,
    },
  }).extend((client) => ({
    getBlockTimestamp: async ({
      blockNumber,
      blockHash,
      cacheTime = client.cacheTime,
    }: GetBlockTimestampParameters) => {
      const block = await withCache(
        () => {
          if (blockNumber !== undefined) {
            return client.getBlock({ blockNumber });
          } else {
            return client.getBlock({ blockHash });
          }
        },
        {
          cacheKey: client.uid,
          cacheTime,
        }
      );
      return block.timestamp;
    },
  }));
