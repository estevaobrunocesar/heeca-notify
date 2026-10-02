-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "phoneNumberId" TEXT;

-- AlterTable
ALTER TABLE "TenantChannel" ADD COLUMN     "connectionId" TEXT;

-- CreateTable
CREATE TABLE "WhatsappConnection" (
    "id" TEXT NOT NULL,
    "accountRef" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhone" TEXT NOT NULL,
    "verifiedName" TEXT,
    "tokenEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "lastError" TEXT,
    "templatesSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTemplate" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConnection_accountRef_key" ON "WhatsappConnection"("accountRef");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConnection_phoneNumberId_key" ON "WhatsappConnection"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTemplate_product_name_key" ON "ProductTemplate"("product", "name");

-- CreateIndex
CREATE INDEX "TenantChannel_connectionId_idx" ON "TenantChannel"("connectionId");

-- AddForeignKey
ALTER TABLE "TenantChannel" ADD CONSTRAINT "TenantChannel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "WhatsappConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
