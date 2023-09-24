import {
  arbitrum,
  avalanche,
  fantom,
  localhost,
  mainnet,
  optimism,
  polygon,
} from "viem/chains";
import { Chain } from "viem";

export const supportedChains = {
  arbitrum,
  avalanche,
  mainnet,
  fantom,
  polygon,
  optimism,
  localhost,
} as {
  arbitrum: Chain;
  avalanche: Chain;
  mainnet: Chain;
  fantom: Chain;
  polygon: Chain;
  optimism: Chain;
  localhost: Chain;
};

export const getChainObjFromChainName = (chain: string) => {
  const chainObj = supportedChains[chain as keyof typeof supportedChains];
  if (!chainObj) {
    return null;
  }
  return chainObj;
};
