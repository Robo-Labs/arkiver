CREATE TABLE IF NOT EXISTS "balances" (
	"id" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"token" text NOT NULL,
	"amount" real NOT NULL
);
