CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "client_message_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_client_id_idx" ON "chat_messages" USING btree ("session_id","role","client_message_id") WHERE "chat_messages"."client_message_id" is not null;