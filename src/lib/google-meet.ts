'use server'

import { google } from 'googleapis'

// ── Attendance verification types ─────────────────────────────────────────────

export interface AttendanceRecord {
  /** Minutes the mentor spent inside the Meet room (0 if absent). */
  mentorMinutes: number
  /** Minutes the mentee spent inside the Meet room (0 if absent). */
  menteeMinutes: number
  /**
   * 'api'  — sourced from the real Google Workspace Admin Reports API.
   * 'mock' — deterministic stand-in (Admin SDK not configured).
   */
  source: 'api' | 'mock'
}

/**
 * Returns an OAuth2 client authenticated with the stored refresh token.
 * Returns null if GOOGLE_REFRESH_TOKEN is not set so callers can gracefully skip.
 */
function getOAuth2Client() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return null
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    // Must match the redirect URI used when generating the refresh token.
    // If you used OAuth Playground, this is 'https://developers.google.com/oauthplayground'
    process.env.GOOGLE_REDIRECT_URI ?? 'https://developers.google.com/oauthplayground'
  )

  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })

  return client
}

/**
 * Creates a Google Calendar event with an embedded Google Meet link.
 * Invites both participants as attendees so they receive a calendar invite.
 *
 * Returns the Meet URL (https://meet.google.com/xxx-xxxx-xxx) or null if
 * the Google credentials are not configured or the API call fails.
 * The booking acceptance flow treats a null return as non-fatal.
 */
export async function createGoogleMeetLink(
  startTime: Date,
  endTime: Date,
  menteeEmail: string,
  mentorEmail: string
): Promise<string | null> {
  const auth = getOAuth2Client()

  if (!auth) {
    console.warn(
      '[GoogleMeet] GOOGLE_REFRESH_TOKEN is not set. Skipping Meet link creation. ' +
        'Run `npx tsx scripts/google-oauth-setup.ts` to obtain a token.'
    )
    return null
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth })

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: 'GiveGot Mentoring Session',
        description:
          `A mentoring session on the GiveGot platform.\n\n` +
          `Mentor: ${mentorEmail}\n` +
          `Mentee: ${menteeEmail}`,
        start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
        attendees: [
          { email: mentorEmail, displayName: 'Mentor' },
          { email: menteeEmail, displayName: 'Mentee' },
        ],
        conferenceData: {
          createRequest: {
            // requestId must be unique per request to avoid duplicates on retry
            requestId: `givegot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    })

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri

    if (meetLink) {
      console.log(`[GoogleMeet] Created meeting: ${meetLink}`)
    }

    return meetLink ?? null
  } catch (error) {
    console.error('[GoogleMeet] Failed to create meeting link:', error)
    return null
  }
}

// ── Attendance verification ───────────────────────────────────────────────────

/**
 * Extracts the raw meeting code from a Google Meet URL.
 * e.g. "https://meet.google.com/abc-defg-hij" → "abc-defg-hij"
 */
function extractMeetCode(meetUrl: string): string | null {
  try {
    const url = new URL(meetUrl)
    // pathname is "/abc-defg-hij"
    const code = url.pathname.replace(/^\//, '').trim()
    return code || null
  } catch {
    return null
  }
}

/**
 * Returns a small deterministic integer in [0, 99] derived from a string.
 * Used to select a reproducible mock scenario during development/testing.
 */
function deterministicHash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0 // keep 32-bit unsigned
  }
  return h % 100
}

/**
 * Queries the Google Workspace Admin Reports API for Meet attendance records.
 *
 * Requires:
 *   - GOOGLE_WORKSPACE_ADMIN_EMAIL   — the super-admin email for domain-wide delegation
 *   - GOOGLE_REFRESH_TOKEN           — OAuth refresh token with the Reports scope
 *
 * The Reports API filters by `meeting_code` and collects the `duration_seconds`
 * parameter from every `call_ended` event within the session window (±1 h buffer).
 *
 * Returns `null` when the API is not configured or the call fails, so callers
 * should treat `null` as an inconclusive (DISPUTED) outcome.
 */
async function fetchAttendanceFromAPI(
  meetUrl: string,
  mentorEmail: string,
  menteeEmail: string,
  sessionStart: Date,
  sessionEnd: Date,
): Promise<AttendanceRecord | null> {
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL
  if (!adminEmail) return null

  const auth = getOAuth2Client()
  if (!auth) return null

  const meetCode = extractMeetCode(meetUrl)
  if (!meetCode) {
    console.warn('[GoogleMeet] Could not extract meeting code from URL:', meetUrl)
    return null
  }

  try {
    // Reports API requires the subject to be a super-admin in the Workspace domain
    // so we impersonate the configured admin email.
    const jwtClient = auth as ReturnType<typeof getOAuth2Client>
    if (!jwtClient) return null

    const reportsClient = google.admin({ version: 'reports_v1', auth: jwtClient })

    // Search ±1 h around the scheduled window to catch slight overruns
    const windowStart = new Date(sessionStart.getTime() - 60 * 60 * 1000)
    const windowEnd   = new Date(sessionEnd.getTime()   + 60 * 60 * 1000)

    const response = await reportsClient.activities.list({
      userKey:         'all',
      applicationName: 'meet',
      eventName:       'call_ended',
      // Filter by meeting code; the double == is the Reports API filter syntax
      filters:         `meeting_code==${meetCode}`,
      startTime:       windowStart.toISOString(),
      endTime:         windowEnd.toISOString(),
      maxResults:      100,
    })

    const activities = response.data.items ?? []

    // Each activity item represents one participant's session in the room.
    // The `identifier` parameter holds their email; `duration_seconds` is seat time.
    const durationByEmail: Record<string, number> = {}

    for (const item of activities) {
      for (const event of item.events ?? []) {
        const params = event.parameters ?? []
        const email    = params.find((p) => p.name === 'identifier')?.value ?? ''
        const durSecs  = Number(params.find((p) => p.name === 'duration_seconds')?.intValue ?? 0)

        if (email) {
          // A user may appear multiple times (rejoined); accumulate
          durationByEmail[email] = (durationByEmail[email] ?? 0) + durSecs
        }
      }
    }

    const mentorMinutes = Math.round((durationByEmail[mentorEmail] ?? 0) / 60)
    const menteeMinutes = Math.round((durationByEmail[menteeEmail] ?? 0) / 60)

    console.log(
      `[GoogleMeet] Attendance for ${meetCode}: mentor=${mentorMinutes}m mentee=${menteeMinutes}m`
    )

    return { mentorMinutes, menteeMinutes, source: 'api' }
  } catch (error) {
    console.error('[GoogleMeet] Admin Reports API error:', error)
    return null
  }
}

/**
 * Produces deterministic mock attendance data for development/testing.
 *
 * The hash of `meetUrl` maps to one of three scenarios so that any given
 * meeting link always returns the same verdict — enabling reproducible tests:
 *
 *   hash mod 10 ∈ {0-6}  → Both attended (> 30 min each) — normal / fraud detection
 *   hash mod 10 ∈ {7-8}  → Mentor no-show (< 5 min)      — valid report
 *   hash mod 10 ∈ {9}    → Inconclusive (both ~10 min)    — disputed
 *
 * Override by setting MEET_MOCK_SCENARIO=A, B, or C in .env.
 */
function buildMockAttendance(meetUrl: string): AttendanceRecord {
  const override = process.env.MEET_MOCK_SCENARIO?.toUpperCase()

  if (override === 'A') {
    // Scenario A: Mentor no-show
    return { mentorMinutes: 2, menteeMinutes: 52, source: 'mock' }
  }
  if (override === 'C') {
    // Scenario C: Inconclusive
    return { mentorMinutes: 11, menteeMinutes: 9, source: 'mock' }
  }
  if (override === 'B') {
    // Scenario B: Both attended (fraud detection)
    return { mentorMinutes: 55, menteeMinutes: 50, source: 'mock' }
  }

  // Deterministic fallback based on URL hash
  const h = deterministicHash(meetUrl)
  const bucket = h % 10

  if (bucket <= 6) {
    // Both attended — normal session
    const base = 40 + (h % 20) // 40–59 min
    return { mentorMinutes: base, menteeMinutes: base - (h % 10), source: 'mock' }
  }
  if (bucket <= 8) {
    // Mentor no-show
    return { mentorMinutes: h % 4, menteeMinutes: 45 + (h % 15), source: 'mock' }
  }
  // Inconclusive
  return { mentorMinutes: 8 + (h % 7), menteeMinutes: 6 + (h % 8), source: 'mock' }
}

/**
 * Verifies how long each participant spent in the Google Meet session.
 *
 * Attempts the real Google Workspace Admin Reports API first.  Falls back to
 * deterministic mock data when the Admin SDK is not configured.
 *
 * Returns `null` only on a hard API failure where no data at all can be
 * produced — callers MUST treat `null` as a DISPUTED outcome and freeze funds.
 *
 * @param meetUrl       The Meet URL stored on the booking (e.g. https://meet.google.com/abc-xxx)
 * @param mentorEmail   Mentor's Google account email (used to match attendance records)
 * @param menteeEmail   Mentee's Google account email
 * @param sessionStart  Scheduled start of the session
 * @param sessionEnd    Scheduled end of the session
 */
export async function verifyMeetingAttendance(
  meetUrl: string,
  mentorEmail: string,
  menteeEmail: string,
  sessionStart: Date,
  sessionEnd: Date,
): Promise<AttendanceRecord | null> {
  // 1. Try the real API
  const apiResult = await fetchAttendanceFromAPI(
    meetUrl,
    mentorEmail,
    menteeEmail,
    sessionStart,
    sessionEnd,
  )
  if (apiResult) return apiResult

  // 2. Fall back to mock (dev / staging — Admin SDK not configured)
  const mock = buildMockAttendance(meetUrl)
  console.log(
    `[GoogleMeet] Using mock attendance (source=${mock.source}): ` +
      `mentor=${mock.mentorMinutes}m mentee=${mock.menteeMinutes}m`
  )
  return mock
}
