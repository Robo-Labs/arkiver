import { Abi, AbiEvent } from "abitype";
import { getAbiItem } from "viem";

export const getAbiEvents = (abi: Abi, eventNames: string[]) => {
  return eventNames.map((eventName) => {
    const abiEvent = getAbiItem({
      abi,
      name: eventName,
    }) as AbiEvent;
    if (!abiEvent) {
      throw new Error(`Event ${eventName} not found in ABI`);
    }
    return abiEvent;
  });
};
