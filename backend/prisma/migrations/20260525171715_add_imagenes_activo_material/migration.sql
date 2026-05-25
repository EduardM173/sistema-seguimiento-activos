-- CreateTable
CREATE TABLE "imagenes_activos" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imagenes_materiales" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "nombreOriginal" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagenes_materiales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "imagenes_activos_activoId_idx" ON "imagenes_activos"("activoId");

-- CreateIndex
CREATE INDEX "imagenes_materiales_materialId_idx" ON "imagenes_materiales"("materialId");

-- AddForeignKey
ALTER TABLE "imagenes_activos" ADD CONSTRAINT "imagenes_activos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagenes_materiales" ADD CONSTRAINT "imagenes_materiales_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
