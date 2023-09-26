import { ArkiveManifest, Chains } from "../types";
import { DataSourceBuilder } from "./data-source";

export const manifestVersion = "v1";

export class BaseManifest<TContext extends {}, TChains extends Chains = ""> {
  manifest: ArkiveManifest<TContext>;

  constructor(name: string) {
    if (name.search(/[^a-zA-Z0-9_-]/g) !== -1) {
      throw new Error(`Invalid name: ${name}`);
    }
    const formattedName = name.replace(" ", "-").toLowerCase();

    this.manifest = {
      name: formattedName,
      version: manifestVersion,
      dataSources: {},
      tables: [],
    };
  }

  chain<TChain extends Exclude<Chains, TChains>>(
    chain: TChain,
    builderFn: (builder: DataSourceBuilder<{}, TContext>) => void
  ): BaseManifest<TContext, TChains | TChain> {
    builderFn(new DataSourceBuilder(this, chain));
    if (this.manifest.dataSources[chain]?.options.rpcUrls.length === 0) {
      throw new Error(`At least one RPC URL is required for chain ${chain}`);
    }
    return this;
  }
}
