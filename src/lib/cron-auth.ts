import { NextResponse } from 'next/server'

export const LOCAL_CRON_BYPASS_HEADER = 'x-givegot-local-cron'

export type CronEnvironment = Readonly<{
  nodeEnv: string | undefined
  cronSecret: string | undefined
}>

function currentCronEnvironment(): CronEnvironment {
  return {
    nodeEnv: process.env.NODE_ENV,
    cronSecret: process.env.CRON_SECRET,
  }
}

/**
 * Production always requires a configured, matching CRON_SECRET. Local tests
 * may opt into a header-only bypass, but the NODE_ENV check makes that path
 * unreachable in production even if the header is sent.
 */
export function authorizeCronRequest(
  req: Request,
  environment: CronEnvironment = currentCronEnvironment(),
): NextResponse | null {
  const authorization = req.headers.get('authorization')

  if (
    environment.nodeEnv !== 'production' &&
    req.headers.get(LOCAL_CRON_BYPASS_HEADER) === '1'
  ) {
    return null
  }

  if (!environment.cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET environment variable is not set.' },
      { status: 500 },
    )
  }

  if (authorization !== `Bearer ${environment.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
