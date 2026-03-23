-- Per-platform logo + banner for social publishing (JSON object)
ALTER TABLE "brand_kits" ADD COLUMN "social_platform_assets" JSONB NOT NULL DEFAULT '{}'::jsonb;
