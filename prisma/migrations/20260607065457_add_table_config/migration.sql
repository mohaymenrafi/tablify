-- CreateTable
CREATE TABLE "TableConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayPages" BOOLEAN NOT NULL DEFAULT false,
    "displayCollections" BOOLEAN NOT NULL DEFAULT false,
    "displayProducts" BOOLEAN NOT NULL DEFAULT false,
    "pages" TEXT NOT NULL DEFAULT '[]',
    "collections" TEXT NOT NULL DEFAULT '[]',
    "products" TEXT NOT NULL DEFAULT '[]',
    "type" TEXT NOT NULL DEFAULT 'build',
    "tableData" TEXT NOT NULL DEFAULT '[]',
    "googleSheetUrl" TEXT NOT NULL DEFAULT '',
    "googleSheetJson" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TableConfig_shop_idx" ON "TableConfig"("shop");
