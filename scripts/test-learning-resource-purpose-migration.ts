import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes, X509Certificate } from 'node:crypto'
import { mkdtempSync, readFileSync, realpathSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import tls from 'node:tls'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = {
  baseline: path.join(root, 'tests/learning-hub/fixtures/pre-b1-legacy-schema.sql'),
  legacy: path.join(root, 'tests/learning-hub/fixtures/representative-legacy-bookings.sql'),
  b1: path.join(root, 'prisma/migrations-manual/004_learning_hub_domain_schema.sql'),
  g1: path.join(root, 'prisma/migrations-manual/005_learning_task_version.sql'),
  forward: path.join(root, 'prisma/migrations-manual/006_learning_resource_purpose.sql'),
  rollback: path.join(root, 'prisma/migrations-manual/006_learning_resource_purpose.rollback.sql'),
}

type Approval = Partial<Pick<NodeJS.ProcessEnv,
  'DISPOSABLE_TEST_DATABASE_URL' | 'DATABASE_URL' | 'DIRECT_URL' |
  'D0A_ALLOW_REMOTE_SUPABASE' | 'D0A_APPROVED_SUPABASE_PROJECT_REF' |
  'D0A_SUPABASE_CA_CERT_PATH' | 'D0A_APPROVED_SUPABASE_CA_SHA256'>>

type CertificateFacts = {
  pem: Buffer
  path: string
  fingerprint: string
  validFrom: number
  validTo: number
  ca: boolean
  selfIssued: boolean
  selfSigned: boolean
}

type CaLoader = (certificatePath: string) => CertificateFacts
type ConnectionDependencies = { now?: number; loadCa?: CaLoader }
export type StrictX509Diagnostic = 'PASS' | 'KNOWN_SUPABASE_INTERMEDIATE_KEY_USAGE_LIMITATION'
export type RemoteTlsResult = { strictX509: StrictX509Diagnostic }
export type TlsProbe = (hostname: string, port: number, ca: Buffer, approvedCaFingerprint: string) => Promise<RemoteTlsResult>
export type ApprovedConnection = { url: string; remote: boolean; ca?: CertificateFacts }
export type VerifierMode = 'rehearsal' | 'preflight-only'

type ReadOnlyPrismaClient = Pick<PrismaClient, '$queryRawUnsafe' | '$disconnect'>
type PrismaCliProbeResult = { status: number | null; error?: Error }
export type PrismaCliProbe = (url: string, sql: string) => PrismaCliProbeResult
type RemotePreflightDependencies = {
  verifyTls?: typeof verifyRemoteTls
  createClient?: (url: string) => ReadOnlyPrismaClient
  verifyClient?: typeof verifyPrismaClientConnectivity
  verifyRole?: typeof verifyRemoteRole
  verifyCli?: (url: string) => void | Promise<void>
}
type VerifierDependencies = {
  approveConnection?: typeof approvedRemoteConnection
  runPreflight?: typeof runRemotePreflight
  runRehearsal?: typeof runMigrationRehearsal
  report?: (message: string) => void
}

const projectRefPattern = /^[a-z0-9]{20}$/
const fingerprintPattern = /^[A-F0-9]{64}$/
const roleName = 'd0a_verifier'
const runSchemaPattern = /^d0a_(?:clean|legacy|failure)_[a-f0-9]{32}$/
const keyUsageOid = Buffer.from([0x06, 0x03, 0x55, 0x1d, 0x0f])
let currentStage = 'startup'

function markStage(stage: string): void {
  currentStage = stage
  console.log(`D0a stage: ${stage}`)
}

export function sanitizedDiagnostic(error: unknown, connectionUrl?: string): string {
  const candidate = error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error)
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : ''
  let message = candidate.replace(/\u001b\[[0-9;]*m/g, '')
  for (const value of [
    connectionUrl,
    process.env.DISPOSABLE_TEST_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
  ]) {
    if (!value) continue
    message = message.replaceAll(value, '[redacted database URL]')
    try {
      const parsed = new URL(value)
      for (const secret of [parsed.password, decodeURIComponent(parsed.password)]) {
        if (secret) message = message.replaceAll(secret, '[redacted credential]')
      }
    } catch { /* malformed values are redacted by the generic URL rule below */ }
  }
  message = message
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[redacted database URL]')
    .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted credential]')
    .replace(/\s+/g, ' ')
    .trim()
  return `${code ? `[${code}] ` : ''}${message || 'unknown error'}`.slice(0, 1200)
}

function normalizeFingerprint(value: string): string {
  return value.replaceAll(':', '').trim().toUpperCase()
}

function loadCa(certificatePath: string): CertificateFacts {
  assert.ok(path.isAbsolute(certificatePath), 'Remote CA path must be absolute')
  const resolved = realpathSync(certificatePath)
  assert.ok(statSync(resolved).isFile(), 'Remote CA path must name a file')
  const pem = readFileSync(resolved)
  let certificate: X509Certificate
  try { certificate = new X509Certificate(pem) }
  catch { throw new Error('Remote CA certificate is invalid') }
  return {
    pem,
    path: resolved,
    fingerprint: normalizeFingerprint(certificate.fingerprint256),
    validFrom: Date.parse(certificate.validFrom),
    validTo: Date.parse(certificate.validTo),
    ca: certificate.ca,
    selfIssued: certificate.subject === certificate.issuer,
    selfSigned: certificate.verify(certificate.publicKey),
  }
}

export function approvedRemoteConnection(env: Approval, dependencies: ConnectionDependencies = {}): ApprovedConnection {
  const value = env.DISPOSABLE_TEST_DATABASE_URL
  assert.ok(value, 'DISPOSABLE_TEST_DATABASE_URL is required')
  if (value === env.DATABASE_URL || value === env.DIRECT_URL) {
    throw new Error('Test connection matches an application connection')
  }
  let parsed: URL
  try { parsed = new URL(value) }
  catch { throw new Error('Malformed test database URL') }
  assert.ok(['postgresql:', 'postgres:'].includes(parsed.protocol), 'PostgreSQL URL required')
  assert.ok(parsed.username && parsed.pathname && !parsed.hash, 'Incomplete test database URL')
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)
  if (local) {
    assert.ok(!parsed.searchParams.has('schema') && !parsed.searchParams.has('options') && !parsed.searchParams.has('pgbouncer'), 'Unsafe connection options')
    assert.ok([...parsed.searchParams.keys()].every(key => key === 'sslmode'), 'Unsupported connection options')
    assert.ok(parsed.searchParams.getAll('sslmode').length <= 1, 'Ambiguous SSL mode')
    assert.match(decodeURIComponent(parsed.pathname.slice(1)), /(?:^|[_-])(?:test|disposable|scratch)(?:[_-]|$)/i, 'Local database must be disposable')
    return { url: value, remote: false }
  }

  // Remote callers supply identity only. Every TLS and pool option is injected below.
  assert.equal([...parsed.searchParams.keys()].length, 0, 'Remote connection options must be verifier-controlled')
  assert.ok(parsed.password, 'Remote test database password required')
  assert.equal(env.D0A_ALLOW_REMOTE_SUPABASE, 'I_APPROVE_REMOTE_D0A_TEST', 'Remote test requires explicit opt-in')
  const approved = env.D0A_APPROVED_SUPABASE_PROJECT_REF
  assert.ok(approved && projectRefPattern.test(approved), 'Exact approved Supabase project ref required')
  assert.equal(parsed.pathname, '/postgres', 'Supabase database must be postgres')
  assert.equal(parsed.port, '5432', 'Only direct or session mode is supported')
  assert.ok(!parsed.username.includes('%') && !parsed.hostname.endsWith('.'), 'Ambiguous Supabase identity')
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname)
  const pooler = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(parsed.hostname)
  assert.ok(direct || pooler, 'Unapproved Supabase host')
  assert.equal(decodeURIComponent(parsed.username), direct ? roleName : `${roleName}.${approved}`, 'Dedicated verifier role required')
  assert.equal(direct?.[1] ?? projectRefFromUrl(value), approved, 'Supabase project ref mismatch')
  for (const configured of [env.DATABASE_URL, env.DIRECT_URL]) {
    assert.notEqual(configured && projectRefFromUrl(configured), approved, 'Approved project matches an application project')
  }

  const certificatePath = env.D0A_SUPABASE_CA_CERT_PATH
  assert.ok(certificatePath, 'Remote Supabase CA path required')
  const approvedFingerprint = normalizeFingerprint(env.D0A_APPROVED_SUPABASE_CA_SHA256 ?? '')
  assert.match(approvedFingerprint, fingerprintPattern, 'Approved Supabase CA fingerprint required')
  let ca: CertificateFacts
  try { ca = (dependencies.loadCa ?? loadCa)(certificatePath) }
  catch { throw new Error('Remote CA certificate could not be loaded') }
  assert.equal(normalizeFingerprint(ca.fingerprint), approvedFingerprint, 'Remote CA fingerprint mismatch')
  const now = dependencies.now ?? Date.now()
  assert.ok(Number.isFinite(ca.validFrom) && now >= ca.validFrom, 'Remote CA certificate is not yet valid')
  assert.ok(Number.isFinite(ca.validTo) && now <= ca.validTo, 'Remote CA certificate is expired')
  assert.ok(ca.ca && ca.selfIssued && ca.selfSigned, 'Remote CA certificate is not a usable self-signed root')

  // Prisma 5.22's native PostgreSQL connector consumes sslcert as an additional
  // trusted root. It does not consume sslrootcert, and unsupported sslmode values
  // fall back instead of failing closed. Keep this exact, verifier-owned option set;
  // verifyRemoteTls separately proves the approved chain and hostname pre-auth.
  parsed.searchParams.set('sslmode', 'require')
  parsed.searchParams.set('sslcert', ca.path)
  parsed.searchParams.set('sslaccept', 'strict')
  parsed.searchParams.set('connect_timeout', '5')
  parsed.searchParams.set('pool_timeout', '5')
  parsed.searchParams.set('connection_limit', '1')
  return { url: parsed.toString(), remote: true, ca }
}

function projectRefFromUrl(value: string): string | null {
  try {
    const url = new URL(value)
    const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)
    if (direct) return direct[1]
    if (/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)) {
      return /\.([a-z0-9]{20})$/.exec(decodeURIComponent(url.username))?.[1] ?? null
    }
  } catch { /* unrelated configuration is not a project identity */ }
  return null
}

export function disposableUrl(env: Approval, dependencies: ConnectionDependencies = {}): string {
  return approvedRemoteConnection(env, dependencies).url
}

export function parseVerifierMode(args: string[]): VerifierMode {
  if (args.length === 0) return 'rehearsal'
  if (args.length === 1 && args[0] === '--preflight-only') return 'preflight-only'
  throw new Error('Unsupported D0a verifier arguments')
}

type PeerCertificateFacts = {
  subject: string
  issuer: string
  fingerprint: string
  ca: boolean
  hasKeyUsage: boolean
}

export function classifyStrictX509Diagnostic(
  chain: PeerCertificateFacts[], approvedCaFingerprint: string,
): StrictX509Diagnostic {
  const rootFingerprint = normalizeFingerprint(approvedCaFingerprint)
  const root = chain.find(certificate => normalizeFingerprint(certificate.fingerprint) === rootFingerprint)
  assert.ok(root?.ca, 'TLS chain does not terminate at the approved CA')
  const missingKeyUsage = chain.filter((certificate, index) =>
    index > 0 && normalizeFingerprint(certificate.fingerprint) !== rootFingerprint &&
    certificate.ca && !certificate.hasKeyUsage)
  if (missingKeyUsage.length === 0) return 'PASS'
  const known = missingKeyUsage.length === 1 &&
    /CN=Supabase Intermediate 2021 CA(?:\n|,|$)/.test(missingKeyUsage[0].subject) &&
    /CN=Supabase Root 2021 CA(?:\n|,|$)/.test(missingKeyUsage[0].issuer)
  assert.ok(known, 'Unrecognized X509_STRICT certificate limitation')
  return 'KNOWN_SUPABASE_INTERMEDIATE_KEY_USAGE_LIMITATION'
}

function certificateFacts(raw: Buffer): PeerCertificateFacts {
  const certificate = new X509Certificate(raw)
  return {
    subject: certificate.subject,
    issuer: certificate.issuer,
    fingerprint: normalizeFingerprint(certificate.fingerprint256),
    ca: certificate.ca,
    hasKeyUsage: raw.indexOf(keyUsageOid) >= 0,
  }
}

function peerChain(socket: tls.TLSSocket, approvedCa: Buffer): PeerCertificateFacts[] {
  const chain: PeerCertificateFacts[] = []
  const seen = new Set<string>()
  let peer = socket.getPeerCertificate(true)
  while (peer?.raw) {
    const facts = certificateFacts(peer.raw)
    if (seen.has(facts.fingerprint)) break
    seen.add(facts.fingerprint)
    chain.push(facts)
    peer = peer.issuerCertificate
  }
  const approvedRoot = certificateFacts(approvedCa)
  if (!seen.has(approvedRoot.fingerprint)) chain.push(approvedRoot)
  return chain
}

const nodeTlsProbe: TlsProbe = (hostname, port, ca, approvedCaFingerprint) => new Promise((resolve, reject) => {
  let settled = false
  const finish = (error?: Error, result?: RemoteTlsResult): void => {
    if (settled) return
    settled = true
    clearTimeout(deadline)
    socket.destroy()
    if (error) reject(error)
    else resolve(result!)
  }
  const socket = net.createConnection({ host: hostname, port })
  const deadline = setTimeout(() => finish(new Error('Remote TLS preflight timed out')), 8_000)
  socket.once('connect', () => {
    const request = Buffer.alloc(8)
    request.writeInt32BE(8, 0)
    request.writeInt32BE(80877103, 4)
    socket.write(request)
  })
  socket.once('data', response => {
    if (response[0] !== 0x53) return finish(new Error('Remote database refused TLS'))
    socket.removeAllListeners('data')
    const secure = tls.connect({
      socket,
      servername: hostname,
      ca: [ca],
      rejectUnauthorized: true,
      checkServerIdentity: tls.checkServerIdentity,
      minVersion: 'TLSv1.2',
    })
    secure.once('secureConnect', () => {
      try {
        assert.equal(secure.authorized, true, 'Remote TLS chain verification failed')
        resolve({ strictX509: classifyStrictX509Diagnostic(peerChain(secure, ca), approvedCaFingerprint) })
        settled = true
        clearTimeout(deadline)
        secure.destroy()
      } catch (error) {
        secure.destroy()
        finish(error instanceof Error ? error : new Error('Remote TLS verification failed'))
      }
    })
    secure.once('error', () => finish(new Error('Remote TLS chain or hostname verification failed')))
  })
  socket.once('error', () => finish(new Error('Remote TLS connection failed')))
})

export async function verifyRemoteTls(connection: ApprovedConnection, probe: TlsProbe = nodeTlsProbe): Promise<RemoteTlsResult> {
  assert.ok(connection.remote && connection.ca, 'Remote TLS preflight requires approved CA configuration')
  const parsed = new URL(connection.url)
  try {
    return await probe(parsed.hostname, Number(parsed.port), connection.ca.pem, connection.ca.fingerprint)
  } catch {
    throw new Error('Remote TLS chain or hostname verification failed')
  }
}

function schemaUrl(base: string, schema: string): string {
  const parsed = new URL(base)
  parsed.searchParams.set('schema', schema)
  return parsed.toString()
}

export function scopedSql(sql: string, schema: string): string {
  assert.match(schema, runSchemaPattern)
  const withoutComments = sql.replace(/--[^\n]*/g, '')
  assert.doesNotMatch(withoutComments, /\b(?:public|auth|storage|extensions)\s*\.|"(?:public|auth|storage|extensions)"\s*\.|\b(?:CREATE|DROP|ALTER)\s+(?:EXTENSION|SCHEMA)\b|\bSET\s+(?:LOCAL\s+)?(?:ROLE|SESSION\s+AUTHORIZATION|search_path)\b|\bset_config\s*\(/i, 'SQL would escape the test schema')
  const scope = `SET LOCAL search_path = "${schema}", pg_catalog;\nDO $$ BEGIN IF current_schema() IS DISTINCT FROM '${schema}' THEN RAISE EXCEPTION 'D0a schema scope missing'; END IF; END $$;\n`
  if (/^BEGIN;/m.test(sql)) {
    assert.match(sql, /^\s*(?:--[^\n]*\n)*BEGIN;/)
    assert.match(sql, /\nCOMMIT;\s*$/)
    return sql.replace(/^((?:\s*--[^\n]*\n)*\s*BEGIN;)/, match => `${match}\n${scope}`)
  }
  assert.doesNotMatch(withoutComments, /\b(?:COMMIT|ROLLBACK)\b/i)
  return `BEGIN;\n${scope}${sql}\nCOMMIT;\n`
}

function sqlFile(url: string, file: string, schema: string, temporary: string, expectedError?: RegExp): void {
  const scopedFile = path.join(temporary, 'scoped.sql')
  writeFileSync(scopedFile, scopedSql(readFileSync(file, 'utf8'), schema))
  const prismaCli = path.join(root, 'node_modules/prisma/build/index.js')
  const result = spawnSync(process.execPath, [prismaCli, 'db', 'execute', '--schema', path.join(root, 'prisma/schema.prisma'), '--file', scopedFile], {
    cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  })
  if (result.error || result.status === null) throw new Error(`SQL verifier could not start: ${path.basename(file)}`)
  if (!expectedError && result.status !== 0) {
    const detail = sanitizedDiagnostic(`${result.stderr}\n${result.stdout}`, url)
    throw new Error(`SQL failed: ${path.basename(file)}: ${detail}`)
  }
  else {
    if (expectedError) {
      assert.notEqual(result.status, 0, `Expected SQL failure: ${path.basename(file)}`)
      assert.match(`${result.stderr}\n${result.stdout}`, expectedError, `Expected SQL error absent: ${path.basename(file)}`)
    }
  }
}

async function withClient<T>(url: string, schema: string, action: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const client = new PrismaClient({ datasources: { db: { url } } })
  try {
    return await client.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path = "${schema}", pg_catalog`)
      const scope = await tx.$queryRawUnsafe<Array<{ schema: string }>>('SELECT current_schema() AS schema')
      assert.equal(scope[0]?.schema, schema, 'D0a schema scope missing')
      return action(tx)
    })
  }
  finally { await client.$disconnect() }
}

async function purposeObjects(client: Prisma.TransactionClient) {
  const types = await client.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema() AND t.typname = 'LearningResourcePurpose'
  `)
  const columns = await client.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'LearningResource' AND column_name = 'purpose'
  `)
  return { types: types[0]?.count ?? 0, columns: columns[0]?.count ?? 0 }
}

async function seedLegacyResources(client: Prisma.TransactionClient): Promise<void> {
  await client.$executeRawUnsafe(`INSERT INTO "LearningSpace" ("id", "title", "primarySkillId", "createdById")
    VALUES ('d0a-space', 'Legacy space', 'legacy-skill', 'legacy-mentor')`)
  await client.$executeRawUnsafe(`INSERT INTO "LearningTopic" ("id", "learningSpaceId", "label", "normalizedLabel", "creatorId")
    VALUES ('d0a-topic', 'd0a-space', 'Old topic', 'old topic', 'legacy-mentor')`)
  await client.$executeRawUnsafe(`INSERT INTO "LearningResource"
    ("id", "learningSpaceId", "bookingId", "uploaderId", "kind", "title", "storageKey", "mimeType", "sizeBytes", "status")
    VALUES ('d0a-file', 'd0a-space', 'legacy-confirmed', 'legacy-mentee', 'FILE', 'old.pdf', 'spaces/old.pdf', 'application/pdf', 123, 'READY')`)
  await client.$executeRawUnsafe(`INSERT INTO "LearningResource"
    ("id", "learningSpaceId", "topicId", "uploaderId", "kind", "title", "externalUrl", "status")
    VALUES ('d0a-link', 'd0a-space', 'd0a-topic', 'legacy-mentor', 'LINK', 'Old link', 'https://example.test/old', 'READY')`)
  await client.$executeRawUnsafe(`INSERT INTO "LearningTask"
    ("id", "learningSpaceId", "creatorId", "assigneeId", "title", "acceptanceCriteria")
    VALUES ('d0a-task', 'd0a-space', 'legacy-mentor', 'legacy-mentee', 'Old task', 'Deliver file')`)
  await client.$executeRawUnsafe(`INSERT INTO "Submission" ("id", "taskId", "authorId", "attachmentResourceId")
    VALUES ('d0a-submission', 'd0a-task', 'legacy-mentee', 'd0a-file')`)
}

async function verifyLegacy(client: Prisma.TransactionClient, withPurpose: boolean): Promise<void> {
  const rows = await client.$queryRawUnsafe<Array<{
    id: string; bookingId: string | null; topicId: string | null; storageKey: string | null; externalUrl: string | null; purpose?: string
  }>>(`SELECT "id", "bookingId", "topicId", "storageKey", "externalUrl"${withPurpose ? ', "purpose"::text AS purpose' : ''}
    FROM "LearningResource" WHERE "id" IN ('d0a-file', 'd0a-link') ORDER BY "id"`)
  assert.deepEqual(rows.map(row => row.id), ['d0a-file', 'd0a-link'])
  assert.equal(rows[0]?.bookingId, 'legacy-confirmed')
  assert.equal(rows[0]?.storageKey, 'spaces/old.pdf')
  assert.equal(rows[1]?.topicId, 'd0a-topic')
  assert.equal(rows[1]?.externalUrl, 'https://example.test/old')
  if (withPurpose) assert.deepEqual(rows.map(row => row.purpose), ['LEGACY_UNCLASSIFIED', 'LEGACY_UNCLASSIFIED'])
  const references = await client.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count FROM "Submission" s
    JOIN "LearningTask" t ON t."id" = s."taskId"
    JOIN "LearningResource" r ON r."id" = s."attachmentResourceId"
    WHERE s."id" = 'd0a-submission' AND t."id" = 'd0a-task' AND r."id" = 'd0a-file'
  `)
  assert.equal(references[0]?.count, 1)
  const bookings = await client.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count FROM "Booking" WHERE "id" LIKE 'legacy-%'
  `)
  assert.equal(bookings[0]?.count, 6)
}

type CatalogClient = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>
type OwnedSchema = { name: string; oid: number; objects: Set<string> }

async function schemaObjects(client: CatalogClient, schema: string): Promise<Array<{ oid: number; kind: string; name: string }>> {
  return client.$queryRawUnsafe<Array<{ oid: number; kind: string; name: string }>>(`
    SELECT c.oid::int AS oid, c.relkind::text AS kind, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1
    UNION ALL
    SELECT t.oid::int, 'enum', t.typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1 AND t.typtype = 'e'
  `, schema)
}

async function rememberObjects(client: CatalogClient, owned: OwnedSchema): Promise<void> {
  for (const object of await schemaObjects(client, owned.name)) {
    owned.objects.add(`${object.kind}:${object.name}:${object.oid}`)
  }
}

export async function createOwnedSchema(client: CatalogClient, schema: string): Promise<OwnedSchema> {
  assert.match(schema, runSchemaPattern)
  const existing = await client.$queryRawUnsafe<Array<{ oid: number }>>(
    'SELECT oid::int AS oid FROM pg_namespace WHERE nspname = $1', schema,
  )
  assert.equal(existing.length, 0, 'Generated schema already exists; refusing collision')
  await client.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
  const created = await client.$queryRawUnsafe<Array<{ oid: number }>>(
    'SELECT oid::int AS oid FROM pg_namespace WHERE nspname = $1 AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)', schema,
  )
  assert.equal(created.length, 1, 'Created schema ownership could not be verified')
  return { name: schema, oid: created[0].oid, objects: new Set() }
}

const dropTables = [
  'SubmissionReview', 'Submission', 'LearningActivity', 'LearningNote', 'LearningTask',
  'LearningResource', 'LearningInvite', 'LearningSpaceMember', 'Booking', 'LearningTopic',
  'LearningSpace', 'Skill', 'User',
]
const dropTypes = [
  'LearningResourcePurpose', 'LearningNoteVisibility', 'SubmissionReviewOutcome',
  'SubmissionStatus', 'LearningTaskStatus', 'LearningResourceStatus', 'LearningResourceKind',
  'LearningInviteStatus', 'LearningTopicStatus', 'LearningSpaceMemberStatus',
  'LearningSpaceStatus', 'FulfillmentStatus', 'LearningMode', 'BookingStatus',
]

export async function cleanupOwnedSchema(client: CatalogClient, owned: OwnedSchema): Promise<void> {
  assert.match(owned.name, runSchemaPattern)
  const current = await client.$queryRawUnsafe<Array<{ oid: number }>>(
    'SELECT oid::int AS oid FROM pg_namespace WHERE nspname = $1 AND nspowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)', owned.name,
  )
  assert.equal(current.length, 1, 'Owned schema disappeared or changed owner; cleanup refused')
  assert.equal(current[0].oid, owned.oid, 'Schema name was reused; cleanup refused')
  for (const object of await schemaObjects(client, owned.name)) {
    assert.ok(owned.objects.has(`${object.kind}:${object.name}:${object.oid}`), 'Unknown object in run schema; cleanup refused')
  }
  // RESTRICT leaves outside dependencies untouched; an unsafe dependency blocks cleanup.
  for (const table of dropTables) await client.$executeRawUnsafe(`DROP TABLE IF EXISTS "${owned.name}"."${table}" RESTRICT`)
  for (const type of dropTypes) await client.$executeRawUnsafe(`DROP TYPE IF EXISTS "${owned.name}"."${type}" RESTRICT`)
  await client.$executeRawUnsafe(`DROP SCHEMA "${owned.name}" RESTRICT`)
}

export async function verifyRemoteRole(client: Pick<PrismaClient, '$queryRawUnsafe'>): Promise<void> {
  const identity = await client.$queryRawUnsafe<Array<{
    database: string; role: string; superuser: boolean; createRole: boolean; createDb: boolean;
    replicate: boolean; bypassRls: boolean; canCreateDbObject: boolean; memberOfAdmin: boolean;
  }>>(`
    SELECT current_database() AS database, current_user AS role, r.rolsuper AS "superuser",
      r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDb", r.rolreplication AS replicate,
      r.rolbypassrls AS "bypassRls", has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreateDbObject",
      (pg_has_role(current_user, 'postgres', 'MEMBER') OR pg_has_role(current_user, 'supabase_admin', 'MEMBER')) AS "memberOfAdmin"
    FROM pg_roles r WHERE r.rolname = current_user
  `)
  const role = identity[0]
  assert.ok(role && role.database === 'postgres' && role.role === roleName, 'Unexpected remote database identity')
  assert.ok(!role.superuser && !role.createRole && !role.createDb && !role.replicate && !role.bypassRls && !role.memberOfAdmin, 'Verifier role is privileged')
  assert.ok(role.canCreateDbObject, 'Verifier role cannot create isolated schemas')
  const writableSchemas = await client.$queryRawUnsafe<Array<{ name: string }>>(`
    SELECT n.nspname AS name FROM pg_namespace n
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND has_schema_privilege(current_user, n.oid, 'CREATE')
  `)
  assert.equal(writableSchemas.length, 0, 'Verifier role can write to an existing schema')
  const writableObjects = await client.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
      AND ((c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND (has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege(current_user, c.oid, 'INSERT,UPDATE,REFERENCES')))
        OR (c.relkind = 'S' AND has_sequence_privilege(current_user, c.oid, 'UPDATE')))
  `)
  assert.equal(writableObjects[0]?.count, 0, 'Verifier role can write to existing objects')
}

export async function verifyPrismaClientConnectivity(
  client: Pick<PrismaClient, '$queryRawUnsafe'>,
): Promise<void> {
  const rows = await client.$queryRawUnsafe<Array<{ connected: number }>>('SELECT 1::int AS connected')
  assert.equal(rows.length, 1, 'Prisma Client connectivity check returned an unexpected result')
  assert.equal(rows[0]?.connected, 1, 'Prisma Client connectivity check failed')
}

export const PRISMA_CLI_PREFLIGHT_SQL = [
  'BEGIN TRANSACTION READ ONLY;',
  'SELECT current_database(), current_user;',
  'ROLLBACK;',
  '',
].join('\n')

const prismaCliProbe: PrismaCliProbe = (url, sql) => {
  const prismaCli = path.join(root, 'node_modules/prisma/build/index.js')
  const result = spawnSync(process.execPath, [
    prismaCli, 'db', 'execute', '--schema', path.join(root, 'prisma/schema.prisma'), '--stdin',
  ], {
    cwd: root,
    encoding: 'utf8',
    input: sql,
    timeout: 12_000,
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  })
  return { status: result.status, error: result.error }
}

export function verifyPrismaCliConnectivity(url: string, probe: PrismaCliProbe = prismaCliProbe): void {
  const result = probe(url, PRISMA_CLI_PREFLIGHT_SQL)
  assert.ok(!result.error && result.status === 0, 'Prisma CLI read-only connectivity check failed')
}

export async function runRemotePreflight(
  connection: ApprovedConnection,
  dependencies: RemotePreflightDependencies = {},
): Promise<RemoteTlsResult> {
  assert.ok(connection.remote && connection.ca, 'Preflight-only requires an approved remote TEST connection')
  const tlsResult = await (dependencies.verifyTls ?? verifyRemoteTls)(connection)
  const client = (dependencies.createClient ?? (url => new PrismaClient({ datasources: { db: { url } } })))(connection.url)
  try {
    await (dependencies.verifyClient ?? verifyPrismaClientConnectivity)(client)
    await (dependencies.verifyRole ?? verifyRemoteRole)(client)
    await (dependencies.verifyCli ?? verifyPrismaCliConnectivity)(connection.url)
  } finally {
    await client.$disconnect()
  }
  return tlsResult
}

async function runMigrationRehearsal(connection: ApprovedConnection): Promise<void> {
  const base = connection.url
  const remote = connection.remote
  const schemas = ['clean', 'legacy', 'failure'].map(kind => `d0a_${kind}_${randomBytes(16).toString('hex')}`)
  const createdSchemas: OwnedSchema[] = []
  const admin = new PrismaClient({ datasources: { db: { url: base } } })
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'd0a-migration-'))
  const faultFile = path.join(temporary, 'fault.sql')
  let cleanupError: Error | undefined
  try {
    if (remote) {
      markStage('remote TLS check')
      const tlsResult = await verifyRemoteTls(connection)
      if (tlsResult.strictX509 === 'PASS') console.log('D0a TLS: verify-full passed; X509_STRICT diagnostic passed')
      else console.warn('D0a TLS: verify-full passed; known Supabase intermediate X509_STRICT Key Usage limitation observed')
      markStage('remote role check')
      await verifyRemoteRole(admin)
    }
    for (const [index, schema] of schemas.entries()) {
      const kind = ['clean', 'legacy', 'failure'][index]
      markStage(`create ${kind} schema`)
      const owned = await createOwnedSchema(admin, schema)
      createdSchemas.push(owned)
      const url = schemaUrl(base, schema)
      markStage(`baseline ${kind}`)
      sqlFile(url, files.baseline, schema, temporary)
      await rememberObjects(admin, owned)
      if (!schema.includes('_clean_')) {
        markStage(`legacy fixture ${kind}`)
        sqlFile(url, files.legacy, schema, temporary)
      }
      markStage(`migration 004 ${kind}`)
      sqlFile(url, files.b1, schema, temporary)
      await rememberObjects(admin, owned)
      markStage(`migration 005 ${kind}`)
      sqlFile(url, files.g1, schema, temporary)
    }

    const clean = schemaUrl(base, schemas[0])
    markStage('migration 006 clean')
    sqlFile(clean, files.forward, schemas[0], temporary)
    await rememberObjects(admin, createdSchemas[0])
    markStage('verify migration 006 clean')
    await withClient(clean, schemas[0], async client => {
      assert.deepEqual(await purposeObjects(client), { types: 1, columns: 1 })
      const labels = await client.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
        SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = current_schema() AND t.typname = 'LearningResourcePurpose'
        ORDER BY e.enumsortorder
      `)
      assert.deepEqual(labels.map(row => row.enumlabel), ['MATERIAL', 'SUBMISSION_ATTACHMENT', 'LEGACY_UNCLASSIFIED'])
    })
    markStage('rollback clean')
    sqlFile(clean, files.rollback, schemas[0], temporary)
    markStage('verify rollback clean')
    await withClient(clean, schemas[0], async client => assert.deepEqual(await purposeObjects(client), { types: 0, columns: 0 }))

    const legacy = schemaUrl(base, schemas[1])
    markStage('legacy setup')
    await withClient(legacy, schemas[1], seedLegacyResources)
    markStage('migration 006 legacy')
    sqlFile(legacy, files.forward, schemas[1], temporary)
    await rememberObjects(admin, createdSchemas[1])
    markStage('verify legacy migration and classifications')
    await withClient(legacy, schemas[1], async client => {
      await verifyLegacy(client, true)
      await client.$executeRawUnsafe(`INSERT INTO "LearningResource"
        ("id", "learningSpaceId", "uploaderId", "kind", "title", "status")
        VALUES ('d0a-old-writer', 'd0a-space', 'legacy-mentor', 'LINK', 'Old writer', 'READY')`)
      await client.$executeRawUnsafe(`INSERT INTO "LearningResource"
        ("id", "learningSpaceId", "uploaderId", "kind", "title", "status", "purpose") VALUES
        ('d0a-material', 'd0a-space', 'legacy-mentor', 'LINK', 'Material', 'READY', 'MATERIAL'),
        ('d0a-attachment', 'd0a-space', 'legacy-mentee', 'FILE', 'Attachment', 'READY', 'SUBMISSION_ATTACHMENT')`)
      const purposes = await client.$queryRawUnsafe<Array<{ id: string; purpose: string }>>(`
        SELECT "id", "purpose"::text FROM "LearningResource" WHERE "id" LIKE 'd0a-%' ORDER BY "id"
      `)
      assert.equal(purposes.find(row => row.id === 'd0a-old-writer')?.purpose, 'LEGACY_UNCLASSIFIED')
      assert.equal(purposes.find(row => row.id === 'd0a-material')?.purpose, 'MATERIAL')
      assert.equal(purposes.find(row => row.id === 'd0a-attachment')?.purpose, 'SUBMISSION_ATTACHMENT')
    })
    markStage('reject invalid purpose')
    await assert.rejects(withClient(legacy, schemas[1], client => client.$executeRawUnsafe(`INSERT INTO "LearningResource"
      ("id", "learningSpaceId", "uploaderId", "kind", "title", "status", "purpose")
      VALUES ('d0a-invalid', 'd0a-space', 'legacy-mentor', 'LINK', 'Invalid', 'READY', 'UNKNOWN_PURPOSE')`)))
    markStage('verify invalid purpose rollback')
    await withClient(legacy, schemas[1], async client => {
      const invalid = await client.$queryRawUnsafe<Array<{ count: number }>>(`
        SELECT COUNT(*)::int AS count FROM "LearningResource" WHERE "id" = 'd0a-invalid'
      `)
      assert.equal(invalid[0]?.count, 0)
    })
    markStage('classified rollback refusal')
    sqlFile(legacy, files.rollback, schemas[1], temporary, /Resource purpose rollback refused/)
    markStage('verify classified rollback preservation')
    await withClient(legacy, schemas[1], async client => {
      assert.deepEqual(await purposeObjects(client), { types: 1, columns: 1 })
      await verifyLegacy(client, true)
      const preserved = await client.$queryRawUnsafe<Array<{ id: string; purpose: string }>>(`
        SELECT "id", "purpose"::text FROM "LearningResource"
        WHERE "id" IN ('d0a-material', 'd0a-attachment') ORDER BY "id"
      `)
      assert.deepEqual(preserved.map(row => [row.id, row.purpose]), [
        ['d0a-attachment', 'SUBMISSION_ATTACHMENT'],
        ['d0a-material', 'MATERIAL'],
      ])
      await client.$executeRawUnsafe(`DELETE FROM "LearningResource" WHERE "id" IN ('d0a-material', 'd0a-attachment')`)
    })
    markStage('safe rollback legacy')
    sqlFile(legacy, files.rollback, schemas[1], temporary)
    markStage('verify safe rollback legacy')
    await withClient(legacy, schemas[1], async client => {
      assert.deepEqual(await purposeObjects(client), { types: 0, columns: 0 })
      await verifyLegacy(client, false)
    })

    const forward = readFileSync(files.forward, 'utf8')
    assert.match(forward, /\nCOMMIT;\s*$/)
    writeFileSync(faultFile, forward.replace(/\nCOMMIT;\s*$/, '\nSELECT 1 / 0;\nCOMMIT;\n'))
    const failure = schemaUrl(base, schemas[2])
    markStage('atomic failure injection')
    sqlFile(failure, faultFile, schemas[2], temporary, /division by zero/i)
    markStage('verify atomic failure rollback')
    await withClient(failure, schemas[2], async client => assert.deepEqual(await purposeObjects(client), { types: 0, columns: 0 }))

  } finally {
    try { unlinkSync(faultFile) } catch { /* file may not have been written */ }
    try { unlinkSync(path.join(temporary, 'scoped.sql')) } catch { /* file may not have been written */ }
    try { rmdirSync(temporary) } catch { /* do not hide migration failure */ }
    for (const owned of createdSchemas.reverse()) {
      try { await cleanupOwnedSchema(admin, owned) }
      catch (error) {
        currentStage = `cleanup ${owned.name.replace(/_[a-f0-9]{32}$/, '')}`
        cleanupError = new Error(`D0a cleanup refused or failed: ${sanitizedDiagnostic(error, base)}`)
      }
    }
    await admin.$disconnect()
    if (cleanupError) throw cleanupError
  }
  console.log('PASS: D0a clean/legacy migration, defaults, classifications, references, guarded rollback, atomic failure, and cleanup')
}

export async function runVerifier(
  args: string[],
  env: Approval,
  dependencies: VerifierDependencies = {},
): Promise<VerifierMode> {
  currentStage = 'argument validation'
  const mode = parseVerifierMode(args)
  currentStage = 'connection approval'
  const connection = (dependencies.approveConnection ?? approvedRemoteConnection)(env)
  if (mode === 'preflight-only') {
    assert.ok(connection.remote && connection.ca, 'Preflight-only requires an approved remote TEST connection')
    const result = await (dependencies.runPreflight ?? runRemotePreflight)(connection)
    const diagnostic = result.strictX509 === 'PASS'
      ? 'X509_STRICT diagnostic passed'
      : 'known Supabase intermediate X509_STRICT Key Usage limitation observed'
    const report = dependencies.report ?? console.log
    report(
      `PASS: D0a read-only remote preflight (TLS, Prisma Client, identity, privileges, Prisma CLI); ${diagnostic}`,
    )
    return mode
  }
  await (dependencies.runRehearsal ?? runMigrationRehearsal)(connection)
  return mode
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runVerifier(process.argv.slice(2), process.env as Approval).catch(error => {
    console.error(`D0a verification failed at ${currentStage}: ${sanitizedDiagnostic(error)}`)
    process.exitCode = 1
  })
}
