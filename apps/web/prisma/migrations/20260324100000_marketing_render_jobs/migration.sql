-- Marketing export jobs (branded video, motion walkthrough, AI — processor is external / future)
CREATE TABLE "marketing_render_jobs" (
    "id" TEXT NOT NULL,
    "recording_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "output_url" TEXT,
    "error" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_render_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_render_jobs_recording_id_idx" ON "marketing_render_jobs"("recording_id");
CREATE INDEX "marketing_render_jobs_status_idx" ON "marketing_render_jobs"("status");

ALTER TABLE "marketing_render_jobs" ADD CONSTRAINT "marketing_render_jobs_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_render_jobs" ADD CONSTRAINT "marketing_render_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
