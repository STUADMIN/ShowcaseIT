-- AlterTable
ALTER TABLE "users" ADD COLUMN "preferred_workspace_id" TEXT,
ADD COLUMN "recording_mic_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "ui_preferences" JSONB NOT NULL DEFAULT '{}';

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_workspace_id_fkey" FOREIGN KEY ("preferred_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
