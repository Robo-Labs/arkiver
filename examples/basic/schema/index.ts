import { buildSchema, createTable } from "arkiver";

const balance = createTable("balance", {
  id: "string",
  address: "string",
  token: "string",
  amount: "number",
});

export const schema = buildSchema([
	balance
])