-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "listName" TEXT,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_itemId_key" ON "Purchase"("itemId");

-- CreateIndex
CREATE INDEX "Purchase_userId_purchasedAt_idx" ON "Purchase"("userId", "purchasedAt");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

