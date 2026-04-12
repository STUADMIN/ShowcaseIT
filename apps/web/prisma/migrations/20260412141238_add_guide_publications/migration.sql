-- CreateTable
CREATE TABLE "guide_publications" (
    "id" TEXT NOT NULL,
    "guide_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "brand_kit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_publications_guide_id_project_id_key" ON "guide_publications"("guide_id", "project_id");

-- AddForeignKey
ALTER TABLE "guide_publications" ADD CONSTRAINT "guide_publications_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_publications" ADD CONSTRAINT "guide_publications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_publications" ADD CONSTRAINT "guide_publications_brand_kit_id_fkey" FOREIGN KEY ("brand_kit_id") REFERENCES "brand_kits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
