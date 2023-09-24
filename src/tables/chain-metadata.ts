import { createTable } from "../db/create-table";

export const chainMetadata = createTable("chain_metadata", {
  chain: "string",
  highestProcessedBlock: "bigint",
  highestFetchedBlock: "bigint",
  totalLogsFetched: "number",
  totalLogsProcessed: "number",
  totalBlocksFetched: "number",
  totalBlocksProcessed: "number",
  totalErrors: "number",
});
