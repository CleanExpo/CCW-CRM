-- Cin7 BOM cache: derived from workspace products (sync), plus production runs

CREATE TABLE "cin7_bom_masters" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "cin7_bom_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "status" TEXT NOT NULL DEFAULT 'active',
    "finished_good_sku" TEXT,
    "finished_good_name" TEXT,
    "quantity_produced" TEXT NOT NULL DEFAULT '1.0000',
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "notes" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cin7_bom_masters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cin7_bom_masters_owner_user_id_cin7_bom_id_key" ON "cin7_bom_masters"("owner_user_id", "cin7_bom_id");
CREATE INDEX "cin7_bom_masters_owner_user_id_idx" ON "cin7_bom_masters"("owner_user_id");

CREATE TABLE "cin7_bom_components" (
    "id" UUID NOT NULL,
    "bom_master_id" UUID NOT NULL,
    "component_sku" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "quantity" TEXT NOT NULL DEFAULT '1.0000',
    "uom" TEXT NOT NULL DEFAULT 'EA',
    "wastage_percent" TEXT NOT NULL DEFAULT '0.00',
    "notes" TEXT,

    CONSTRAINT "cin7_bom_components_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cin7_bom_components_bom_master_id_idx" ON "cin7_bom_components"("bom_master_id");

ALTER TABLE "cin7_bom_components" ADD CONSTRAINT "cin7_bom_components_bom_master_id_fkey" FOREIGN KEY ("bom_master_id") REFERENCES "cin7_bom_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cin7_production_runs" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "bom_master_id" UUID NOT NULL,
    "cin7_production_id" TEXT,
    "quantity_planned" TEXT NOT NULL,
    "quantity_completed" TEXT NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "planned_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "location_id" TEXT,
    "notes" TEXT,
    "cin7_synced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cin7_production_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cin7_production_runs_owner_user_id_idx" ON "cin7_production_runs"("owner_user_id");
CREATE INDEX "cin7_production_runs_bom_master_id_idx" ON "cin7_production_runs"("bom_master_id");

ALTER TABLE "cin7_production_runs" ADD CONSTRAINT "cin7_production_runs_bom_master_id_fkey" FOREIGN KEY ("bom_master_id") REFERENCES "cin7_bom_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
