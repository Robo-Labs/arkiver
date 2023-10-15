import { maxUint256 } from "viem";

export const bigintMax = (...args: bigint[]): bigint => {
  return args.reduce((acc, cur) => (acc > cur ? acc : cur), 0n);
};

export const bigintMin = (...args: bigint[]): bigint => {
  return args.reduce((acc, cur) => (acc < cur ? acc : cur), maxUint256);
};
