import {
  ArkivePgTable,
  ArkivePgTableToDrizzleRelations,
  ArkivePgTableWithRefs,
  Referral,
} from "./types";
import { Many, One, relations as drizzleRelations } from "drizzle-orm";

export const buildSchema = <TTables extends ArkivePgTable<any, any>>(
  tables: TTables[]
): BuildSchema<TTables> => {
  const schema: Record<string, any> = {};
  const tablesRelations: Record<string, Record<string, Referral>> = {};

  for (const table of tables) {
    schema[table.name] = table.table;
    if (table.relations) tablesRelations[table.name] = table.relations;
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
  TArkivePgTablesUnion extends ArkivePgTable<string, Record<string, any>>
> =
  | ({
      [ArkivePgTable in TArkivePgTablesUnion as ArkivePgTable["name"]]: ArkivePgTable["table"];
    } & {
      [ArkivePgTable in ArkivePgTableWithRefs<TArkivePgTablesUnion> as `${ArkivePgTable["name"]}_relations`]: ArkivePgTableToDrizzleRelations<ArkivePgTable>;
    })
  | never;
