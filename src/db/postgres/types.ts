import {
	PgArrayBuilder,
	PgBooleanBuilderInitial,
	PgCustomColumnBuilder,
	PgDoublePrecisionBuilderInitial,
	PgIntegerBuilder,
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
import { PickByValue } from "../../utils/types";
import { Scalar, Ref, ApplyModifiers, ArkiveSchema, BackRef, CheckArray, CheckId, CheckNull } from "../schema/types";

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
	: TScalar extends ApplyModifiers<"id">
	? NotNull<PgSerialBuilderInitial<TName>>
	: TScalar extends Ref
	? ApplyChecks<TScalar, RefColumnBuilder<TName, TScalar>>
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

export type ApplyChecks<
	TScalar extends string,
	TColumn extends ColumnBuilderBase
> = CheckId<TScalar> extends true
	? NotNullifyColumn<TColumn>
	: CheckArray<TScalar> extends true
	? ArrayifyColumn<TColumn>
	: CheckNull<TScalar> extends false
	? NotNullifyColumn<TColumn>
	: TColumn;

export type StringColumnBuilder<TName extends string> = PgTextBuilder<{
	name: TName;
	dataType: "string";
	columnType: "PgText";
	data: string;
	enumValues: [string, ...string[]];
	driverParam: string;
}>;

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

export type RefColumnBuilder<
	TName extends string,
	TRef extends Ref
> = TRef extends `${string}:${infer type}`
	? type extends `string${string}`
	? StringColumnBuilder<TName>
	: PgIntegerBuilder<{
		name: `${TName}Id`;
		dataType: "number";
		columnType: "PgInteger";
		data: number;
		driverParam: number | string;
		enumValues: undefined;
	}>
	: never;

// -- Tables --

export type Referral =
	| { referred: string; type: "one" }
	| { referred: string; type: "many" };

export type ArkivePgTable<
	TName extends string = string,
	TArkiveSchema extends ArkiveSchema = ArkiveSchema
> = {
	schema: TArkiveSchema;
	name: TName;
	relations: Record<string, Referral>
	ref: `${TName}:${TArkiveSchema["id"] extends string
	? TArkiveSchema["id"]
	: "id"}`;
	table: ArkiveSchemaToDrizzleTable<TName, TArkiveSchema>;
	insertType: ArkiveSchemaToDrizzleTable<
		TName,
		TArkiveSchema
	>["$inferInsert"];
	selectType: ArkiveSchemaToDrizzleTable<
		TName,
		TArkiveSchema
	>["$inferSelect"];
};

export type ArkivePgTableWithRefs<TArkivePgTableUnion extends ArkivePgTable> =
	Exclude<TArkivePgTableUnion, { _: { schema: Record<string, Scalar> } }>;

export type ArkiveSchemaToDrizzleTable<
	TName extends string,
	TArkiveSchema extends ArkiveSchema
> =
	| PgTableWithColumns<{
		name: TName;
		dialect: "pg";
		schema: undefined;
		columns: BuildColumns<
			TName,
			ArkiveScalarColumnsToDrizzleColumns<
				PickByValue<
					RemapArkiveSchemaKeys<
						TArkiveSchema &
						(TArkiveSchema["id"] extends "string"
							? TArkiveSchema
							: { id: "id" })
					>,
					Scalar | Ref | "id"
				>
			>,
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

export type ArkivePgTableToDrizzleRelations<TArkivePgTable extends ArkivePgTable> =
	TArkivePgTable extends ArkivePgTable<infer TName, infer TArkivePgTableSchema>
	?
	| Relations<
		TName,
		ArkiveRefColumnsToDrizzleDetailedRelations<
			PickByValue<TArkivePgTableSchema, Ref | BackRef>
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

export type RemapArkiveSchemaKeys<TArkiveSchema extends ArkiveSchema> = {
	[Key in Extract<keyof TArkiveSchema, string> as TArkiveSchema[Key] extends Ref
	? `${Key}Id`
	: Key]: TArkiveSchema[Key];
};
