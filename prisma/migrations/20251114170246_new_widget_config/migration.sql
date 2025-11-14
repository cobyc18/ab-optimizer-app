-- AlterTable
ALTER TABLE "ab_tests" ADD COLUMN     "widgetPresetId" TEXT,
ADD COLUMN     "widgetPresetName" TEXT,
ADD COLUMN     "widgetSettings" JSONB,
ADD COLUMN     "widgetType" TEXT;
