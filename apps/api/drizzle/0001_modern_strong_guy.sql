CREATE TABLE "user_organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "users_organization_email_unique";--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_organizations_user_organization_unique" ON "user_organizations" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_organizations_user" ON "user_organizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_organizations_org" ON "user_organizations" USING btree ("organization_id");--> statement-breakpoint
INSERT INTO "user_organizations" ("user_id", "organization_id", "role", "created_at", "updated_at")
SELECT "id", "organization_id", COALESCE("role", 'viewer'), "created_at", "updated_at"
FROM "users"
WHERE "organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";
