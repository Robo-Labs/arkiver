import { copyFileSync } from "node:fs";

await Bun.build({
  entrypoints: ["../src/index.ts"],
  outdir: "../dist",
  target: "bun",
});

copyFileSync("../package.json", "../dist/package.json");
copyFileSync("../README.md", "../dist/README.md");
copyFileSync("../LICENSE", "../dist/LICENSE");
