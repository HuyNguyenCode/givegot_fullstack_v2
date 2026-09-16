INSERT INTO "User" ("id", "email") VALUES
  ('legacy-mentor', 'legacy-mentor@example.test'),
  ('legacy-mentee', 'legacy-mentee@example.test');

INSERT INTO "Skill" ("id", "name", "slug") VALUES
  ('legacy-skill', 'Legacy Skill', 'legacy-skill');

INSERT INTO "Booking" (
  "id", "mentorId", "menteeId", "startTime", "endTime", "status", "note", "meetingUrl"
) VALUES
  ('legacy-pending', 'legacy-mentor', 'legacy-mentee', '2026-01-01T01:00:00Z', '2026-01-01T02:00:00Z', 'PENDING', 'pending note', NULL),
  ('legacy-confirmed', 'legacy-mentor', 'legacy-mentee', '2026-01-02T01:00:00Z', '2026-01-02T02:00:00Z', 'CONFIRMED', 'confirmed note', 'https://meet.example.test/confirmed'),
  ('legacy-completed', 'legacy-mentor', 'legacy-mentee', '2026-01-03T01:00:00Z', '2026-01-03T02:00:00Z', 'COMPLETED', NULL, 'https://meet.example.test/completed'),
  ('legacy-cancelled', 'legacy-mentor', 'legacy-mentee', '2026-01-04T01:00:00Z', '2026-01-04T02:00:00Z', 'CANCELLED', 'cancelled note', NULL),
  ('legacy-missed', 'legacy-mentor', 'legacy-mentee', '2026-01-05T01:00:00Z', '2026-01-05T02:00:00Z', 'MISSED', NULL, NULL),
  ('legacy-disputed', 'legacy-mentor', 'legacy-mentee', '2026-01-06T01:00:00Z', '2026-01-06T02:00:00Z', 'DISPUTED', 'disputed note', NULL);
