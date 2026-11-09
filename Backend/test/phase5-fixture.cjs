// Real PostgreSQL + real Supabase HTTP client. The transport below replaces only
// PostgREST/auth infrastructure, and never connects to a live Supabase project.
const { PGlite } = require('@electric-sql/pglite');
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

async function fixture() {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(readFileSync(join(__dirname, 'phase5-schema.sql'), 'utf8'));
  for (const file of [
    '2026-10-24-phase5-retention.sql',
    '2026-10-24-phase5-push.sql',
  ])
    await db.exec(readFileSync(join(__dirname, '../migrations', file), 'utf8'));
  await db.query(
    "INSERT INTO profiles(uid,display_name) VALUES($1,'Reader'),($2,'Creator')",
    [A, B],
  );
  const requests = [];
  const tables = {
    reader_collections: [
      'id',
      'owner_uid',
      'name',
      'description',
      'visibility',
      'created_at',
      'updated_at',
    ],
    push_devices: ['uid', 'device_id', 'token'],
    push_preferences: ['uid', 'new_chapter', 'new_follower'],
    notifications: [
      'id',
      'uid',
      'type',
      'title',
      'body',
      'link',
      'read',
      'created_at',
    ],
  };
  let failNext = false;
  const client = createClient('https://phase5.supabase.co', 'test-only-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init = {}) => {
        const url = new URL(input instanceof Request ? input.url : input);
        const method = init.method ?? 'GET';
        const body = init.body ? JSON.parse(init.body) : null;
        requests.push({ url, method, body });
        if (failNext) {
          failNext = false;
          return Response.json(
            { message: 'Simulated database outage' },
            { status: 503 },
          );
        }
        try {
          const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(phase5_[a-z_]+)$/);
          if (rpc) {
            const names = Object.keys(body ?? {});
            if (names.some((name) => !/^p_[a-z_]+$/.test(name)))
              throw new Error('Invalid fixture RPC');
            const result = await db.query(
              `SELECT ${rpc[1]}(${names.map((name, i) => `${name} => $${i + 1}`).join(',')}) AS value`,
              Object.values(body ?? {}),
            );
            return Response.json(result.rows[0].value);
          }
          const table = url.pathname.split('/').at(-1);
          const allowed = tables[table];
          if (!allowed)
            return Response.json(
              { message: 'Fixture route missing' },
              { status: 404 },
            );
          const args = [];
          const conditions = [];
          for (const [key, value] of url.searchParams) {
            if (!allowed.includes(key)) continue;
            if (!value.startsWith('eq.'))
              throw new Error('Unsupported fixture filter');
            args.push(value.slice(3));
            conditions.push(`${key}=$${args.length}`);
          }
          const where = conditions.length
            ? ` WHERE ${conditions.join(' AND ')}`
            : '';
          let sql;
          if (method === 'GET') sql = `SELECT * FROM ${table}${where}`;
          else if (method === 'DELETE')
            sql = `DELETE FROM ${table}${where} RETURNING *`;
          else {
            const names = Object.keys(body);
            if (names.some((name) => !allowed.includes(name)))
              throw new Error('Unknown fixture column');
            const values = Object.values(body);
            if (method === 'PATCH') {
              const sets = names.map(
                (name, i) => `${name}=$${args.length + i + 1}`,
              );
              args.push(...values);
              sql = `UPDATE ${table} SET ${sets.join(',')}${where} RETURNING *`;
            } else {
              args.push(...values);
              sql = `INSERT INTO ${table}(${names.join(',')}) VALUES(${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`;
            }
          }
          const rows = (await db.query(sql, args)).rows;
          const headers = new Headers(init.headers);
          const object = headers.get('Accept')?.includes('vnd.pgrst.object');
          if (object && !rows.length)
            return Response.json(
              {
                code: 'PGRST116',
                message: 'No row',
                details: 'The result contains 0 rows',
              },
              { status: 406 },
            );
          return Response.json(object ? rows[0] : rows);
        } catch (error) {
          return Response.json(
            { code: error.code, message: error.message },
            { status: 400 },
          );
        }
      },
    },
  });
  return {
    db,
    requests,
    fail() {
      failNext = true;
    },
    supabase: {
      client,
      async verifyAccessToken(token) {
        // Only locally constructed JWTs, never a developer session.
        const uid = JSON.parse(
          Buffer.from(token.split('.')[1] ?? '', 'base64url'),
        ).sub;
        if (![A, B].includes(uid)) throw new Error('Invalid fixture user');
        return { uid, email: 'phase5@example.test' };
      },
    },
  };
}
async function application() {
  require('reflect-metadata');
  const { Test } = require('@nestjs/testing');
  const { ValidationPipe } = require('@nestjs/common');
  const { SupabaseService } = require('../dist/src/supabase/supabase.service');
  const {
    RetentionController,
  } = require('../dist/src/retention/retention.controller');
  const {
    RetentionService,
  } = require('../dist/src/retention/retention.service');
  const {
    NotificationsController,
  } = require('../dist/src/notifications/notifications.controller');
  const {
    NotificationsService,
  } = require('../dist/src/notifications/notifications.service');
  const { PushService } = require('../dist/src/notifications/push.service');
  const data = await fixture();
  const module = await Test.createTestingModule({
    controllers: [RetentionController, NotificationsController],
    providers: [
      RetentionService,
      NotificationsService,
      PushService,
      { provide: SupabaseService, useValue: data.supabase },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, ...data };
}
function token(uid = A) {
  return [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
      'base64url',
    ),
    Buffer.from(
      JSON.stringify({
        sub: uid,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: 'authenticated',
        aal: 'aal1',
      }),
    ).toString('base64url'),
    'phase5-fixture',
  ].join('.');
}
module.exports = { fixture, application, token, A, B };
