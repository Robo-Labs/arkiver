import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'

export const arkiveMetadata = sqliteTable("arkive_metadata", {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	arkiveId: text('arkive_id').notNull(),
	deploymentId: text('deployment_id').notNull(),
	deploymentStage: text('deployment_stage').notNull(),
})