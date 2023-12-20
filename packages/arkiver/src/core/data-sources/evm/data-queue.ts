import { AbiEvent } from "abitype";
import { Mutex } from "async-mutex";
import EventEmitter from "eventemitter3";
import { Logger } from "pino";
import { GetBlockReturnType, GetLogsReturnType } from "viem";

export type Data = {
  logs: GetLogsReturnType<undefined, AbiEvent[], true, bigint, bigint>;
  startBlock: bigint;
  endBlock: bigint;
};

export type BoundedData = {
	startBlock: bigint;
  endBlock: bigint;
  data: Data;
};

export class EvmDataQueue extends EventEmitter {
  #buffer: Map<bigint, BoundedData> = new Map();
  #logger?: Logger;
  #flushLock: Mutex = new Mutex();
  #blockCursor: bigint;

  constructor({ logger, startBlock }: { logger?: Logger; startBlock: bigint }) {
    super();
    this.#logger = logger;
    this.#blockCursor = startBlock;
  }

  push({ logs, endBlock, startBlock }: Data) {
    this.#buffer.set(startBlock, {
			startBlock,
      endBlock,
      data: {
        logs,
        startBlock,
        endBlock,
      },
    });
    this.#flush();
  }

  async #flush() {
    // make sure only one flush is running at a time
    await this.#flushLock.runExclusive(async () => {
      let buffered = this.#buffer.get(this.#blockCursor);

      while (buffered !== undefined) {
        this.#logger?.debug({
          event: "evmDataQueue.flush",
          context: {
            startBlock: this.#blockCursor,
            endBlock: buffered.endBlock,
          },
        });
        this.emit("data", buffered);
        this.#buffer.delete(this.#blockCursor);
        this.#blockCursor = buffered.endBlock + 1n;
        buffered = this.#buffer.get(this.#blockCursor);
      }
    });
  }

  initializeBlock(startBlock: bigint) {
    this.#blockCursor = startBlock;
  }
}
