import blessed from "blessed";
import contrib from "blessed-contrib";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { arkiveMetadata } from "../core/tables/arkive-metadata";
import { chainMetadata } from "../core/tables/chain-metadata";
import { childSource } from "../core/tables/child-source";
import { prettyFactory } from "pino-pretty";
import build from "pino-abstract-transport";

declare const self: Worker;

const pretty = prettyFactory({
  colorize: true,
  translateTime: true,
  ignore: "pid,hostname",
});

export default async function () {
  return build(async function (source) {
    for await (const log of source) {
      logEle.log(pretty(log));
    }
  });
}

const screen = blessed.screen({
  smartCSR: true,
  title: "Arkiver",
});

const grid = new contrib.grid({ rows: 12, cols: 12, screen });

const logEle: contrib.Widgets.LogElement = grid.set(0, 0, 12, 12, contrib.log, {
  fg: "green",
  selectedFg: "green",
  label: "Logs",
} satisfies contrib.Widgets.LineOptions);

screen.key(["escape", "q", "C-c"], function (ch, key) {
  self.postMessage({ code: "EVENT", name: "exit", args: [] });
});

screen.render();
