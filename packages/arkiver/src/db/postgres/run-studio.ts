import path from "path";
import fs from "fs";

export const runStudio = async ({
	schemaPath,
	connectionString,
	bunxExe
}: {
	schemaPath: string
	connectionString: string
	bunxExe: string
}) => {
	const tempConfig = `export default {
	schema: "${schemaPath}",
	driver: "pg",
	dbCredentials: {
		connectionString: "${connectionString}"
	}
}
`;

	const tempConfigPath = path.join(process.cwd(), "__config.ts");

	fs.writeFileSync(tempConfigPath, tempConfig);

	Bun.spawn([
		bunxExe,
		"--bun",
		"drizzle-kit",
		"studio",
		"--config",
		tempConfigPath
	], {
		cwd: process.cwd(),
		stderr: 'inherit',
		stdout: 'inherit'
	})

	await Bun.sleep(2000)

	fs.rmSync(tempConfigPath)
}