export const generateMigrations = ({
	migrationsDir,
	bunxExe,
	schemaPath
}: {
	migrationsDir: string;
	bunxExe: string;
	schemaPath: string;
}) => {
  const cwd = process.cwd();

  Bun.spawnSync(
    [
      bunxExe,
			"--bun",
      "drizzle-kit",
      "generate:pg",
      "--schema",
      schemaPath,
      "--out",
      migrationsDir,
    ],
    {
      cwd,
			stdio: ['inherit', 'inherit', 'inherit']
    }
  );
};
