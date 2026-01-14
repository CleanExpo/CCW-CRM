-- CreateEnum
CREATE TYPE "EquipmentModel" AS ENUM ('Truckmount', 'Portable', 'AirMovers', 'Dehumidifier');

-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('Boondall', 'SevenHills', 'Bayswater');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('InQueue', 'Diagnosing', 'WaitingParts', 'Testing', 'Ready');

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "serial_number" VARCHAR(50) NOT NULL,
    "model" "EquipmentModel" NOT NULL,
    "brand" TEXT NOT NULL,
    "current_branch" "Branch" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'InQueue',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_logs" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "technician_notes" TEXT,
    "parts_replaced" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serial_number_key" ON "equipment"("serial_number");

-- AddForeignKey
ALTER TABLE "service_logs" ADD CONSTRAINT "service_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
