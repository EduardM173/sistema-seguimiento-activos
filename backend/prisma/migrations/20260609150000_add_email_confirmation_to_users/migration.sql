ALTER TABLE "usuarios"
  ADD COLUMN "correoConfirmado" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "correoConfirmadoEn" TIMESTAMP(3);
