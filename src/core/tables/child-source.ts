import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'
import { customBigIntText } from './custom-bigint-type'

export const childSource = sqliteTable("child_source", {
	id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
	address: text('address').notNull(),
	contract: text('contract').notNull(),
	chain: text('chain').notNull(),
	startBlockHeight: customBigIntText('start_block_height').notNull(),
})