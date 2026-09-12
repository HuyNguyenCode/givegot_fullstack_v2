# GiveGot Learning Hub Master Specification

## Purpose and authority

This file is the product and technical source of truth for the Learning Hub program. Direct owner instructions override it. `ARCHITECTURE_DECISIONS.md` governs implementation details; current code remains the regression baseline unless this specification explicitly requires a change.

Task 00 creates documentation and baseline evidence only. It does not implement a Learning Hub feature or authorize a schema migration.

## Product decision

GiveGot will provide a persistent, private LearningSpace for a pair to coordinate learning outcomes across multiple Booking sessions. The core loop is objective -> resource or task -> learner action -> feedback or acknowledgement -> fulfillment -> history. Learning Hub is not a miniature LMS, chat replacement, video platform, or collaborative editor.

Booking remains the scheduling, attendance, cancellation, dispute, review, escrow, and GivePoint transaction object. LearningSpace supplies relationship continuity and learning artifacts.

## Non-negotiable invariants

- Preserve authentication, suspension, Discover, matching, profiles, AvailableSlot concurrency, Booking, Calendar/Meet, cancellation, no-show, dispute, wallet, ledger, reviews, trust, chat, notifications, admin, AI, dashboard, history, and cron unless an approved task changes them.
- Preserve old database rows. Future schema work must be additive and nullable where it touches Booking; legacy rows with Learning Hub fields absent or null remain valid.
- Server session owns identity. Never authorize from client-supplied `userId`, `viewerId`, `senderId`, `actorId`, `uploaderId`, mentor ID, or learner ID.
- Private artifact metadata and URLs require object-level membership authorization.
- LearningSpace persists across Bookings.
- `primarySkill` is mutable with audit and notification. Changing it never rewrites historical Booking/topic provenance.
- Subtopics are flexible: free-form labels, optional canonical Skill mapping, and ACTIVE/ARCHIVED state.
- Do not add a hard unique constraint for pair plus primary skill. Suggest reuse of a matching active space, but allow a distinct goal, project, or learning phase to use another space.
- MVP has exactly three modes: LIVE, EXERCISE_REVIEW, and HYBRID. Mode changes checklist, artifacts, and completion eligibility; it is not cosmetic metadata.
- BookingStatus and FulfillmentStatus are separate lifecycles.
- Submission feedback is private learning feedback and must not alter public Review or Trust Score.
- Financial settlement is atomic, conditional, idempotent, auditable, and frozen during disputes.

## Priorities

| Priority | Scope | Exit intent |
| --- | --- | --- |
| P0 | Security prerequisites; Bring Your Pair; LearningSpace; Live, Exercise Review, Hybrid; private links/files; task-submission-feedback; manual notes; activity; fulfillment; notifications; history; admin support; flags and pilot analytics | A complete, secure learning loop for a two-person pilot without breaking legacy flows |
| P1 | Contribution evidence; VIDEO, DOCUMENT, and ASYNC_Q_AND_A modes after settlement is safe | Expand only after repeated pilot demand |
| P2 | AI source/consent boundary and editable draft recap | Generate only from explicit user-selected sources with provenance and review |
| P3 | Managed video upload/playback; Meet artifact consent; transcript processing and retention | Build only after validated traction and provider/privacy gates |

## P0 functional requirements

| ID | Capability | Requirement | Required guardrail |
| --- | --- | --- | --- |
| LH 001 | Create invite | Create an invite with primarySkill, objective, expiry, and usage limit. | Hash token; prevent self-invite and a third active member. |
| LH 002 | Accept invite | Show an accurate preview and let the recipient join the space. | Idempotent; reject expired, revoked, exhausted, or concurrently reused token. |
| LH 010 | Create space | Create directly or associate after Booking confirmation. | Primary skill required; no hard pair-plus-skill uniqueness. |
| LH 011 | Manage topics | Add, rename, archive, and optionally map subtopics to canonical Skill. | Do not automatically publish a new Skill; preserve provenance. |
| LH 012 | Objective | Let the pair update objective and definition of done. | Record updater and version; reject lost updates. |
| LH 020 | Learning mode | Select LIVE, EXERCISE_REVIEW, or HYBRID. | Mode activates a distinct checklist and settlement eligibility rule. |
| LH 030 | Link resource | Save HTTPS URL, title, description, and optional topic. | No arbitrary server fetch in MVP; normalize URL and render safely. |
| LH 031 | Upload file | Upload directly to private storage with a signed token. | P0 allowlist PDF, JPEG, PNG, TXT, Markdown; default 20 MB; quota and random key. |
| LH 032 | Download file | Issue a short-lived signed download URL after authorization. | Store only `storageKey`; reauthorize every request. |
| LH 040 | Create task | Create assignee, topic, deadline, description, and acceptance criteria. | Active member only; valid assignee and deadline. |
| LH 041 | Submit work | Submit text, HTTPS link, or attachment. | One current Submission in MVP; resubmit by incrementing revision count. |
| LH 042 | Review submission | Send feedback with reviewed or revision-requested outcome. | Private; separate from public Review and Trust Score. |
| LH 050 | Add note | Add a note or recap scoped to a space or Booking. | Author, timestamp, visibility, and optimistic-lock version required. |
| LH 060 | Activity | Show a structured learning event timeline. | Deduplicate by event key; do not mirror the complete chat transcript. |
| LH 070 | Complete fulfillment | Accept a deliverable or complete the mode checklist. | Conditional transition prevents double settlement; dispute freezes funds. |
| LH 080 | History | View archived/current spaces, topics, Bookings, and artifacts. | Old rows remain visible; archived space is readable and can be rebooked. |
| LH 090 | Notification | Notify task, due, submission, feedback, revision, delivery, and settlement. | Dedupe by event key; provider failure does not roll back domain state. |
| LH 100 | Admin support | Support reports and audited intervention when authorized. | No bulk private-file browsing; record actor, reason, entity, and time. |

## Learning modes

| Mode | Required evidence | Completion rule |
| --- | --- | --- |
| LIVE | Objective, scheduled Booking, meeting link where applicable, recap | Scheduled component ended and learner confirms, or an approved legacy live policy resolves it. |
| EXERCISE_REVIEW | Task, Submission, feedback | Mentor delivers feedback; learner accepts, or a mode-specific review window expires without dispute. |
| HYBRID | Prework, acknowledgement/question, scheduled component, recap | All required artifacts are complete and learner accepts. Meeting end alone is insufficient. |

Mode changes before delivery require audit and notification. A mode must not change after `DELIVERED` when that would change obligations or settlement.

## Lifecycles and settlement

BookingStatus remains:

`PENDING -> CONFIRMED -> COMPLETED | CANCELLED | MISSED | DISPUTED`

FulfillmentStatus is introduced separately in a future approved migration:

`NOT_STARTED -> IN_PROGRESS -> DELIVERED -> ACCEPTED -> SETTLED`

`DELIVERED -> REVISION_REQUESTED -> IN_PROGRESS`

- BookingStatus owns schedule, attendance, cancellation, no-show, and dispute meaning.
- FulfillmentStatus owns learning obligations and delivery evidence.
- EXERCISE_REVIEW and HYBRID never settle solely because `Booking.endTime` elapsed.
- A response window is measured from `deliveredAt`; 72 hours is the proposed default and remains an owner-reviewable production policy.
- Settlement conditionally claims the eligible record inside a transaction, credits exactly once, and writes immutable TransactionLog and deduplicated LearningActivity evidence.
- A dispute prevents automated settlement.

## Target domain model

Future schema is additive. Names may follow repository conventions, but relationships and invariants must remain.

- LearningSpace: title, mutable primarySkillId, ACTIVE/ARCHIVED state, timestamps.
- LearningSpaceMember: composite space/user identity, joined time, status; at most two active members enforced transactionally at service layer.
- LearningTopic: free-form/normalized label, optional skillId, state, creator, provenance.
- Booking additions: nullable learningSpaceId, topicId, learningMode, objective, definitionOfDone, fulfillmentStatus, deliveredAt, acceptedAt.
- LearningInvite: inviter, token hash, primary skill, expiry, use/revoke/accept state.
- LearningResource: space, optional Booking/topic, uploader, kind, title, `storageKey` or external URL, MIME/size/status, soft delete.
- LearningTask: space, optional Booking/topic, creator, assignee, title, description, acceptance criteria, due time, status.
- Submission: one current record per task in MVP, author, content/link/attachment, revision count, status, submitted time.
- SubmissionReview: one current review per Submission in MVP, reviewer, private content, outcome, reviewed time.
- LearningNote: scope, author, content, visibility, version, timestamps.
- LearningActivity: structured event, actor, entity reference, privacy-safe metadata, unique event key.

History is a derived view over source records and activity; do not add a mutable LearningHistory table.

## Application and security contract

- Planned route family is `/learning/[spaceId]` and `/api/learning/...`; exact names may follow established Next.js conventions.
- Shared services own validation, session authentication, authorization, state transitions, idempotency, and audit.
- Protected reads/mutations load current identity from `auth()` and verify target membership or narrowly authorized admin access.
- Invite, upload, settlement, and other replayable mutations use idempotency keys or conditional state updates.
- Private realtime events use authorized/private channels; no private learning payload uses a public channel.
- Production cron endpoints require `CRON_SECRET` and reject an unset secret.
- Logs may contain request, actor, space, and entity IDs, but not raw tokens, signed URLs, secrets, notes, submissions, or messages.

## Storage and providers

- Use a private object bucket and direct browser upload via an approximately five-minute signed token.
- Use approximately ten-minute signed downloads regenerated after membership authorization.
- Key shape: `spaces/{spaceId}/resources/{resourceId}/{uuid}.{ext}`; a new version creates a new object.
- Verify provider metadata at finalize, quarantine until READY, and purge orphan uploads idempotently.
- Never expose a service-role key through a `NEXT_PUBLIC_` variable or client bundle.
- External resources accept HTTPS and open with `noopener noreferrer`; no arbitrary URL fetch/oEmbed in P0.
- Keep Calendar/Meet for LIVE/HYBRID. Meet completion is not universal fulfillment evidence.
- Raw video hosting, recording, transcript ingestion, and broad Drive/Classroom integration are deferred.

## Notes and AI

P0 notes are plain text or basic Markdown with author, scope, timestamp, visibility, and version. P2 AI creates an editable DRAFT only from sources the user explicitly selects. Record source entity IDs, model, prompt version, and generated time. Treat extracted text as untrusted input. Never send the full conversation by default or claim an unread link was processed.

## Analytics and pilot gates

North star: weekly active LearningSpaces completing at least one learning loop. A valid loop contains a resource or task, learner action, and feedback or acknowledgement.

Track raw counts and rates for invite acceptance, first value within 24 hours, loop completion, Submission-to-review completion, next session within 14 days, and week-2/week-4 return. Pilot thresholds are decision aids, not forecasts: 5-10 pairs; at least 60% activation within 24 hours, 40% task-to-feedback completion among active spaces, and 30% rebook/task return within 14 days.

## Out of scope

- Full LMS, course builder, curriculum, gradebook, cohort classroom, academic certification, or more than two active members.
- Moodle/Google Classroom as a core dependency; broad Google Drive import/sync.
- Direct raw-video upload/transcoding/CDN or video analytics in P0.
- Automatic Meet recording, transcript ingestion, or always-on AI note taking.
- Realtime collaborative editing, complex PDF annotation, whiteboard, or threaded grading.
- Public resource marketplace or semantic search over private files.
- Automatic public Skill creation from free-form subtopics.

## MVP acceptance

- An existing pair joins one persistent space through an invite and creates first value without Discover.
- A pair formed through Booking can reuse an active space or create a separate one.
- Primary skill changes are audited; subtopics and historical snapshots retain provenance.
- All three MVP modes enforce their own completion evidence.
- Exercise Review completes task -> Submission -> feedback -> acceptance/settlement without manual database repair.
- HYBRID does not complete only because a Meet time ended.
- A non-member cannot enumerate metadata, read an object, or obtain a signed URL by changing an ID.
- Legacy Booking, chat, review, cancellation, no-show, dispute, ledger, dashboard, and history flows remain valid for old rows.
- Analytics can calculate activation, learning-loop completion, rebooking, and retention from defined events.
