import {
  ArkiveColumns,
  ArkiveTable,
  ArkiveTableToDrizzleRelations,
  ArkiveTableWithRefs,
  Referral,
} from "./types";
import { Many, One, relations as drizzleRelations } from "drizzle-orm";

export const buildSchema = <
  TTables extends ArkiveTable<string, Record<string, ArkiveColumns>>
>(
  tables: TTables[]
): BuildSchema<TTables> => {
  const schema: Record<string, any> = {};
  const tablesRelations: Record<string, Record<string, Referral>> = {};

  for (const table of tables) {
    schema[table._.name] = table.table;
    if (table._.relations) tablesRelations[table._.name] = table._.relations;
  }

  for (const [tableName, tableRelations] of Object.entries(tablesRelations)) {
    const referringTable = schema[tableName];
    if (!referringTable) {
      throw new Error(`Table ${tableName} not found`);
    }

    const relations = drizzleRelations(referringTable, ({ one, many }) => {
      return Object.entries(tableRelations).reduce(
        (acc, [refName, { referred, type }]) => {
          if (type === "one") {
            acc[refName] = one(schema[referred], {
              fields: [referringTable[`${refName}Id`]],
              references: [schema[referred].id],
            });
          } else {
            acc[refName] = many(schema[referred]);
          }
          return acc;
        },
        {} as Record<string, Many<string> | One>
      );
    });

    schema[`${tableName}_relations`] = relations;
  }

  return schema as any;
};

type BuildSchema<
  TArkiveTablesUnion extends ArkiveTable<string, Record<string, any>>
> =
  | ({
      [ArkiveTable in TArkiveTablesUnion as ArkiveTable["_"]["name"]]: ArkiveTable["table"];
    } & {
      [ArkiveTable in ArkiveTableWithRefs<TArkiveTablesUnion> as `${ArkiveTable["_"]["name"]}_relations`]: ArkiveTableToDrizzleRelations<ArkiveTable>;
    })
  | never;
