import * as path from "node:path";
import { Database } from "bun:sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { arkiveMetadata } from "../core/tables/arkive-metadata";

export const dev = async () => {
  const coreMigrationsDir = path.join(
    path.dirname(Bun.resolveSync("arkiver", process.cwd())),
		'./core/tables/migrations'
  );

	console.log(coreMigrationsDir)

	const schema = {
		arkiveMetadata
	}

	const db = drizzle<typeof schema>(new Database("./test.sqlite"))

	migrate(db, { migrationsFolder: coreMigrationsDir })
// view tables
	db.insert(arkiveMetadata).values({
		arkiveId: '1',
		deploymentId: '1',
		deploymentStage: 'test',
	}).run()

	console.log(db.select().from(arkiveMetadata).all())
};
