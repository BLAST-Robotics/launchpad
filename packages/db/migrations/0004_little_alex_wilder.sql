CREATE TABLE "core_value_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"roster_entry_id" uuid,
	"core_value" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"mime_type" text,
	"size_bytes" bigint,
	"duration_ms" integer,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_value_submissions_value_check" CHECK ("core_value_submissions"."core_value" in ('discovery','innovation','impact','inclusion','teamwork','fun')),
	CONSTRAINT "core_value_submissions_status_check" CHECK ("core_value_submissions"."status" in ('uploaded','approved','needs_redo'))
);
--> statement-breakpoint
ALTER TABLE "core_value_submissions" ADD CONSTRAINT "core_value_submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_value_submissions" ADD CONSTRAINT "core_value_submissions_roster_entry_id_roster_entries_id_fk" FOREIGN KEY ("roster_entry_id") REFERENCES "public"."roster_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_value_submissions_user_idx" ON "core_value_submissions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "core_value_submissions_status_idx" ON "core_value_submissions" USING btree ("status","created_at");