import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  approvedRemoteConnection, classifyStrictX509Diagnostic, cleanupOwnedSchema, createOwnedSchema,
  disposableUrl, parseVerifierMode, PRISMA_CLI_PREFLIGHT_SQL, runRemotePreflight, runVerifier,
  sanitizedDiagnostic, scopedSql, verifyPrismaCliConnectivity, verifyPrismaClientConnectivity,
  verifyRemoteRole, verifyRemoteTls,
} from '../../../scripts/test-learning-resource-purpose-migration'

const project = 'abcdefghijklmnopqrst'
const other = 'zyxwvutsrqponmlkjihg'
const schema = `d0a_clean_${'a'.repeat(32)}`
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const caFingerprint = 'A'.repeat(64)
const approve = {
  D0A_ALLOW_REMOTE_SUPABASE: 'I_APPROVE_REMOTE_D0A_TEST',
  D0A_APPROVED_SUPABASE_PROJECT_REF: project,
  D0A_SUPABASE_CA_CERT_PATH: '/approved/supabase-root.crt',
  D0A_APPROVED_SUPABASE_CA_SHA256: caFingerprint,
}
const validCa = {
  pem: Buffer.from('test-ca'), path: '/approved/supabase-root.crt', fingerprint: caFingerprint,
  validFrom: Date.UTC(2025, 0, 1), validTo: Date.UTC(2030, 0, 1), ca: true,
  selfIssued: true, selfSigned: true,
}
const caDependencies = { now: Date.UTC(2026, 0, 1), loadCa: () => validCa }
const pooler = (ref = project, port = 5432) =>
  `postgresql://d0a_verifier.${ref}:fake-password@aws-0-us-east-1.pooler.supabase.com:${port}/postgres`
const direct = (ref = project) =>
  `postgresql://d0a_verifier:fake-password@db.${ref}.supabase.co:5432/postgres`

test('accepts only an explicitly approved direct or session pooler project', () => {
  for (const input of [pooler(), direct()]) {
    const protectedUrl = new URL(disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: input }, caDependencies))
    assert.equal(protectedUrl.searchParams.get('sslmode'), 'require')
    assert.equal(protectedUrl.searchParams.get('sslcert'), validCa.path)
    assert.equal(protectedUrl.searchParams.has('sslrootcert'), false)
    assert.equal(protectedUrl.searchParams.get('sslaccept'), 'strict')
    assert.equal(protectedUrl.searchParams.get('connect_timeout'), '5')
    assert.equal(protectedUrl.searchParams.get('pool_timeout'), '5')
    assert.equal(protectedUrl.searchParams.get('connection_limit'), '1')
    assert.deepEqual([...protectedUrl.searchParams.keys()].sort(), [
      'connect_timeout', 'connection_limit', 'pool_timeout', 'sslaccept', 'sslcert', 'sslmode',
    ])
  }
  assert.equal(disposableUrl({ DISPOSABLE_TEST_DATABASE_URL: 'postgresql://user@localhost:5432/givegot_test' }),
    'postgresql://user@localhost:5432/givegot_test')
})

test('rejects missing approval, mismatched project, and shared host with wrong username', () => {
  assert.throws(() => disposableUrl({ DISPOSABLE_TEST_DATABASE_URL: pooler() }))
  assert.throws(() => disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler(other) }, caDependencies))
  assert.throws(() => disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler().replace(`d0a_verifier.${project}`, `d0a_verifier.${other}`) }, caDependencies))
  assert.throws(() => disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler().replace(`d0a_verifier.${project}`, 'postgres') }, caDependencies))
})

test('rejects malformed URLs, arbitrary hosts, caller TLS options and application projects', () => {
  for (const url of [
    'not a URL',
    `postgresql://d0a_verifier:fake-password@db.${project}.supabase.co:6543/postgres`,
    pooler(project, 6543),
    pooler().replace('pooler.supabase.com', 'pooler.supabase.com.evil.test'),
    `${pooler()}?pgbouncer=true`,
    `${pooler()}?options=-c%20search_path%3Dpublic`,
    `${pooler()}?sslmode=disable`,
    `${pooler()}?sslmode=require`,
    `${pooler()}?sslmode=verify-full`,
    `${pooler()}?sslcert=C%3A%5Cunapproved.crt`,
    `${pooler()}?sslrootcert=C%3A%5Cunapproved.crt`,
    `${pooler()}?sslaccept=accept_invalid_certs`,
    `${pooler()}?sslidentity=C%3A%5Cunapproved.p12`,
    `${pooler()}?sslpassword=unapproved`,
    `${pooler()}?channel_binding=disable`,
    `${pooler()}?connect_timeout=0`,
    `${pooler()}?schema=public`,
    `${pooler()}?sslmode=require&sslmode=disable`,
  ]) assert.throws(() => disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: url }, caDependencies), /./)
  assert.throws(() => disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler(), DATABASE_URL: direct() }, caDependencies))
  assert.throws(() => disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: direct(), DIRECT_URL: direct() }, caDependencies))
})

test('requires an approved, current, usable CA with an exact fingerprint', () => {
  const env = { ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler() }
  assert.throws(() => disposableUrl({ ...env, D0A_SUPABASE_CA_CERT_PATH: undefined }, caDependencies), /CA path/)
  assert.throws(() => disposableUrl({ ...env, D0A_APPROVED_SUPABASE_CA_SHA256: 'B'.repeat(64) }, caDependencies), /fingerprint mismatch/)
  assert.throws(() => disposableUrl(env, { ...caDependencies, now: validCa.validFrom - 1 }), /not yet valid/)
  assert.throws(() => disposableUrl(env, { ...caDependencies, now: validCa.validTo + 1 }), /expired/)
  assert.throws(() => disposableUrl(env, { ...caDependencies, loadCa: () => ({ ...validCa, ca: false }) }), /usable/)
  assert.throws(() => disposableUrl(env, { ...caDependencies, loadCa: () => ({ ...validCa, selfSigned: false }) }), /usable/)
})

test('URL validation failures never contain a password or the connection string', () => {
  const url = `${pooler()}?schema=public`
  try { disposableUrl({ ...approve, DISPOSABLE_TEST_DATABASE_URL: url }, caDependencies); assert.fail('Expected rejection') }
  catch (error) {
    assert.doesNotMatch(String(error), /fake-password|postgresql:\/\//)
  }
})

test('stage diagnostics preserve useful error codes while redacting credentials and URLs', () => {
  const url = pooler()
  const error = Object.assign(new Error(`P1010 denied for ${url}; password=fake-password`), { code: 'P1010' })
  const diagnostic = sanitizedDiagnostic(error, url)
  assert.match(diagnostic, /^\[P1010\]/)
  assert.match(diagnostic, /denied/)
  assert.doesNotMatch(diagnostic, /fake-password|postgresql:\/\//)
})

test('verified TLS accepts hostname verification and the known Supabase strict diagnostic only after normal verification', async () => {
  const connection = approvedRemoteConnection({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler() }, caDependencies)
  const seen: string[] = []
  const result = await verifyRemoteTls(connection, async hostname => {
    seen.push(hostname)
    return { strictX509: 'KNOWN_SUPABASE_INTERMEDIATE_KEY_USAGE_LIMITATION' }
  })
  assert.deepEqual(seen, ['aws-0-us-east-1.pooler.supabase.com'])
  assert.equal(result.strictX509, 'KNOWN_SUPABASE_INTERMEDIATE_KEY_USAGE_LIMITATION')
})

test('X509_STRICT diagnostic recognizes only the approved Supabase intermediate limitation', () => {
  const rootCertificate = {
    subject: 'CN=Supabase Root 2021 CA', issuer: 'CN=Supabase Root 2021 CA',
    fingerprint: caFingerprint, ca: true, hasKeyUsage: true,
  }
  const intermediate = {
    subject: 'CN=Supabase Intermediate 2021 CA', issuer: 'CN=Supabase Root 2021 CA',
    fingerprint: 'B'.repeat(64), ca: true, hasKeyUsage: false,
  }
  const leaf = {
    subject: 'CN=*.pooler.supabase.com', issuer: intermediate.subject,
    fingerprint: 'C'.repeat(64), ca: false, hasKeyUsage: false,
  }
  assert.equal(classifyStrictX509Diagnostic([leaf, intermediate, rootCertificate], caFingerprint),
    'KNOWN_SUPABASE_INTERMEDIATE_KEY_USAGE_LIMITATION')
  assert.equal(classifyStrictX509Diagnostic([leaf, { ...intermediate, hasKeyUsage: true }, rootCertificate], caFingerprint), 'PASS')
  assert.throws(() => classifyStrictX509Diagnostic([
    leaf, { ...intermediate, subject: 'CN=Unexpected Intermediate' }, rootCertificate,
  ], caFingerprint), /Unrecognized/)
})

test('normal certificate-chain and hostname failures remain blocking and redacted', async () => {
  const connection = approvedRemoteConnection({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler() }, caDependencies)
  for (const failure of [new Error('untrusted chain'), new Error('hostname mismatch')]) {
    await assert.rejects(verifyRemoteTls(connection, async () => { throw failure }), error => {
      assert.match(String(error), /chain or hostname verification failed/)
      assert.doesNotMatch(String(error), /fake-password|postgresql:\/\//)
      return true
    })
  }
})

test('accepts only the exact preflight flag and rejects unknown arguments before approval', async () => {
  assert.equal(parseVerifierMode([]), 'rehearsal')
  assert.equal(parseVerifierMode(['--preflight-only']), 'preflight-only')
  let approvals = 0
  const dependencies = {
    approveConnection: () => { approvals += 1; throw new Error('must not run') },
  }
  for (const args of [['--unknown'], ['--preflight-only', '--unknown'], ['--preflight-only', '--preflight-only']]) {
    await assert.rejects(runVerifier(args, {}, dependencies), /Unsupported D0a verifier arguments/)
  }
  assert.equal(approvals, 0)
})

test('preflight invokes every read-only gate in order and never reaches rehearsal', async () => {
  const events: string[] = []
  const reports: string[] = []
  const connection = approvedRemoteConnection({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler() }, caDependencies)
  const client = {
    $queryRawUnsafe: async () => [],
    $disconnect: async () => { events.push('disconnect') },
  }
  const preflight = (approved: typeof connection) => runRemotePreflight(approved, {
    verifyTls: async () => { events.push('tls'); return { strictX509: 'PASS' } },
    createClient: () => { events.push('client'); return client as never },
    verifyClient: async () => { events.push('connectivity') },
    verifyRole: async () => { events.push('identity-and-privileges') },
    verifyCli: async () => { events.push('cli-read-only') },
  })
  const mode = await runVerifier(['--preflight-only'], {}, {
    approveConnection: () => connection,
    runPreflight: preflight,
    runRehearsal: async () => { events.push('rehearsal'); throw new Error('mutation path reached') },
    report: message => { reports.push(message) },
  })
  assert.equal(mode, 'preflight-only')
  assert.deepEqual(events, ['tls', 'client', 'connectivity', 'identity-and-privileges', 'cli-read-only', 'disconnect'])
  assert.equal(reports.length, 1)
  assert.match(reports[0], /^PASS: D0a read-only remote preflight/)
})

test('preflight failures stop later gates and never report PASS', async () => {
  const connection = approvedRemoteConnection({ ...approve, DISPOSABLE_TEST_DATABASE_URL: pooler() }, caDependencies)
  for (const failing of ['tls', 'connectivity', 'identity-and-privileges', 'cli-read-only']) {
    const events: string[] = []
    const reports: string[] = []
    const gate = async (name: string) => {
      events.push(name)
      if (name === failing) throw new Error(`${name} failed`)
    }
    const preflight = (approved: typeof connection) => runRemotePreflight(approved, {
      verifyTls: async () => { await gate('tls'); return { strictX509: 'PASS' } },
      createClient: () => ({
        $queryRawUnsafe: async () => [],
        $disconnect: async () => { events.push('disconnect') },
      }) as never,
      verifyClient: async () => { await gate('connectivity') },
      verifyRole: async () => { await gate('identity-and-privileges') },
      verifyCli: async () => { await gate('cli-read-only') },
    })
    await assert.rejects(runVerifier(['--preflight-only'], {}, {
      approveConnection: () => connection,
      runPreflight: preflight,
      runRehearsal: async () => { events.push('rehearsal'); throw new Error('mutation path reached') },
      report: message => { reports.push(message) },
    }), /failed/)
    assert.equal(reports.length, 0)
    assert.equal(events.includes('rehearsal'), false)
    const failedIndex = events.indexOf(failing)
    assert.ok(failedIndex >= 0)
    assert.deepEqual(events.slice(0, failedIndex + 1),
      ['tls', 'connectivity', 'identity-and-privileges', 'cli-read-only'].slice(0, failedIndex + 1))
  }
})

test('preflight requires remote approval and default invocation retains the rehearsal branch', async () => {
  let preflightCalls = 0
  let rehearsalCalls = 0
  await assert.rejects(runVerifier(['--preflight-only'], {}, {
    approveConnection: () => ({ url: 'postgresql://user@localhost:5432/givegot_test', remote: false }),
    runPreflight: async () => { preflightCalls += 1; return { strictX509: 'PASS' } },
  }), /approved remote TEST connection/)
  assert.equal(preflightCalls, 0)

  const mode = await runVerifier([], {}, {
    approveConnection: () => ({ url: 'postgresql://user@localhost:5432/givegot_test', remote: false }),
    runPreflight: async () => { preflightCalls += 1; return { strictX509: 'PASS' } },
    runRehearsal: async () => { rehearsalCalls += 1 },
  })
  assert.equal(mode, 'rehearsal')
  assert.equal(preflightCalls, 0)
  assert.equal(rehearsalCalls, 1)
})

test('Prisma connectivity probes contain only independently reviewed read-only SQL', async () => {
  const clientQueries: string[] = []
  await verifyPrismaClientConnectivity({
    $queryRawUnsafe: async (sql: string) => { clientQueries.push(sql); return [{ connected: 1 }] },
  } as never)
  assert.deepEqual(clientQueries, ['SELECT 1::int AS connected'])

  let cliSql = ''
  verifyPrismaCliConnectivity('postgresql://redacted.invalid/postgres', (_url, sql) => {
    cliSql = sql
    return { status: 0 }
  })
  assert.equal(cliSql, PRISMA_CLI_PREFLIGHT_SQL)
  assert.match(cliSql, /^BEGIN TRANSACTION READ ONLY;/)
  assert.match(cliSql, /SELECT current_database\(\), current_user;/)
  assert.match(cliSql, /ROLLBACK;/)
  assert.doesNotMatch(cliSql, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO)\b/i)
  assert.throws(() => verifyPrismaCliConnectivity('postgresql://redacted.invalid/postgres', () => ({ status: 1 })),
    /read-only connectivity check failed/)
})

test('every SQL script is transaction scoped and rejects managed schema escapes', () => {
  const wrapped = scopedSql('-- comment\nBEGIN;\nCREATE TYPE "Example" AS ENUM (\'A\');\nCOMMIT;\n', schema)
  assert.match(wrapped, /BEGIN;\nSET LOCAL search_path = "d0a_clean_[a-f0-9]{32}", pg_catalog;/)
  assert.match(wrapped, /DO \$\$ BEGIN IF current_schema\(\)/)
  assert.match(wrapped, /END \$\$;/)
  assert.doesNotMatch(wrapped, /DO \$ BEGIN/)
  assert.match(wrapped, /current_schema\(\) IS DISTINCT FROM/)
  assert.match(scopedSql('CREATE TABLE "Thing" ("id" INT);', schema), /^BEGIN;[\s\S]*COMMIT;\n$/)
  assert.throws(() => scopedSql('ALTER TABLE public."LearningResource" ADD COLUMN x INT;', schema))
  assert.throws(() => scopedSql('SET search_path TO public; CREATE TABLE x(id INT);', schema))
  assert.throws(() => scopedSql('CREATE EXTENSION vector;', schema))
  for (const file of [
    'tests/learning-hub/fixtures/pre-b1-legacy-schema.sql',
    'tests/learning-hub/fixtures/representative-legacy-bookings.sql',
    'prisma/migrations-manual/004_learning_hub_domain_schema.sql',
    'prisma/migrations-manual/005_learning_task_version.sql',
    'prisma/migrations-manual/006_learning_resource_purpose.sql',
    'prisma/migrations-manual/006_learning_resource_purpose.rollback.sql',
  ]) assert.match(scopedSql(readFileSync(path.join(root, file), 'utf8'), schema), /SET LOCAL search_path/)
})

test('schema-name collision fails before CREATE, and cleanup never targets a name alone', async () => {
  const commands: string[] = []
  const colliding = {
    $queryRawUnsafe: async () => [{ oid: 42 }],
    $executeRawUnsafe: async (sql: string) => { commands.push(sql); return 0 },
  }
  await assert.rejects(createOwnedSchema(colliding as never, schema), /already exists/)
  assert.equal(commands.length, 0)

  const changed = {
    $queryRawUnsafe: async () => [{ oid: 43 }],
    $executeRawUnsafe: async (sql: string) => { commands.push(sql); return 0 },
  }
  await assert.rejects(cleanupOwnedSchema(changed as never, { name: schema, oid: 42, objects: new Set() }), /reused/)
  assert.equal(commands.length, 0)
})

test('cleanup uses only current-run schema and RESTRICT, and refuses unknown objects', async () => {
  const commands: string[] = []
  const client = {
    $queryRawUnsafe: async (sql: string) => sql.includes('FROM pg_class') ? [] : [{ oid: 42 }],
    $executeRawUnsafe: async (sql: string) => { commands.push(sql); return 0 },
  }
  await cleanupOwnedSchema(client as never, { name: schema, oid: 42, objects: new Set() })
  assert.ok(commands.length > 1)
  assert.ok(commands.every(sql => sql.includes(`"${schema}"`) && sql.endsWith(' RESTRICT')))
  assert.ok(commands.every(sql => !/CASCADE|public|auth|storage/i.test(sql)))

  commands.length = 0
  const foreign = {
    ...client,
    $queryRawUnsafe: async (sql: string) => sql.includes('FROM pg_class')
      ? [{ oid: 99, kind: 'r', name: 'Unexpected' }] : [{ oid: 42 }],
  }
  await assert.rejects(cleanupOwnedSchema(foreign as never, { name: schema, oid: 42, objects: new Set() }), /Unknown object/)
  assert.equal(commands.length, 0)
})

test('remote preflight requires a dedicated role with no existing write access', async () => {
  const identity = {
    database: 'postgres', role: 'd0a_verifier', superuser: false, createRole: false,
    createDb: false, replicate: false, bypassRls: false, canCreateDbObject: true,
    memberOfAdmin: false,
  }
  const client = (change: Partial<typeof identity> = {}, writableSchemas: string[] = [], writableObjects = 0) => ({
    $queryRawUnsafe: async (sql: string) => {
      if (sql.includes('current_database() AS database')) return [{ ...identity, ...change }]
      if (sql.includes('has_schema_privilege')) return writableSchemas.map(name => ({ name }))
      return [{ count: writableObjects }]
    },
  })
  await verifyRemoteRole(client() as never)
  await assert.rejects(verifyRemoteRole(client({ database: 'unexpected' }) as never))
  await assert.rejects(verifyRemoteRole(client({ role: 'postgres' }) as never))
  await assert.rejects(verifyRemoteRole(client({ superuser: true }) as never))
  await assert.rejects(verifyRemoteRole(client({ canCreateDbObject: false }) as never))
  await assert.rejects(verifyRemoteRole(client({ memberOfAdmin: true }) as never))
  await assert.rejects(verifyRemoteRole(client({}, ['public']) as never))
  await assert.rejects(verifyRemoteRole(client({}, [], 1) as never))
})
