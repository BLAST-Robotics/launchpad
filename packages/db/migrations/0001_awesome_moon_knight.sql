ALTER TABLE "user" ADD COLUMN "graduation_year" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "requested_role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_requested_role_check" CHECK ("user"."requested_role" is null or "user"."requested_role" in ('student', 'parent', 'mentor'));