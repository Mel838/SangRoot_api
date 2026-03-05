-- CreateEnum
CREATE TYPE "DonorAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'CONDITIONAL', 'NO_RESPONSE');

-- AlterTable: add agent result fields to blood_requests
ALTER TABLE "blood_requests"
  ADD COLUMN "willingDonorCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reportMarkdown" TEXT;

-- CreateTable: donor_responses
CREATE TABLE "donor_responses" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "availability" "DonorAvailability" NOT NULL,
  "constraint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "donor_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: blood_bank_responses
CREATE TABLE "blood_bank_responses" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "bloodBankId" TEXT NOT NULL,
  "available" BOOLEAN NOT NULL,
  "unitsAvailable" INTEGER NOT NULL DEFAULT 0,
  "preparationTimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blood_bank_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donor_responses_requestId_idx" ON "donor_responses"("requestId");
CREATE UNIQUE INDEX "donor_responses_requestId_donorId_key" ON "donor_responses"("requestId", "donorId");

-- CreateIndex
CREATE INDEX "blood_bank_responses_requestId_idx" ON "blood_bank_responses"("requestId");
CREATE UNIQUE INDEX "blood_bank_responses_requestId_bloodBankId_key" ON "blood_bank_responses"("requestId", "bloodBankId");

-- AddForeignKey
ALTER TABLE "donor_responses"
  ADD CONSTRAINT "donor_responses_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "blood_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "donor_responses"
  ADD CONSTRAINT "donor_responses_donorId_fkey"
  FOREIGN KEY ("donorId") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blood_bank_responses"
  ADD CONSTRAINT "blood_bank_responses_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "blood_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blood_bank_responses"
  ADD CONSTRAINT "blood_bank_responses_bloodBankId_fkey"
  FOREIGN KEY ("bloodBankId") REFERENCES "blood_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
