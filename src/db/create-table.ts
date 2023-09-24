import {
  PgColumnBuilderBase,
  boolean,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { ArkiveTable, ArkiveTableSchema, Referral } from "./types";
import { customNumeric } from "./custom-types";

export const createTable = <
  TName extends string,
  TArkiveTableSchema extends ArkiveTableSchema
>(
  name: TName,
  schema: TArkiveTableSchema
): ArkiveTable<TName, TArkiveTableSchema> => {
  const columns: Record<string, PgColumnBuilderBase> = {
    id: serial("id").primaryKey(),
  };
  // field name -> relation (one or many -> referenced table name)
  const relations: Record<string, Referral> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (typeof value !== "string") {
      throw new Error("Table values must be strings");
    }

    let column: PgColumnBuilderBase | undefined;
    let newKey = key;
    let relation: Referral | undefined;

    switch (true) {
      case /^\[\]@/.test(value): {
        // don't add a column for backrefs
        relation = {
          referred: value.replace(/^\[\]@/, ""),
          type: "many",
        };
        break;
      }
      case /^@/.test(value): {
        relation = {
          referred: value.replace(/^@/, "").replace(/\?$/, ""),
          type: "one",
        };
        newKey = `${key}Id`;
        column = integer(newKey);
        break;
      }
      case /string/.test(value): {
        column = text(key);
        break;
      }
      case /number/.test(value): {
        column = real(key);
        break;
      }
      case /bigint/.test(value): {
        // 256 bit integer
        column = customNumeric(key);
        break;
      }
      case /boolean/.test(value): {
        column = boolean(key);
        break;
      }
      case /date/.test(value): {
        column = timestamp(key);
        break;
      }
    }

    if (column) {
      if (/\[\]$/.test(value)) {
        column = (column as any).array();
      }
      if (!/\?$/.test(value)) {
        column = (column as any).notNull();
      }

      columns[newKey] = column!;
    }
    if (relation) relations[key] = relation;
  }

  return {
    _: {
      schema,
      name,
      relations,
    },
    table: pgTable(name, columns) as any,
    insertType: undefined as any,
    selectType: undefined as any,
  };
};
