/*
  Warnings:

  - You are about to drop the `Area` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Asset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssetAssignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssetCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssetDocument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssetIncident` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssetMovement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GeneratedReport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryMovement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Material` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MaterialCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "EstadoActivo" AS ENUM ('OPERATIVO', 'MANTENIMIENTO', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('PENDIENTE', 'RECIBIDO', 'RECHAZADO', 'DEVUELTO');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoMovimientoActivo" AS ENUM ('REGISTRO', 'ASIGNACION', 'TRANSFERENCIA', 'DEVOLUCION', 'BAJA', 'ACTUALIZACION', 'INCIDENTE');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('STOCK_BAJO', 'ACTIVO_ASIGNADO', 'ACTIVO_TRANSFERIDO', 'ACTIVO_PENDIENTE_CONFIRMACION', 'ACTIVO_RECHAZADO', 'ALERTA_SISTEMA');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('NO_LEIDA', 'LEIDA');

-- CreateEnum
CREATE TYPE "FormatoReporte" AS ENUM ('PDF', 'EXCEL');

-- DropForeignKey
ALTER TABLE "Area" DROP CONSTRAINT "Area_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Area" DROP CONSTRAINT "Area_managerUserId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_currentAreaId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_currentResponsibleId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_locationId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "AssetAssignment" DROP CONSTRAINT "AssetAssignment_assetId_fkey";

-- DropForeignKey
ALTER TABLE "AssetAssignment" DROP CONSTRAINT "AssetAssignment_assignedAreaId_fkey";

-- DropForeignKey
ALTER TABLE "AssetAssignment" DROP CONSTRAINT "AssetAssignment_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "AssetAssignment" DROP CONSTRAINT "AssetAssignment_assignedUserId_fkey";

-- DropForeignKey
ALTER TABLE "AssetAssignment" DROP CONSTRAINT "AssetAssignment_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "AssetDocument" DROP CONSTRAINT "AssetDocument_assetId_fkey";

-- DropForeignKey
ALTER TABLE "AssetDocument" DROP CONSTRAINT "AssetDocument_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "AssetIncident" DROP CONSTRAINT "AssetIncident_assetId_fkey";

-- DropForeignKey
ALTER TABLE "AssetIncident" DROP CONSTRAINT "AssetIncident_reportedById_fkey";

-- DropForeignKey
ALTER TABLE "AssetMovement" DROP CONSTRAINT "AssetMovement_assetId_fkey";

-- DropForeignKey
ALTER TABLE "AssetMovement" DROP CONSTRAINT "AssetMovement_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "AssetMovement" DROP CONSTRAINT "AssetMovement_performedById_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "GeneratedReport" DROP CONSTRAINT "GeneratedReport_generatedById_fkey";

-- DropForeignKey
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_materialId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_performedById_fkey";

-- DropForeignKey
ALTER TABLE "Material" DROP CONSTRAINT "Material_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_areaId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_materialId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_areaId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_roleId_fkey";

-- DropTable
DROP TABLE "Area";

-- DropTable
DROP TABLE "Asset";

-- DropTable
DROP TABLE "AssetAssignment";

-- DropTable
DROP TABLE "AssetCategory";

-- DropTable
DROP TABLE "AssetDocument";

-- DropTable
DROP TABLE "AssetIncident";

-- DropTable
DROP TABLE "AssetMovement";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "GeneratedReport";

-- DropTable
DROP TABLE "InventoryMovement";

-- DropTable
DROP TABLE "Location";

-- DropTable
DROP TABLE "Material";

-- DropTable
DROP TABLE "MaterialCategory";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "RolePermission";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "AssetCondition";

-- DropEnum
DROP TYPE "AssetMovementType";

-- DropEnum
DROP TYPE "AssignmentStatus";

-- DropEnum
DROP TYPE "MovementType";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "ReportFormat";

-- DropEnum
DROP TYPE "UserStatus";

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "nombreUsuario" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "telefono" TEXT,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "areaId" TEXT,
    "rolId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles_permisos" (
    "rolId" TEXT NOT NULL,
    "permisoId" TEXT NOT NULL,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("rolId","permisoId")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "ubicacionId" TEXT,
    "encargadoId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "edificio" TEXT,
    "piso" TEXT,
    "ambiente" TEXT,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_activos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "fechaAdquisicion" TIMESTAMP(3),
    "costoAdquisicion" DECIMAL(12,2),
    "vencimientoGarantia" TIMESTAMP(3),
    "estado" "EstadoActivo" NOT NULL DEFAULT 'OPERATIVO',
    "categoriaId" TEXT NOT NULL,
    "ubicacionId" TEXT,
    "areaActualId" TEXT,
    "responsableActualId" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "actualizadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "dadoDeBajaEn" TIMESTAMP(3),

    CONSTRAINT "activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_activos" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "areaAsignadaId" TEXT,
    "usuarioAsignadoId" TEXT,
    "asignadoPorId" TEXT NOT NULL,
    "recibidoPorId" TEXT,
    "estado" "EstadoAsignacion" NOT NULL DEFAULT 'PENDIENTE',
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibidoEn" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "observaciones" TEXT,

    CONSTRAINT "asignaciones_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_activos" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoActivo" NOT NULL,
    "areaOrigenId" TEXT,
    "areaDestinoId" TEXT,
    "usuarioOrigenId" TEXT,
    "usuarioDestinoId" TEXT,
    "realizadoPorId" TEXT NOT NULL,
    "asignacionId" TEXT,
    "detalle" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes_activos" (
    "id" TEXT NOT NULL,
    "activoId" TEXT NOT NULL,
    "reportadoPorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidentes_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_activos" (
    "id" TEXT NOT NULL,
    "activoId" TEXT,
    "incidenteId" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "urlArchivo" TEXT NOT NULL,
    "tipoMime" TEXT,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_materiales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "categorias_materiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiales" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "stockActual" DECIMAL(12,2) NOT NULL,
    "stockMinimo" DECIMAL(12,2) NOT NULL,
    "categoriaId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "stockAnterior" DECIMAL(12,2) NOT NULL,
    "stockNuevo" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT,
    "realizadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "areaId" TEXT,
    "materialId" TEXT,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'NO_LEIDA',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leidoEn" TIMESTAMP(3),

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipoEntidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valoresAnteriores" JSONB,
    "valoresNuevos" JSONB,
    "direccionIp" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_generados" (
    "id" TEXT NOT NULL,
    "generadoPorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "formato" "FormatoReporte" NOT NULL,
    "filtros" JSONB,
    "urlArchivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_generados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nombreUsuario_key" ON "usuarios"("nombreUsuario");

-- CreateIndex
CREATE INDEX "usuarios_rolId_idx" ON "usuarios"("rolId");

-- CreateIndex
CREATE INDEX "usuarios_areaId_idx" ON "usuarios"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "areas_nombre_key" ON "areas"("nombre");

-- CreateIndex
CREATE INDEX "areas_ubicacionId_idx" ON "areas"("ubicacionId");

-- CreateIndex
CREATE INDEX "areas_encargadoId_idx" ON "areas"("encargadoId");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_nombre_edificio_piso_ambiente_key" ON "ubicaciones"("nombre", "edificio", "piso", "ambiente");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_activos_nombre_key" ON "categorias_activos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "activos_codigo_key" ON "activos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "activos_numeroSerie_key" ON "activos"("numeroSerie");

-- CreateIndex
CREATE INDEX "activos_categoriaId_idx" ON "activos"("categoriaId");

-- CreateIndex
CREATE INDEX "activos_ubicacionId_idx" ON "activos"("ubicacionId");

-- CreateIndex
CREATE INDEX "activos_areaActualId_idx" ON "activos"("areaActualId");

-- CreateIndex
CREATE INDEX "activos_responsableActualId_idx" ON "activos"("responsableActualId");

-- CreateIndex
CREATE INDEX "activos_creadoPorId_idx" ON "activos"("creadoPorId");

-- CreateIndex
CREATE INDEX "activos_actualizadoPorId_idx" ON "activos"("actualizadoPorId");

-- CreateIndex
CREATE INDEX "activos_estado_idx" ON "activos"("estado");

-- CreateIndex
CREATE INDEX "asignaciones_activos_activoId_idx" ON "asignaciones_activos"("activoId");

-- CreateIndex
CREATE INDEX "asignaciones_activos_areaAsignadaId_idx" ON "asignaciones_activos"("areaAsignadaId");

-- CreateIndex
CREATE INDEX "asignaciones_activos_usuarioAsignadoId_idx" ON "asignaciones_activos"("usuarioAsignadoId");

-- CreateIndex
CREATE INDEX "asignaciones_activos_asignadoPorId_idx" ON "asignaciones_activos"("asignadoPorId");

-- CreateIndex
CREATE INDEX "asignaciones_activos_recibidoPorId_idx" ON "asignaciones_activos"("recibidoPorId");

-- CreateIndex
CREATE INDEX "asignaciones_activos_estado_idx" ON "asignaciones_activos"("estado");

-- CreateIndex
CREATE INDEX "movimientos_activos_activoId_idx" ON "movimientos_activos"("activoId");

-- CreateIndex
CREATE INDEX "movimientos_activos_realizadoPorId_idx" ON "movimientos_activos"("realizadoPorId");

-- CreateIndex
CREATE INDEX "movimientos_activos_asignacionId_idx" ON "movimientos_activos"("asignacionId");

-- CreateIndex
CREATE INDEX "movimientos_activos_tipo_idx" ON "movimientos_activos"("tipo");

-- CreateIndex
CREATE INDEX "movimientos_activos_creadoEn_idx" ON "movimientos_activos"("creadoEn");

-- CreateIndex
CREATE INDEX "incidentes_activos_activoId_idx" ON "incidentes_activos"("activoId");

-- CreateIndex
CREATE INDEX "incidentes_activos_reportadoPorId_idx" ON "incidentes_activos"("reportadoPorId");

-- CreateIndex
CREATE INDEX "documentos_activos_activoId_idx" ON "documentos_activos"("activoId");

-- CreateIndex
CREATE INDEX "documentos_activos_incidenteId_idx" ON "documentos_activos"("incidenteId");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_materiales_nombre_key" ON "categorias_materiales"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "materiales_codigo_key" ON "materiales"("codigo");

-- CreateIndex
CREATE INDEX "materiales_categoriaId_idx" ON "materiales"("categoriaId");

-- CreateIndex
CREATE INDEX "materiales_nombre_idx" ON "materiales"("nombre");

-- CreateIndex
CREATE INDEX "movimientos_inventario_materialId_idx" ON "movimientos_inventario"("materialId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_realizadoPorId_idx" ON "movimientos_inventario"("realizadoPorId");

-- CreateIndex
CREATE INDEX "movimientos_inventario_tipo_idx" ON "movimientos_inventario"("tipo");

-- CreateIndex
CREATE INDEX "movimientos_inventario_creadoEn_idx" ON "movimientos_inventario"("creadoEn");

-- CreateIndex
CREATE INDEX "notificaciones_usuarioId_idx" ON "notificaciones"("usuarioId");

-- CreateIndex
CREATE INDEX "notificaciones_areaId_idx" ON "notificaciones"("areaId");

-- CreateIndex
CREATE INDEX "notificaciones_materialId_idx" ON "notificaciones"("materialId");

-- CreateIndex
CREATE INDEX "notificaciones_estado_idx" ON "notificaciones"("estado");

-- CreateIndex
CREATE INDEX "auditorias_tipoEntidad_entidadId_idx" ON "auditorias"("tipoEntidad", "entidadId");

-- CreateIndex
CREATE INDEX "auditorias_usuarioId_idx" ON "auditorias"("usuarioId");

-- CreateIndex
CREATE INDEX "auditorias_creadoEn_idx" ON "auditorias"("creadoEn");

-- CreateIndex
CREATE INDEX "reportes_generados_generadoPorId_idx" ON "reportes_generados"("generadoPorId");

-- CreateIndex
CREATE INDEX "reportes_generados_creadoEn_idx" ON "reportes_generados"("creadoEn");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles_permisos" ADD CONSTRAINT "roles_permisos_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_encargadoId_fkey" FOREIGN KEY ("encargadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_areaActualId_fkey" FOREIGN KEY ("areaActualId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_responsableActualId_fkey" FOREIGN KEY ("responsableActualId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos" ADD CONSTRAINT "activos_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_activos" ADD CONSTRAINT "asignaciones_activos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_activos" ADD CONSTRAINT "asignaciones_activos_areaAsignadaId_fkey" FOREIGN KEY ("areaAsignadaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_activos" ADD CONSTRAINT "asignaciones_activos_usuarioAsignadoId_fkey" FOREIGN KEY ("usuarioAsignadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_activos" ADD CONSTRAINT "asignaciones_activos_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_activos" ADD CONSTRAINT "asignaciones_activos_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_activos" ADD CONSTRAINT "movimientos_activos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_activos" ADD CONSTRAINT "movimientos_activos_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_activos" ADD CONSTRAINT "movimientos_activos_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "asignaciones_activos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_activos" ADD CONSTRAINT "incidentes_activos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes_activos" ADD CONSTRAINT "incidentes_activos_reportadoPorId_fkey" FOREIGN KEY ("reportadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_activos" ADD CONSTRAINT "documentos_activos_activoId_fkey" FOREIGN KEY ("activoId") REFERENCES "activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_activos" ADD CONSTRAINT "documentos_activos_incidenteId_fkey" FOREIGN KEY ("incidenteId") REFERENCES "incidentes_activos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_materiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_realizadoPorId_fkey" FOREIGN KEY ("realizadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_generados" ADD CONSTRAINT "reportes_generados_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
