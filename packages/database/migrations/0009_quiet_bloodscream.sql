CREATE TABLE "r2_upload_users" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "r2_upload_users_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "r2_upload_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "r2_upload_users" ADD CONSTRAINT "r2_upload_users_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;