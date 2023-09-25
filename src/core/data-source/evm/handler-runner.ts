import { EvmDataBroker } from "./data-broker";

export interface EvmHandlerRunnerParams {
  dataBroker: EvmDataBroker;
}

export class EvmHandlerRunner {
  #dataBroker: EvmDataBroker;

  constructor({ dataBroker }: EvmHandlerRunnerParams) {
    this.#dataBroker = dataBroker;
  }

  async start() {}
}
