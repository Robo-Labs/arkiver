import { Abi, AbiEventParameter, AbiType, ExtractAbiEvents } from "abitype";

export type MapAbiEventToArgsWithType<
  TAbi extends Abi,
  TType extends AbiType
> = {
  [TEvent in ExtractAbiEvents<TAbi> as TEvent["name"]]?: TEvent["inputs"][number] extends infer TEventInput extends AbiEventParameter
    ? TEventInput extends { type: TType }
      ? TEventInput["name"]
      : never
    : never;
};
