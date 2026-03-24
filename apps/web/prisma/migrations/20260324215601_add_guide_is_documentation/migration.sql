-- AlterTable
ALTER TABLE "guides" ADD COLUMN     "is_documentation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "guides_is_documentation_idx" ON "guides"("is_documentation");
