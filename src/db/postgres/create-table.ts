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
import { ArkivePgTable, Referral } from "./types";
import { ArkiveSchema } from "../schema/types";
import { customNumeric } from "./custom-types";

export const createTable = <
	TName extends string,
	TArkiveSchema extends ArkiveSchema
>(
	name: TName,
	schema: TArkiveSchema
): ArkivePgTable<TName, TArkiveSchema> => {
	const columns: Record<string, PgColumnBuilderBase> = {};
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
				const [referred, type] = value
					.replace(/^@/, "")
					.replace(/\?$/, "")
					.split(":");
				relation = {
					referred: referred,
					type: "one",
				};
				newKey = `${key}Id`;
				if (type === "string") {
					column = text(newKey);
				} else {
					column = integer(newKey);
				}
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
			if (key === "id") {
				column = (column as any).primaryKey();
			}

			columns[newKey] = column!;
		}
		if (relation) relations[key] = relation;
	}

	if (!columns.id) columns.id = serial("id").primaryKey();

	return {
		schema,
		name,
		relations,
		ref: `${name}:${schema.id ?? "id"}` as any,
		table: pgTable(name, columns) as any,
		insertType: undefined as any,
		selectType: undefined as any,
	};
};
