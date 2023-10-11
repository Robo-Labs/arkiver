import {
	Client, Transport, Chain, PublicRpcSchema, PublicActions,
	FallbackTransport,
	createPublicClient,
	fallback,
	http,
} from "viem";
import { withCache } from "../utils/cache";

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
