CREATE TABLE "configuration_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"authorized" boolean DEFAULT false NOT NULL,
	"configuration" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_states" (
	"guild_id" text NOT NULL,
	"module_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"health" text DEFAULT 'Disabled' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_states_guild_id_module_id_pk" PRIMARY KEY("guild_id","module_id"),
	CONSTRAINT "module_health" CHECK ("module_states"."health" in ('Running', 'Disabled', 'Degraded', 'Error', 'Unavailable'))
);
--> statement-breakpoint
CREATE TABLE "guild_administrators" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_administrators_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id"),
	CONSTRAINT "operator_role" CHECK ("guild_administrators"."role" in ('admin', 'moderator'))
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timestamp_source" text DEFAULT 'received' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuration_history" ADD CONSTRAINT "configuration_history_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_states" ADD CONSTRAINT "module_states_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_administrators" ADD CONSTRAINT "guild_administrators_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;