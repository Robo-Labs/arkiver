import { eventHandler } from "arkiver";
import { schema } from "../schema";
import { ERC20_ABI } from "../abis/erc20";
import { sql } from "drizzle-orm";
import { formatUnits } from "viem";

const decimalsCache: Record<string, Promise<number>> = {};

export const onTransfer = eventHandler(
  {
    abi: ERC20_ABI,
    eventName: "Transfer",
    schema,
    batchProcess: true,
  },
  async ({ events, db, logger, client }) => {
    logger.info(`Processing ${events.length} Transfer events`);

    const accounts = events.reduce((acc, event) => {
      const { from, to, value } = event.args;

      const address = event.address;

      const fromAccount = acc[from] ?? {};
      const toAccount = acc[to] ?? {};

      const fromBalance = fromAccount[address] ?? 0n;
      const toBalance = toAccount[address] ?? 0n;

      fromAccount[address] = fromBalance - value;
      toAccount[address] = toBalance + value;

      acc[from] = fromAccount;
      acc[to] = toAccount;

      return acc;
    }, {} as Record<string, Record<string, bigint>>);

    const formattedAccounts = await Promise.all(
      Object.entries(accounts).flatMap(([address, account]) =>
        Object.entries(account).map(async ([token, amount]) => {
          const decimals = await (decimalsCache[token] ??= client.readContract({
            abi: ERC20_ABI,
            address: token as `0x${string}`,
            functionName: "decimals",
          }));

          const parsedAmount = parseFloat(formatUnits(amount, decimals));

          return {
            id: `${address}-${token}`,
            address,
            token,
            amount: parsedAmount,
          };
        })
      )
    );

    await db
      .insert(schema.balance)
      .values(formattedAccounts)
      .onConflictDoUpdate({
        target: [schema.balance.id],
        set: {
          amount: sql`${schema.balance.amount} + excluded.amount`,
        },
      });
  }
);
