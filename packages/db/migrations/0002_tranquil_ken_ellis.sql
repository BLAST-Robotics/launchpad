ALTER TABLE "roster_entries" ADD COLUMN "dues_status" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD COLUMN "source" text DEFAULT 'keysign' NOT NULL;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_dues_status_check" CHECK ("roster_entries"."dues_status" in ('paid','unpaid','unknown'));--> statement-breakpoint
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_source_check" CHECK ("waiver_signatures"."source" in ('keysign','self_reported'));