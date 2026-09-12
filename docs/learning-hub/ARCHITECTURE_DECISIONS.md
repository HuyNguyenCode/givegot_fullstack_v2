# Learning Hub Architecture Decisions

## Decision policy

These decisions are accepted for P0 unless the owner explicitly changes them. A later task must record a superseding decision before implementing a conflicting design.

## ADR 001 Persistent LearningSpace

**Status:** Accepted

LearningSpace is a long-lived private relationship container for a pair. Booking remains a session and transaction within that relationship. A workspace per Booking would fragment history and weaken migration value.

## ADR 002 Mutable primary skill

**Status:** Accepted

A space has one `primarySkillId` for naming, discovery, contribution grouping, and analytics. It can change under the approved pair policy, with audit, optimistic concurrency, and notification. Historical Bookings and topics retain their original snapshot or reference.

## ADR 003 Flexible subtopics

**Status:** Accepted

LearningTopic stores a free-form label, normalized label, optional canonical `skillId`, state, creator, and provenance. Topic is optional on Booking, resource, task, and note. Free-form topics do not create public Skills automatically.

## ADR 004 No hard pair plus skill uniqueness

**Status:** Accepted

Do not add a database unique constraint over member pair and primary skill. The service suggests reuse of a matching active space but permits a new one for a separate goal, project, or phase. Pair ordering and two-member concurrency still require deterministic service logic.

## ADR 005 Two active members in MVP

**Status:** Accepted

LearningSpaceMember represents membership; permanent mentor/learner roles do not live on membership. Booking or Task owns the role for a specific exchange. Enforce at most two active members transactionally in the service layer so the schema does not block future group learning.

## ADR 006 Three mode-aware MVP workflows

**Status:** Accepted

P0 ships LIVE, EXERCISE_REVIEW, and HYBRID only. Each mode defines required artifacts, transitions, notifications, and settlement eligibility. VIDEO, DOCUMENT, and ASYNC_Q_AND_A are P1 and require a pilot gate.

## ADR 007 Separate Booking and fulfillment lifecycles

**Status:** Accepted

BookingStatus retains `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `MISSED`, and `DISPUTED`. FulfillmentStatus separately models `NOT_STARTED`, `IN_PROGRESS`, `DELIVERED`, `REVISION_REQUESTED`, `ACCEPTED`, and `SETTLED`. Scheduled time cannot stand in for delivery evidence in asynchronous or hybrid work.

## ADR 008 Additive legacy-compatible schema

**Status:** Accepted

Future Learning Hub models are additive. New Booking fields are nullable and old rows remain readable and actionable. Backfill `learningSpaceId` only when participant and skill provenance are unambiguous. Task 00 permits no migration.

## ADR 009 Server-session identity and object authorization

**Status:** Accepted

Protected reads and mutations derive identity from NextAuth `auth()` on the server. Client-supplied identities may name targets only after authorization; they never establish the actor. Every private object and signed URL requires membership or narrowly audited admin authorization.

## ADR 010 Private externalized files

**Status:** Accepted

Database rows store metadata and `storageKey`, never a durable signed URL or file body. Browsers upload directly to a private provider with short-lived authorization; downloads are reauthorized. Arbitrary server-side URL fetching is excluded from P0.

## ADR 011 Separate private feedback from public reputation

**Status:** Accepted

SubmissionReview is private. It does not create or update existing public Review and does not directly change Trust Score. Contribution aggregates count only approved, settled evidence and never expose private content.

## ADR 012 Manual notes before AI

**Status:** Accepted

P0 uses versioned manual notes/recaps. P2 may generate an editable draft only from user-selected sources with consent and provenance. Transcript/recording ingestion is P3 and requires separate provider, consent, retention, and deletion decisions.

## ADR 013 Derived history and structured activity

**Status:** Accepted

Learning history is a query/view over spaces, Bookings, artifacts, and deduplicated activity. Do not add a mutable history aggregate. Activity contains structured events and references, not a copy of chat.

## ADR 014 Atomic idempotent settlement

**Status:** Accepted

Settlement uses an eligible-state conditional claim inside a transaction, updates lifecycle state consistently, credits exactly once, and appends an immutable ledger row. Notifications are post-commit and best effort. Dispute freezes settlement.

## ADR 015 Provider boundaries

**Status:** Accepted

Reuse Calendar/Meet, Pusher, email, Prisma/PostgreSQL, and existing GivePoint/Review/Trust capabilities. GiveGot owns workflow, authorization, state, audit, and reputation. Provider failure must not erase committed domain state.

## Open owner decisions

- Final async review window; 72 hours from `deliveredAt` is the default proposal.
- Pair policy for who may change primary skill; default is either member with audit and notification.
- Archive retention; 30 days after soft delete is the default proposal.
- Office uploads enter P1 only after malware scanning.
- GivePoint totals are hidden by default until owner review.
- Mode pricing follows pilot data; do not market GivePoint as a low hourly wage.
