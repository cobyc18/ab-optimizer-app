/*
  Warnings:

  - You are about to drop the column `widgetPresetId` on the `ab_tests` table. All the data in the column will be lost.
  - You are about to drop the column `widgetPresetName` on the `ab_tests` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ab_tests" DROP COLUMN "widgetPresetId",
DROP COLUMN "widgetPresetName";
