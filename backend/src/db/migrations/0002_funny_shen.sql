CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "credentials" DROP CONSTRAINT "credentials_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_provider_unique" ON "credentials" USING btree ("provider");--> statement-breakpoint
ALTER TABLE "credentials" DROP COLUMN "name";