-- CreateTable
CREATE TABLE "customer_personas" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "persona" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "classified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_personas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_personas_customer_id_key" ON "customer_personas"("customer_id");

-- CreateIndex
CREATE INDEX "customer_personas_persona_idx" ON "customer_personas"("persona");

-- AddForeignKey
ALTER TABLE "customer_personas" ADD CONSTRAINT "customer_personas_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
