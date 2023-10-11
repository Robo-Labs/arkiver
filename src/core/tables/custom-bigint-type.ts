import { customType } from "drizzle-orm/sqlite-core"

export const customBigIntText = customType<{ data: bigint; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value: bigint) {
    return value.toString();
  },
  fromDriver(value: string) {
    return BigInt(value);
  },
});