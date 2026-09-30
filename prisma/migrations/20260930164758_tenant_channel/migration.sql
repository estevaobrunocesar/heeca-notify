-- CreateTable
CREATE TABLE "TenantChannel" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "fromPhone" TEXT NOT NULL,
    "contentSids" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantChannel_product_tenantId_key" ON "TenantChannel"("product", "tenantId");
