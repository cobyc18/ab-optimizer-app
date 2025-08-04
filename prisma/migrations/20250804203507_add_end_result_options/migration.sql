-- AlterTable
ALTER TABLE "ab_tests" ADD COLUMN     "conversionThreshold" INTEGER,
ADD COLUMN     "endResultType" TEXT,
ADD COLUMN     "impressionThreshold" INTEGER,
ADD COLUMN     "winner" TEXT;
