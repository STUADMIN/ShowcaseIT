-- AlterTable
ALTER TABLE "users" ADD COLUMN "notify_guide_published" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notify_team_invites" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notify_weekly_digest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "weekly_digest_last_sent_at" TIMESTAMP(3);
