import pino from "pino";
import path from "node:path";

const transport = pino.transport({
  target: path.join(import.meta.dir, "./terminal.ts"),
});

transport.on("exit", () => {
  process.exit(0);
});

const logger = pino(transport);

logger.info("hello world");

let counter = 0;

setInterval(() => {
  logger.info("hello world" + counter++);
}, 1000);
