import { maxUint256 } from "viem";
import { customType } from "drizzle-orm/pg-core";

export const bigintMax = (...args: bigint[]): bigint => {
  return args.reduce((acc, cur) => (acc > cur ? acc : cur), 0n);
};

export const bigintMin = (...args: bigint[]): bigint => {
  return args.reduce((acc, cur) => (acc < cur ? acc : cur), maxUint256);
};

export const bigint = customType<{ data: bigint; driverData: string }>({
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
