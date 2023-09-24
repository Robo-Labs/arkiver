import { customType } from "drizzle-orm/pg-core";

export const customNumeric = customType<{ data: bigint; driverData: string }>({
  dataType() {
    return "numeric(77)";
  },
  toDriver(value: bigint) {
    return value.toString();
  },
  fromDriver(value: string) {
    return BigInt(value);
  },
});
