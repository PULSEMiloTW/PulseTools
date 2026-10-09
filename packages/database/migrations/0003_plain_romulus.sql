CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"module_id" text NOT NULL,
	"event_key" text NOT NULL,
	"channel_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_at" timestamp with time zone,
	"sent_message_id" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_status" CHECK ("notification_outbox"."status" in ('Pending','Sending','Sent','Failed','Cancelled'))
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "server_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"channel_id" text,
	"event_type" text NOT NULL,
	"event_key" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timestamp_source" text NOT NULL,
	"attribution" text DEFAULT '無法確認' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_events" ADD CONSTRAINT "server_events_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deduplication" ON "notification_outbox" USING btree ("guild_id","module_id","event_key");--> statement-breakpoint
CREATE INDEX "notification_pending" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "server_event_deduplication" ON "server_events" USING btree ("guild_id","event_key");--> statement-breakpoint
CREATE INDEX "server_event_time" ON "server_events" USING btree ("guild_id","event_at");--> statement-breakpoint
CREATE INDEX "server_event_expiry" ON "server_events" USING btree ("expires_at");