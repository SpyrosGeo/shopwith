-- CreateTable
CREATE TABLE "UserProduct" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3)
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProduct_userId_name_key" ON "UserProduct"("userId", "name");

-- AddForeignKey
ALTER TABLE "UserProduct" ADD CONSTRAINT "UserProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
