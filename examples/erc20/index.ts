import { Arkive } from "arkiver";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";
import { mainnet } from "viem/chains";
import { sql } from "drizzle-orm";
import { erc20Abi } from "./abis/erc20";
import { formatUnits } from "viem";

const etherumRpcUrl = process.env["ETHEREUM_RPC_URL"];

const dbUrl = process.env["DATABASE_URL"];
if (!dbUrl) throw new Error("DATABASE_URL not set.");

const migrationDb = drizzle(postgres(dbUrl, { max: 1 }));
await migrate(migrationDb, { migrationsFolder: "./drizzle" });

const arkive = new Arkive()
  .store({
    db: drizzle(postgres(dbUrl), { schema }),
    balances: {} as Record<string, typeof schema.balances.$inferInsert>,
    tokenDecimals: {} as Record<string, number>,
  })
  .chain("ethereum", {
    blockRange: 100n,
    rpcUrls: [
      ...(etherumRpcUrl ? [etherumRpcUrl] : []),
      ...mainnet.rpcUrls.default.http,
    ],
  })
  .beforeHandle({
    chains: "all",
    hook: ({ store }) => {
      store.balances = {};
    },
  })
  .afterHandle({
    chains: "all",
    hook: async ({ store: { balances, db } }) => {
			if (Object.keys(balances).length === 0) return;
      await db
        .insert(schema.balances)
        .values(Object.values(balances))
        .onConflictDoUpdate({
          target: [schema.balances.id],
          set: {
            amount: sql`${schema.balances.amount} + excluded.amount`,
          },
        });
    },
  })
  .contract("erc20", {
    abi: erc20Abi,
    events: {
      Transfer: {
        handler: async ({
          event,
          store: { balances, tokenDecimals },
          contract,
        }) => {
          if (!tokenDecimals[event.address]) {
            tokenDecimals[event.address] = await contract.read.decimals();
          }

          const { from, to, value } = event.args;
          const decimals = tokenDecimals[event.address];
          const parsedValue = parseFloat(formatUnits(value, decimals));

          const fromId = `${from}-${event.address}`;
          if (!balances[fromId]) {
            balances[fromId] = {
              id: fromId,
              address: from,
              token: event.address,
              amount: 0,
            };
          }
          balances[fromId].amount -= parsedValue;

          const toId = `${to}-${event.address}`;
          if (!balances[toId]) {
            balances[toId] = {
              id: toId,
              address: to,
              token: event.address,
              amount: 0,
            };
          }
          balances[toId].amount += parsedValue;
        },
      },
    },
    sources: {
      ethereum: [
        {
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
          startBlock: 18814700n,
        },
      ],
    },
  });

await arkive.start();

console.log("🚀 Arkive started.");
