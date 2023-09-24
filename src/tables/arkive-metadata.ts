import { createTable } from "../db/create-table";

export const arkiveMetadata = createTable("arkive_metadata", {
  arkiveId: "string",
  deploymentId: "string",
  deploymentStage: "string",
});
