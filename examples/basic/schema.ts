import { buildSchema } from "../../src/db/build-schema";
import { createTable } from "../../src/db/create-table";
import { arkiveMetadata } from "../../src/tables/arkive-metadata";
import { chainMetadata } from "../../src/tables/chain-metadata";
import { childSource } from "../../src/tables/child-source";

export const _balance = createTable("balance", {
  id: "string",
  address: "string",
  token: "string",
  amount: "number",
});

export const schema = buildSchema([
  _balance,
  arkiveMetadata,
  chainMetadata,
  childSource,
]);

export const { arkive_metadata, balance, chain_metadata, child_source } =
  schema;
