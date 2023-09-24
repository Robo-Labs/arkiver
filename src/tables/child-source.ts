import { createTable } from "../db/create-table";

export const childSource = createTable("child_source", {
  address: "string",
  contract: "string",
  chain: "string",
  startBlockHeight: "bigint",
});
