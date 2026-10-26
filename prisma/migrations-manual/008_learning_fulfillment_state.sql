-- I1: additive, nullable version for optimistic fulfillment transitions.
-- Existing Booking rows and BookingStatus values are not rewritten.
BEGIN;
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "fulfillmentVersion" INTEGER;
COMMIT;
