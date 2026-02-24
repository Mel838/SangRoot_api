/*
  Warnings:

  - You are about to drop the column `address` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `isAvailable` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `lastDonationDate` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `pincode` on the `donors` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `donors` table. All the data in the column will be lost.
  - Added the required column `dateBirth` to the `donors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `genre` to the `donors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `neighbourhood` to the `donors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `donors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `town` to the `donors` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CameroonRegion" AS ENUM ('ADAMAWA', 'CENTRE', 'EAST', 'FAR_NORTH', 'LITTORAL', 'NORTH', 'NORTH_WEST', 'WEST', 'SOUTH', 'SOUTH_WEST');

-- DropIndex
DROP INDEX "donors_isAvailable_idx";

-- DropIndex
DROP INDEX "donors_latitude_longitude_idx";

-- AlterTable
ALTER TABLE "donors" DROP COLUMN "address",
DROP COLUMN "city",
DROP COLUMN "isAvailable",
DROP COLUMN "isPublic",
DROP COLUMN "lastDonationDate",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "pincode",
DROP COLUMN "state",
ADD COLUMN     "dateBirth" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "genre" "Gender" NOT NULL,
ADD COLUMN     "neighbourhood" TEXT NOT NULL,
ADD COLUMN     "region" "CameroonRegion" NOT NULL,
ADD COLUMN     "town" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "donors_region_town_idx" ON "donors"("region", "town");
