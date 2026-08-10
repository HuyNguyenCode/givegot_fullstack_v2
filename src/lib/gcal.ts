import { randomUUID } from 'node:crypto'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

/**
 * Creates a Google Calendar event with a unique Google Meet conference using
 * the mentor's stored Google refresh token.
 *
 * This helper is deliberately best-effort: every failure returns null so a
 * successfully committed booking can never be rolled back or reported as
 * failed because of Google Calendar.
 */
export async function createGoogleMeetForMentor(
  mentorId: string,
  mentorEmail: string,
  menteeEmail: string,
  startTime: Date,
  endTime: Date
): Promise<string | null> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId: mentorId,
        provider: 'google',
      },
      select: {
        refresh_token: true,
      },
    })

    if (!account?.refresh_token) {
      console.warn(
        `[GoogleCalendar] Mentor ${mentorId} has no Google refresh token. Skipping event creation.`
      )
      return null
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error(
        '[GoogleCalendar] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Skipping event creation.'
      )
      return null
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    const calendar = google.calendar({
      version: 'v3',
      auth: oauth2Client,
    })

    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: 'GiveGot Mentoring Session',
        description:
          `A mentoring session scheduled through GiveGot.\n\n` +
          `Mentor: ${mentorEmail}\n` +
          `Mentee: ${menteeEmail}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: [
          { email: mentorEmail, displayName: 'Mentor' },
          { email: menteeEmail, displayName: 'Mentee' },
        ],
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      },
    })

    const meetLink =
      response.data.hangoutLink ??
      response.data.conferenceData?.entryPoints?.find(
        (entryPoint) => entryPoint.entryPointType === 'video'
      )?.uri ??
      null

    if (!meetLink) {
      console.warn(
        `[GoogleCalendar] Event created for mentor ${mentorId}, but Google did not return a Meet link.`
      )
    }

    return meetLink
  } catch (error) {
    console.error(
      `[GoogleCalendar] Failed to create a Meet event for mentor ${mentorId}:`,
      error
    )
    return null
  }
}
