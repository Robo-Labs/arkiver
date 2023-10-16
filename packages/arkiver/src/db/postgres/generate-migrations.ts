import path from "node:path";
import fs from "node:fs";

export const generateMigrations = ({
  manifestPath,
	migrationsDir
}: {
  manifestPath: string;
	migrationsDir: string;
}) => {
  const bunxExe = Bun.which("bunx");

  if (!bunxExe) {
    throw new Error("bun is not installed.");
  }
	
  const cwd = process.cwd();

  const content = `const manifest = require("${manifestPath}").default; module.exports = { ...manifest.manifest.schema };`;

  const reExportFilePath = path.join(cwd, "__schema.ts");

  fs.writeFileSync(reExportFilePath, content);

  Bun.spawnSync(
    [
      bunxExe,
			"--bun",
      "drizzle-kit",
      "generate:pg",
      "--schema",
      reExportFilePath,
      "--out",
      migrationsDir,
    ],
    {
      cwd,
			stdio: ['inherit', 'inherit', 'inherit']
    }
  );

	fs.rmSync(reExportFilePath)
};
