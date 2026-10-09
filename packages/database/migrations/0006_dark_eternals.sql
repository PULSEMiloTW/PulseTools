CREATE TABLE "r2_guild_settings" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "r2_guild_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "r2_upload_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"status" text NOT NULL,
	"code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "r2_upload_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "r2_upload_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"attachments" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"choice" text,
	"prompt_id" text,
	"result_id" text,
	"actor_id" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "r2_request_status" CHECK ("r2_upload_requests"."status" in ('Pending','Uploading','Uploaded','Completed','Cancelled','Expired','Failed','PartiallyCompleted'))
);
--> statement-breakpoint
ALTER TABLE "r2_upload_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "r2_uploaded_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"attachment_id" text NOT NULL,
	"filename" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "r2_uploaded_objects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "r2_request_guild_id" ON "r2_upload_requests" USING btree ("guild_id","id");--> statement-breakpoint
ALTER TABLE "r2_guild_settings" ADD CONSTRAINT "r2_guild_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_upload_events" ADD CONSTRAINT "r2_upload_events_guild_id_request_id_r2_upload_requests_guild_id_id_fk" FOREIGN KEY ("guild_id","request_id") REFERENCES "public"."r2_upload_requests"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_upload_requests" ADD CONSTRAINT "r2_upload_requests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_uploaded_objects" ADD CONSTRAINT "r2_uploaded_objects_guild_id_request_id_r2_upload_requests_guild_id_id_fk" FOREIGN KEY ("guild_id","request_id") REFERENCES "public"."r2_upload_requests"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "r2_event_time" ON "r2_upload_events" USING btree ("guild_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "r2_request_message" ON "r2_upload_requests" USING btree ("guild_id","message_id");--> statement-breakpoint
CREATE INDEX "r2_request_time" ON "r2_upload_requests" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "r2_object_attachment" ON "r2_uploaded_objects" USING btree ("guild_id","request_id","attachment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "r2_object_key" ON "r2_uploaded_objects" USING btree ("object_key");