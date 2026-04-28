-- AlterTable
ALTER TABLE "materiales" ADD COLUMN     "areaId" TEXT;

-- CreateIndex
CREATE INDEX "materiales_areaId_idx" ON "materiales"("areaId");

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
