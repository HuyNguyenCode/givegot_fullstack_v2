# I1 pre-code Booking transition audit (2026-10-21)

This matrix records current source paths before the I1 fulfillment implementation. `BookingStatus` keeps its existing scheduling, attendance, and financial meaning. Several legacy writers use a preflight read followed by an unconditional `update`; their race behavior is a known baseline, not an I1 authorization model.

| Path | BookingStatus transition or mutation | Time / evidence | Financial or other effect |
| --- | --- | --- | --- |
| `bookAvailableSlot`, `createBooking` (`src/actions/booking.ts`) | create PENDING | locked slot for linked LIVE/HYBRID; manual path for legacy and EXERCISE_REVIEW | debit 1 GP, `BOOKING_CREATED`; linked rows start fulfillment NOT_STARTED |
| `acceptBooking` | PENDING → CONFIRMED, add Meet URL | mentor accepts, Calendar/Meet creation | no GP release |
| `declineBooking` | PENDING → CANCELLED, detach slot | mentor declines | refund 1 GP, cancellation log |
| `cancelBooking` | PENDING/CONFIRMED → CANCELLED, detach slot | either participant; early/late policy from `startTime` | refund or mentor compensation, Trust/receipt/notifications |
| `completeSessionWithReview` | CONFIRMED → COMPLETED | mentee public review; `endTime` elapsed | credit mentor 1 GP, log, public Review/Trust |
| `completeBooking` | CONFIRMED → COMPLETED | mentee; `endTime` elapsed | credit mentor 1 GP, log |
| `submitMentorReview`, `submitMenteeReview` (`src/actions/blind-review.ts`) | status unchanged; `isReviewRevealed` may change | public review submission | no GP in these actions; UI may invoke `completeBooking` |
| `reportNoShow` mentor absent | CONFIRMED → MISSED | mentee report within 48 hours, Meet attendance | refund 1 GP, Trust penalty |
| `reportNoShow` fraud verdict | CONFIRMED → COMPLETED | both attended per Meet evidence | credit mentor 1 GP, fraud log, Trust penalty |
| `reportNoShow` inconclusive | CONFIRMED → DISPUTED | Meet absent/inconclusive | freeze funds; create admin Report |
| `reportMentorAbsence` | status unchanged; report flag/time | mentor manual report | admin queue only |
| `resolveAbsenceReport` (`src/actions/admin.ts`) | nonterminal → MISSED or CANCELLED | admin resolves Report | release to mentor or refund to mentee; log and Trust policy |
| `auto-complete` cron | CONFIRMED → COMPLETED | `endTime < now - 72h`; conditional status claim | credit mentor 1 GP and log |
| `review-deadlines` cron | status unchanged | CONFIRMED, `endTime + 24..72h` | advisory notification only |
| `checkReviewGate` | status unchanged | legacy/LIVE CONFIRMED, `endTime + 48h` | blocks new booking; already excludes EXERCISE_REVIEW/HYBRID |
| `SubmissionReview` / task revision | Booking status and fulfillment unchanged | private feedback or revision | no public Review, Trust, or GP |

I1 adds only the ADR 020 fulfillment transitions and narrow linked-booking payout guards. The existing review-deadline cron copy and mode-aware settlement/timeout orchestration remain I3 scope. Linked no-show fraud and admin resolution remain Booking financial policy paths and are explicitly called out for I2 reconciliation; the new fulfillment service never initiates either path.
