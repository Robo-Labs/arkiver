import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const table1 = pgTable("table1", {
  id: serial("id").primaryKey(),
  table1Id: integer("table1_id").notNull(),
});

const table1Rrelations = relations(table1, ({ one, many }) => ({
  table2: many(table2),
  table2First: one(table2),
}));

const table2 = pgTable("table2", {
  id: serial("id").primaryKey(),
  table1Id: integer("table1_id").notNull(),
  arrayTest: text("array_test").array().notNull(),
});

const table2relations = relations(table2, ({ one }) => ({
  table1: one(table1, {
    fields: [table2.table1Id],
    references: [table1.id],
  }),
}));

const client = postgres();

const db = drizzle(client, { schema: { table1, table2, table2relations } });

const res = await db.query.table2.findFirst({ with: { table1: true } });
