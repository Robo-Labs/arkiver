import { pgTable, real, text } from "drizzle-orm/pg-core";

export const balances = pgTable("balances", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  token: text("token").notNull(),
  amount: real("amount").notNull(),
});
