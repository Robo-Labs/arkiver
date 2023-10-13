import { Manifest } from "arkiver";
import { schema } from "./schema";
import { ERC20_ABI } from "./abis/erc20";
import { onTransfer } from "./handlers/transfer";

export default new Manifest("new-basic")
  .schema(schema)
  .chain("mainnet", (chain) => {
    chain.contract({
      name: "test-contract",
      abi: ERC20_ABI,
      eventHandlers: {
				Transfer: onTransfer
			},
    });
  })
