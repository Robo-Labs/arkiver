import { buildSchema } from "../db/build-schema";
import { arkiveMetadata } from "./arkive-metadata";
import { chainMetadata } from "./chain-metadata";
import { childSource } from "./child-source";

export const arkiveBaseSchema = buildSchema([
  arkiveMetadata,
  chainMetadata,
  childSource,
]);

export const { arkive_metadata, child_source, chain_metadata } =
  arkiveBaseSchema;
