import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EventHandler } from "../../src/types";
import { ERC20_ABI } from "./erc20";
import { balance, schema } from "./schema";
import { formatUnits } from "viem";
import { sql } from "drizzle-orm";

export const onTransfer: EventHandler<
  typeof ERC20_ABI,
  "Transfer",
  { db: PostgresJsDatabase<typeof schema> }
> = async ({ event, contract, logger, db, store }) => {
  const { from, to, value } = event.args;

  const address = event.address;

  const decimals = await store.retrieve(
    `decimals-${address}`,
    contract.read.decimals
  );

  const parsedValue = parseFloat(formatUnits(value, decimals));

  await Promise.all([
    db
      .insert(balance)
      .values({
        address: from,
        token: address,
        amount: -parsedValue,
      })
      .onConflictDoUpdate({
        target: [balance.address, balance.token],
        set: { amount: sql`${balance.amount} - ${parsedValue}` },
      }),
    db
      .insert(balance)
      .values({
        address: to,
        token: address,
        amount: parsedValue,
      })
      .onConflictDoUpdate({
        target: [balance.address, balance.token],
        set: { amount: sql`${balance.amount} + ${parsedValue}` },
      }),
  ]);
};
