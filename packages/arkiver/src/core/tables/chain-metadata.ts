import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'
import { customBigIntText } from './custom-bigint-type'

export const chainMetadata = sqliteTable("chain_metadata", {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	chain: text('chain').notNull(),
	highestProcessedBlock: customBigIntText('highest_processed_block').notNull(),
	highestFetchedBlock: customBigIntText('highest_fetched_block').notNull(),
	totalLogsFetched: integer('total_logs_fetched', { mode: 'number' }).notNull(),
	totalLogsProcessed: integer('total_logs_processed', { mode: 'number' }).notNull(),
	totalBlocksFetched: integer('total_blocks_fetched', { mode: 'number' }).notNull(),
	totalBlocksProcessed: integer('total_blocks_processed', { mode: 'number' }).notNull(),
})