CREATE TABLE "error_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text,
	"scope" text NOT NULL,
	"module_id" text NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"summary" text NOT NULL,
	"window_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	CONSTRAINT "error_status" CHECK ("error_records"."status" in ('Open','Acknowledged'))
);
--> statement-breakpoint
ALTER TABLE "error_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"metrics" jsonb NOT NULL,
	"sampled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health_samples" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "error_records" ADD CONSTRAINT "error_records_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_samples" ADD CONSTRAINT "health_samples_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "error_aggregation" ON "error_records" USING btree ("scope","module_id","type","code","window_at");--> statement-breakpoint
CREATE INDEX "error_guild_time" ON "error_records" USING btree ("guild_id","last_occurred_at");--> statement-breakpoint
CREATE INDEX "health_guild_time" ON "health_samples" USING btree ("guild_id","sampled_at");--> statement-breakpoint
CREATE INDEX "health_expiry" ON "health_samples" USING btree ("expires_at");