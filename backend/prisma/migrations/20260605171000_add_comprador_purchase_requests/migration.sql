-- CreateEnum
CREATE TYPE "TipoSolicitudCompra" AS ENUM ('ACTIVO', 'MATERIAL');

-- CreateEnum
CREATE TYPE "EstadoSolicitudCompra" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'COMPLETADA');

-- CreateTable
CREATE TABLE "solicitudes_compra" (
    "id" TEXT NOT NULL,
    "tipo" "TipoSolicitudCompra" NOT NULL,
    "estado" "EstadoSolicitudCompra" NOT NULL DEFAULT 'PENDIENTE',
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "nota" TEXT,
    "solicitanteId" TEXT NOT NULL,
    "activoId" TEXT,
    "materialId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_compra_solicitanteId_idx" ON "solicitudes_compra"("solicitanteId");

-- CreateIndex
CREATE INDEX "solicitudes_compra_activoId_idx" ON "solicitudes_compra"("activoId");

-- CreateIndex
CREATE INDEX "solicitudes_compra_materialId_idx" ON "solicitudes_compra"("materialId");

-- CreateIndex
CREATE INDEX "solicitudes_compra_tipo_idx" ON "solicitudes_compra"("tipo");

-- CreateIndex
CREATE INDEX "solicitudes_compra_estado_idx" ON "solicitudes_compra"("estado");

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "solicitudes_compra_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "solicitudes_compra_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_compra" ADD CONSTRAINT "solicitudes_compra_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
