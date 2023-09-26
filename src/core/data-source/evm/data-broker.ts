import { AbiEvent } from "abitype";
import { GetBlockReturnType, GetLogsReturnType } from "viem";

export class EvmDataBroker {
  sendData({
    logs,
    blocks,
    endBlock,
    startBlock,
  }: {
    logs: GetLogsReturnType<undefined, AbiEvent[], true, bigint, bigint>;
    blocks: GetBlockReturnType[];
    startBlock: bigint;
    endBlock: bigint;
  }) {}
}
