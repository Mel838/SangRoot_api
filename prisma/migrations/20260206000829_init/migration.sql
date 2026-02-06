-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOSPITAL', 'BLOOD_BANK', 'DOCTOR');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RequestUrgency" AS ENUM ('CRITICAL', 'URGENT', 'ROUTINE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "licenseNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_banks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "licenseNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "specialization" TEXT,
    "registrationNo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_invites" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorEmail" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "doctorId" TEXT,
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donors" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT,
    "bloodBankId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastDonationDate" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "unitsRequired" INTEGER NOT NULL,
    "urgency" "RequestUrgency" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER NOT NULL,
    "patientGender" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "hospitalAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "requiredBy" TIMESTAMP(3) NOT NULL,
    "medicalReason" TEXT,
    "aiProcessedAt" TIMESTAMP(3),
    "donorsContacted" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_userId_key" ON "hospitals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_licenseNumber_key" ON "hospitals"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "blood_banks_userId_key" ON "blood_banks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "blood_banks_licenseNumber_key" ON "blood_banks"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_userId_key" ON "doctors"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_registrationNo_key" ON "doctors"("registrationNo");

-- CreateIndex
CREATE INDEX "doctors_hospitalId_idx" ON "doctors"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_invites_doctorId_key" ON "hospital_invites"("doctorId");

-- CreateIndex
CREATE INDEX "hospital_invites_hospitalId_idx" ON "hospital_invites"("hospitalId");

-- CreateIndex
CREATE INDEX "hospital_invites_doctorEmail_idx" ON "hospital_invites"("doctorEmail");

-- CreateIndex
CREATE INDEX "hospital_invites_status_idx" ON "hospital_invites"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_invites_hospitalId_doctorEmail_key" ON "hospital_invites"("hospitalId", "doctorEmail");

-- CreateIndex
CREATE UNIQUE INDEX "donors_phone_key" ON "donors"("phone");

-- CreateIndex
CREATE INDEX "donors_bloodGroup_idx" ON "donors"("bloodGroup");

-- CreateIndex
CREATE INDEX "donors_latitude_longitude_idx" ON "donors"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "donors_isAvailable_idx" ON "donors"("isAvailable");

-- CreateIndex
CREATE INDEX "donors_hospitalId_idx" ON "donors"("hospitalId");

-- CreateIndex
CREATE INDEX "donors_bloodBankId_idx" ON "donors"("bloodBankId");

-- CreateIndex
CREATE INDEX "blood_requests_requesterId_idx" ON "blood_requests"("requesterId");

-- CreateIndex
CREATE INDEX "blood_requests_status_idx" ON "blood_requests"("status");

-- CreateIndex
CREATE INDEX "blood_requests_bloodGroup_idx" ON "blood_requests"("bloodGroup");

-- CreateIndex
CREATE INDEX "blood_requests_urgency_idx" ON "blood_requests"("urgency");

-- CreateIndex
CREATE INDEX "blood_requests_requiredBy_idx" ON "blood_requests"("requiredBy");

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_banks" ADD CONSTRAINT "blood_banks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invites" ADD CONSTRAINT "hospital_invites_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invites" ADD CONSTRAINT "hospital_invites_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donors" ADD CONSTRAINT "donors_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donors" ADD CONSTRAINT "donors_bloodBankId_fkey" FOREIGN KEY ("bloodBankId") REFERENCES "blood_banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
