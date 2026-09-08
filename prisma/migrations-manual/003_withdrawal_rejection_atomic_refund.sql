-- Atomic withdrawal-rejection refund support.
-- Apply before deploying code that writes REFUND_WITHDRAWAL_REJECTED.
BEGIN;

ALTER TYPE "TransactionType"
  ADD VALUE IF NOT EXISTS 'REFUND_WITHDRAWAL_REJECTED';

COMMIT;
