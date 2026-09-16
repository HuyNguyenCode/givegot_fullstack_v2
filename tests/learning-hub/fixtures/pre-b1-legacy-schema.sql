-- Minimal pre-B1 relational surface needed to exercise the additive migration.
-- It intentionally mirrors legacy Booking scalar fields and all six status
-- labels while omitting unrelated application tables.
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'MISSED', 'DISPUTED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email")
);

CREATE TABLE "Skill" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  CONSTRAINT "Skill_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Skill_name_key" UNIQUE ("name"),
  CONSTRAINT "Skill_slug_key" UNIQUE ("slug")
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "mentorId" TEXT NOT NULL,
  "menteeId" TEXT NOT NULL,
  "slotId" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "meetingUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isReviewRevealed" BOOLEAN NOT NULL DEFAULT false,
  "mentorReportedAbsence" BOOLEAN NOT NULL DEFAULT false,
  "mentorAbsenceReportedAt" TIMESTAMP(3),
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Booking_slotId_key" UNIQUE ("slotId"),
  CONSTRAINT "Booking_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Booking_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
