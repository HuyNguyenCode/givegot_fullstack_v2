export const FIXED_NOW = new Date('2026-09-12T00:00:00.000Z')

export type AuthenticatedActor = Readonly<{
  id: string
  role: 'USER' | 'ADMIN'
}>

export function fixedClock(now: Date = FIXED_NOW) {
  const instant = new Date(now.getTime())
  return { now: () => new Date(instant.getTime()) }
}

export function authenticatedActor(id = 'actor-1', role: AuthenticatedActor['role'] = 'USER'): AuthenticatedActor {
  return Object.freeze({ id, role })
}

export function prismaMock<T extends object>(overrides: T): T {
  return overrides
}
