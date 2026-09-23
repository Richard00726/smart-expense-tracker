-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "accountNo" TEXT,
ADD COLUMN     "balance" DOUBLE PRECISION,
ADD COLUMN     "bank" TEXT,
ADD COLUMN     "counterparty" TEXT,
ADD COLUMN     "counterpartyType" TEXT,
ADD COLUMN     "entryMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "refNo" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "linkedBanks" TEXT[] DEFAULT ARRAY[]::TEXT[];
