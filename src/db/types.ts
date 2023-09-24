import {
  PgArrayBuilder,
  PgBooleanBuilderInitial,
  PgCustomColumnBuilder,
  PgDoublePrecisionBuilderInitial,
  PgIntegerBuilder,
  PgNumericBuilderInitial,
  PgSerialBuilderInitial,
  PgTableWithColumns,
  PgTextBuilder,
  PgTimestampBuilderInitial,
} from "drizzle-orm/pg-core";
import {
  BuildColumns,
  ColumnBuilderBase,
  Many,
  NotNull,
  One,
  Relations,
} from "drizzle-orm";
import { PickByValue } from "../utils/types";

// -- Columns --

export type Nullify<T extends string> = `${T}?`;
export type Arrayify<T extends string> = `${T}[]`;
export type ApplyModifiers<T extends string> = Nullify<T> | Arrayify<T> | T;

export type RefBase = `@${string}`;
export type Ref = Nullify<RefBase> | RefBase;

export type BackRef = `[]@${string}`;

export type ScalarBase = "string" | "number" | "boolean" | "bigint" | "date";
export type Scalar = Arrayify<ScalarBase> | Nullify<ScalarBase> | ScalarBase;

export type ArkiveColumns = Scalar | Ref | BackRef;

export type ArkiveTableSchema = Record<string, ArkiveColumns> & { id?: never };

export type ScalarToDrizzleColumn<
  TScalar extends Scalar | Ref,
  TName extends string
> = TScalar extends ApplyModifiers<"string">
  ? ApplyChecks<TScalar, StringColumnBuilder<TName>>
  : TScalar extends ApplyModifiers<"number">
  ? ApplyChecks<TScalar, NumberColumnBuilder<TName>>
  : TScalar extends ApplyModifiers<"boolean">
  ? ApplyChecks<TScalar, BooleanColumnBuilder<TName>>
  : TScalar extends ApplyModifiers<"bigint">
  ? ApplyChecks<TScalar, BigIntColumnBuilder<TName>>
  : TScalar extends ApplyModifiers<"date">
  ? ApplyChecks<TScalar, DateColumnBuilder<TName>>
  : TScalar extends Ref
  ? ApplyChecks<TScalar, RefColumnBuilder<TName>>
  : never;

export type NotNullifyColumn<TType extends ColumnBuilderBase> = NotNull<TType>;

export type ArrayifyColumn<TType extends ColumnBuilderBase> = PgArrayBuilder<
  {
    name: TType["_"]["name"];
    dataType: "array";
    columnType: "PgArray";
    data: TType["_"]["data"][];
    driverParam: TType["_"]["driverParam"][] | string;
    enumValues: TType["_"]["enumValues"];
    notNull: true;
  },
  NotNull<TType>["_"]
>;

export type CheckNull<TName extends string> = TName extends `${string}?`
  ? true
  : false;

export type CheckArray<TName extends string> = TName extends `${string}[]`
  ? true
  : false;

export type ApplyChecks<
  TScalar extends string,
  TColumn extends ColumnBuilderBase
> = CheckArray<TScalar> extends true
  ? ArrayifyColumn<TColumn>
  : CheckNull<TScalar> extends false
  ? NotNullifyColumn<TColumn>
  : TColumn;

export type StringColumnBuilder<TName extends string> =
  | PgTextBuilder<{
      name: TName;
      dataType: "string";
      columnType: "PgText";
      data: string;
      enumValues: [string, ...string[]];
      driverParam: string;
    }>
  | never;

export type NumberColumnBuilder<TName extends string> =
  PgDoublePrecisionBuilderInitial<TName>;

export type BooleanColumnBuilder<TName extends string> =
  PgBooleanBuilderInitial<TName>;

export type BigIntColumnBuilder<TName extends string> = PgCustomColumnBuilder<{
  name: TName;
  dataType: "custom";
  columnType: "PgCustomColumn";
  data: bigint;
  driverParam: string;
  enumValues: undefined;
}>;

export type DateColumnBuilder<TName extends string> =
  PgTimestampBuilderInitial<TName>;

export type RefColumnBuilder<TName extends string> = PgIntegerBuilder<{
  name: `${TName}Id`;
  dataType: "number";
  columnType: "PgInteger";
  data: number;
  driverParam: number | string;
  enumValues: undefined;
}>;

// -- Tables --

export type Referral =
  | { referred: string; type: "one" }
  | { referred: string; type: "many" };

export type ArkiveTable<
  TName extends string = string,
  TArkiveTableSchema extends ArkiveTableSchema = ArkiveTableSchema
> = {
  _: {
    schema: TArkiveTableSchema;
    name: TName;
    relations: Record<string, Referral>;
  };
  table: ArkiveSchemaToDrizzleTable<TName, TArkiveTableSchema>;
  insertType: ArkiveSchemaToDrizzleTable<
    TName,
    TArkiveTableSchema
  >["$inferInsert"];
  selectType: ArkiveSchemaToDrizzleTable<
    TName,
    TArkiveTableSchema
  >["$inferSelect"];
};

export type ArkiveTableWithRefs<TArkiveTableUnion extends ArkiveTable> =
  Exclude<TArkiveTableUnion, { _: { schema: Record<string, Scalar> } }>;

export type ArkiveSchemaToDrizzleTable<
  TName extends string,
  TArkiveSchema extends ArkiveTableSchema
> =
  | PgTableWithColumns<{
      name: TName;
      dialect: "pg";
      schema: undefined;
      columns: BuildColumns<
        TName,
        ArkiveScalarColumnsToDrizzleColumns<
          PickByValue<RemapArkiveSchemaKeys<TArkiveSchema>, Scalar | Ref>
        > & {
          id: NotNull<PgSerialBuilderInitial<"id">>;
        },
        "pg"
      >;
    }>
  | never;

export type ArkiveScalarColumnsToDrizzleColumns<
  TArkiveScalarColumns extends Record<string, Scalar | Ref>
> = {
  [Key in Extract<keyof TArkiveScalarColumns, string>]: ScalarToDrizzleColumn<
    TArkiveScalarColumns[Key],
    Key
  >;
};

// -- Relations --

export type ArkiveTableToDrizzleRelations<TArkiveTable extends ArkiveTable> =
  TArkiveTable extends ArkiveTable<infer TName, infer TArkiveTableSchema>
    ?
        | Relations<
            TName,
            ArkiveRefColumnsToDrizzleDetailedRelations<
              PickByValue<TArkiveTableSchema, Ref | BackRef>
            >
          >
        | never
    : never;

export type ArkiveRefColumnsToDrizzleDetailedRelations<
  TArkiveRefColumns extends Record<string, Ref | BackRef>
> =
  | {
      [Key in Extract<
        keyof TArkiveRefColumns,
        string
      >]: RefToDrizzleDetailedRelation<TArkiveRefColumns[Key]>;
    }
  | never;

export type RefToDrizzleDetailedRelation<TRef extends Ref | BackRef> =
  TRef extends `@${infer TName}?`
    ? One<TName, false>
    : TRef extends `@${infer TName}`
    ? One<TName, true>
    : TRef extends `[]@${infer TName}`
    ? Many<TName>
    : never;

export type RemapArkiveSchemaKeys<TArkiveSchema extends ArkiveTableSchema> = {
  [Key in Extract<keyof TArkiveSchema, string> as TArkiveSchema[Key] extends Ref
    ? `${Key}Id`
    : Key]: TArkiveSchema[Key];
};
