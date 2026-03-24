-- Org / tenant key on workspace; denormalized onto recordings and guides for tagging & queries.

ALTER TABLE "workspaces" ADD COLUMN "org_key" TEXT;

CREATE UNIQUE INDEX "workspaces_org_key_key" ON "workspaces"("org_key");

ALTER TABLE "recordings" ADD COLUMN "org_key" TEXT;

CREATE INDEX "recordings_org_key_idx" ON "recordings"("org_key");

ALTER TABLE "guides" ADD COLUMN "org_key" TEXT;

CREATE INDEX "guides_org_key_idx" ON "guides"("org_key");

UPDATE "recordings" AS r
SET "org_key" = w."org_key"
FROM "projects" AS p
JOIN "workspaces" AS w ON w."id" = p."workspace_id"
WHERE r."project_id" = p."id"
  AND w."org_key" IS NOT NULL;

UPDATE "guides" AS g
SET "org_key" = w."org_key"
FROM "projects" AS p
JOIN "workspaces" AS w ON w."id" = p."workspace_id"
WHERE g."project_id" = p."id"
  AND w."org_key" IS NOT NULL;
