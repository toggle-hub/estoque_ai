ALTER TABLE "organizations" DROP CONSTRAINT "organizations_cnpj_unique";--> statement-breakpoint
DROP INDEX "items_organization_sku_unique";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "user_organizations_user_organization_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "items_organization_sku_active_unique" ON "items" USING btree ("organization_id","sku") WHERE "items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_cnpj_active_unique" ON "organizations" USING btree ("cnpj") WHERE "organizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_unique" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_organizations_user_organization_unique" ON "user_organizations" USING btree ("user_id","organization_id") WHERE "user_organizations"."deleted_at" IS NULL;