import { ArkiveTable, ArkiveTableSchema } from "./types";

export const defineTable = <
  TName extends string,
  TArkiveTableSchema extends ArkiveTableSchema
>(
  name: TName,
  schema: TArkiveTableSchema
): ArkiveTable<TName, TArkiveTableSchema> => {
  return {
    _: {
      schema,
      name,
    },
    ...Object.keys(schema).reduce((acc, key) => {
      acc[key] = `${name}.${key}` as `${TName}.${string}`;
      return acc;
    }, {} as any),
  } as any;
};
