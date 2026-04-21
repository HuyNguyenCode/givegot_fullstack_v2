'use server'

import { google } from 'googleapis'

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
