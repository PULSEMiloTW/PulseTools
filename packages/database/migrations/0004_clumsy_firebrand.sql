CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"request_id" text NOT NULL,
	"target_id" text NOT NULL,
	"moderator_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"related_case_id" uuid,
	"channel_id" text,
	"duration_minutes" integer,
	"requested_count" integer,
	"affected_count" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_status" CHECK ("moderation_cases"."status" in ('Pending','Succeeded','Failed','Unknown')),
	CONSTRAINT "case_action" CHECK ("moderation_cases"."action" in ('warn','timeout','untimeout','kick','ban','unban','purge'))
);
--> statement-breakpoint
ALTER TABLE "moderation_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "moderation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "moderation_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "case_guild_id" ON "moderation_cases" USING btree ("guild_id","id");--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guild_id_related_case_id_moderation_cases_guild_id_id_fk" FOREIGN KEY ("guild_id","related_case_id") REFERENCES "public"."moderation_cases"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_notes" ADD CONSTRAINT "moderation_notes_guild_id_case_id_moderation_cases_guild_id_id_fk" FOREIGN KEY ("guild_id","case_id") REFERENCES "public"."moderation_cases"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_request" ON "moderation_cases" USING btree ("guild_id","request_id");--> statement-breakpoint
CREATE INDEX "case_target_time" ON "moderation_cases" USING btree ("guild_id","target_id","created_at");
