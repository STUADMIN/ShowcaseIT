-- Collapse workspace roles to `admin` and `member` (creator / first member uses admin in app code).

UPDATE "workspace_members" SET "role" = 'admin' WHERE "role" IN ('owner', 'admin');

UPDATE "workspace_members" SET "role" = 'member' WHERE "role" IN ('editor', 'viewer');

UPDATE "workspace_members" SET "role" = 'member' WHERE "role" NOT IN ('admin', 'member');

ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'member';
