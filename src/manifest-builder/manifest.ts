import { ArkiveManifest, Chains } from "../types";
import { DataSourceBuilder } from "./data-source";

export const manifestVersion = "v1";

export class Manifest<TChains extends Chains = ""> {
  manifest: ArkiveManifest;

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
    builderFn: (builder: DataSourceBuilder<{}>) => void
  ): Manifest<TChains | TChain> {
    builderFn(new DataSourceBuilder(this, chain));
    if (!this.manifest.dataSources[chain]?.options.rpcUrl) {
      throw new Error(`RPC URL is required for chain ${chain}`);
    }
    return this as Manifest<TChains | TChain>;
  }
}
