-- Confluence integration settings per workspace (Postgres / Supabase)
ALTER TABLE "workspaces" ADD COLUMN "confluence_integration" JSONB;
