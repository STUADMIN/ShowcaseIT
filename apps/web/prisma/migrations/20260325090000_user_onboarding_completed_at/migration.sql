-- AlterTable
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Existing accounts skip the onboarding funnel (new signups keep NULL until they finish).
UPDATE "users"
SET "onboarding_completed_at" = COALESCE("updated_at", "created_at")
WHERE "onboarding_completed_at" IS NULL;
