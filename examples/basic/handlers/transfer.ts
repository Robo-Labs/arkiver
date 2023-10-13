import { eventHandler } from "arkiver";
import { schema } from "../schema";
import { ERC20_ABI } from "../abis/erc20";
import { sql } from "drizzle-orm";
import { formatUnits } from "viem";

export const onTransfer = eventHandler(
  {
    abi: ERC20_ABI,
    eventName: "Transfer",
    schema,
  },
  async ({ event, db, contract, logger, store }) => {
    logger.info(
      `Transfer: ${event.args.from} -> ${event.args.to} ${event.args.value}`
    );

    const { from, to, value } = event.args;

    const address = event.address;

    const decimals = await store.retrieve(
      `decimals-${address}`,
      contract.read.decimals
    );

    const parsedValue = parseFloat(formatUnits(value, decimals));

    await Promise.all([
      db
        .insert(schema.balance)
        .values({
          id: `${from}-${address}`,
          address: from,
          token: address,
          amount: -parsedValue,
        })
        .onConflictDoUpdate({
          target: [schema.balance.id],
          set: { amount: sql`${schema.balance.amount} - ${parsedValue}` },
        }),
      db
        .insert(schema.balance)
        .values({
          id: `${to}-${address}`,
          address: to,
          token: address,
          amount: parsedValue,
        })
        .onConflictDoUpdate({
          target: [schema.balance.id],
          set: { amount: sql`${schema.balance.amount} + ${parsedValue}` },
        }),
    ]);
  }
);
