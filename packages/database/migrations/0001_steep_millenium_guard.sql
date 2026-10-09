CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"author_id" text,
	"event_type" text NOT NULL,
	"event_key" text NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timestamp_source" text NOT NULL,
	"capture_status" text NOT NULL,
	"actor_id" text,
	"attribution" text DEFAULT '無法確認' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_snapshots" (
	"guild_id" text NOT NULL,
	"message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text,
	"original_content" text,
	"latest_content" text,
	"capture_status" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_snapshots_guild_id_message_id_pk" PRIMARY KEY("guild_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "message_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"message_id" text NOT NULL,
	"revision" integer NOT NULL,
	"content" text,
	"capture_status" text NOT NULL,
	"event_type" text NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_snapshots" ADD CONSTRAINT "message_snapshots_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_versions" ADD CONSTRAINT "message_versions_guild_id_message_id_message_snapshots_guild_id_message_id_fk" FOREIGN KEY ("guild_id","message_id") REFERENCES "public"."message_snapshots"("guild_id","message_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audit_event_deduplication" ON "audit_events" USING btree ("guild_id","event_key");--> statement-breakpoint
CREATE INDEX "audit_guild_time" ON "audit_events" USING btree ("guild_id","event_at");--> statement-breakpoint
CREATE INDEX "audit_expiry" ON "audit_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "snapshot_expiry" ON "message_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_revision" ON "message_versions" USING btree ("guild_id","message_id","revision");--> statement-breakpoint
CREATE INDEX "version_expiry" ON "message_versions" USING btree ("expires_at");