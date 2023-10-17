import { Manifest } from "arkiver";
import { schema } from "./schema";
import { ERC20_ABI } from "./abis/erc20";
import { onTransfer } from "./handlers/transfer";

export default new Manifest("basic")
  .schema(schema)
  .chain("mainnet", (chain) => {
    chain
      .setOptions({
        rpcUrls: [
          "https://eth-mainnet.g.alchemy.com/v2/Gq_75hb6-e8rOFxxTn7lSCCFjJsFdz-p",
          "https://eth.llamarpc.com",
          "https://rpc.ankr.com/eth",
        ],
        blockRange: 100n,
      })
      .contract({
        name: "Erc20",
        abi: ERC20_ABI,
        eventHandlers: {
          Transfer: onTransfer,
        },
        sources: {
          "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 10861674n,
        },
      });
  });
