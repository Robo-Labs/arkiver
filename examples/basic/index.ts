import pino from "pino";
import { Arkiver } from "../../src/core/arkiver";
import { PgDrizzleProvider } from "../../src/core/db-provider";
import { Manifest } from "../../src/manifest-builder/drizzle-pg-manifest";
import { ERC20_ABI } from "./erc20";
import { onTransfer } from "./transfer";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "./schema";

const manifest = new Manifest(schema).chain("mainnet", (chain) => {
  chain
    .setOptions({
      rpcUrls: ["https://rpc.ankr.com/eth", "https://eth.llamarpc.com"],
      blockRange: 100n,
    })
    .contract({
      name: "ERC20",
      abi: ERC20_ABI,
      sources: { "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 18230000n },
      eventHandlers: { Transfer: onTransfer },
    });
});

const logger = pino({
  transport: {
    target: "pino-pretty",
  },
  level: "debug",
});

const client = postgres("postgres://postgres:postgres@localhost:5432/postgres");

const db = drizzle(client, { schema });

const dbProvider = new PgDrizzleProvider({ db, logger });

const arkiver = new Arkiver({
  dbProvider,
  manifest: manifest.manifest,
  context: { db },
  logger,
  record: {
    deployment: {
      id: 1,
      stage: "local",
    },
    id: 1,
  },
});

arkiver.start();
