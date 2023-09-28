import { AbiEvent } from "abitype";
import { Mutex } from "async-mutex";
import EventEmitter from "eventemitter3";
import { Logger } from "pino";
import { GetBlockReturnType, GetLogsReturnType } from "viem";

export type Data = {
  logs: GetLogsReturnType<undefined, AbiEvent[], true, bigint, bigint>;
  blocks: GetBlockReturnType[];
  startBlock: bigint;
  endBlock: bigint;
};

export class EvmDataQueue extends EventEmitter {
  #buffer: Map<
    bigint,
    {
      endBlock: bigint;
      data: Data;
    }
  > = new Map();
  #logger?: Logger;
  #flushLock: Mutex = new Mutex();
  #blockCursor: bigint;

  constructor({ logger, startBlock }: { logger?: Logger; startBlock: bigint }) {
    super();
    this.#logger = logger;
    this.#blockCursor = startBlock;
  }

  push({ logs, blocks, endBlock, startBlock }: Data) {
    this.#buffer.set(startBlock, {
      endBlock,
      data: {
        logs,
        blocks,
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
        this.emit("data", buffered.data);
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
