import {
  PgColumnBuilderBase,
  boolean,
  integer,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import {
  ArkiveColumns,
  ArkiveTable,
  ArkiveTableToDrizzleRelations,
  ArkiveTableToDrizzleTable,
  ArkiveTableWithRefs,
} from "./types";

export const buildSchema = <
  TTables extends ArkiveTable<string, Record<string, ArkiveColumns>>
>(
  tables: TTables[]
): BuildSchema<TTables> => {
  const schema = {} as BuildSchema<TTables>;

  for (const table of tables) {
    const columns: Record<string, PgColumnBuilderBase> = {
      id: integer("id").primaryKey(),
    };
    const relations: Record<string, { one: string } | { many: string }> = {};

    for (const [key, value] of Object.entries(table._.schema)) {
      if (typeof value !== "string") {
        throw new Error("Table values must be strings");
      }

      let column: PgColumnBuilderBase | undefined;
      let newKey = key;
      let relation: { many: string } | { one: string } | undefined;

      switch (true) {
        case /^\[\]@/.test(value): {
          // don't add a column for backrefs
          relation = {
            many: value.replace(/^\[\]@/, ""),
          };
          break;
        }
        case /string/.test(value): {
          column = text(key);
        }
        case /number/.test(value): {
          column = real(key);
        }
        case /bigint/.test(value): {
          // 256 bit integer
          column = numeric(key, { precision: 77, scale: 0 });
        }
        case /boolean/.test(value): {
          column = boolean(key);
        }
        case /date/.test(value): {
          column = timestamp(key);
        }
        case /^@/.test(value): {
          relation = {
            one: value.replace(/^@/, "").replace(/\?$/, ""),
          };
          column = integer(key);
          newKey = `${key}Id`;
        }
        case /\[\]$/.test(value) && !!column: {
          column = (column as any).array();
        }
        case !/\?$/.test(value) && !!column: {
          column = (column as any).notNull();
        }
      }

      if (column) columns[newKey] = column;
      if (relation) relations[newKey] = relation;
    }

    (schema as any)[table._.name] = pgTable(table._.name, columns);
  }

  return schema;
};

type BuildSchema<
  TArkiveTablesUnion extends ArkiveTable<string, Record<string, any>>
> =
  | ({
      [ArkiveTable in TArkiveTablesUnion as ArkiveTable["_"]["name"]]: ArkiveTableToDrizzleTable<ArkiveTable>;
    } & {
      [ArkiveTable in ArkiveTableWithRefs<TArkiveTablesUnion> as `${ArkiveTable["_"]["name"]}Relations`]: ArkiveTableToDrizzleRelations<ArkiveTable>;
    })
  | never;
