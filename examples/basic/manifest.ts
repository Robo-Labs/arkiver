import { Manifest } from "arkiver";
import { schema } from "./schema";
import { ERC20_ABI } from "./abis/erc20";
import { onTransfer } from "./handlers/transfer";

export default new Manifest("basic")
  .schema(schema)
  .chain("mainnet", (chain) => {
    chain
      .setOptions({
        rpcUrls: ["https://rpc.ankr.com/eth", "https://eth.llamarpc.com"],
        blockRange: 50n,
      })
      .contract({
        name: "Erc20",
        abi: ERC20_ABI,
        eventHandlers: {
          Transfer: onTransfer,
        },
        sources: {
          "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984": 18361783n,
        },
      });
  });
