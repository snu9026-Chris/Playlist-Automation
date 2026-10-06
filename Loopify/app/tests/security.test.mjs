import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { resolveMediaFile, isAllowedOrigin } from '../local-server/security.mjs';
const require = createRequire(import.meta.url);
function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: id => mocks[id] ?? require(id), Buffer, process, URL, AbortSignal, fetch: (...args) => globalThis.fetch(...args), console });
  return exports;
}
const policy = load('../src/lib/upload-policy.ts');

test('media routes reject encoded traversal, malformed encoding and symlinks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'playlist-security-'));
  const media = path.join(root, 'media'); fs.mkdirSync(media);
  fs.writeFileSync(path.join(root, 'secret'), 'secret');
  fs.symlinkSync(path.join(root, 'secret'), path.join(media, 'link'));
  try {
    for (const name of ['../secret', '%2e%2e%2fsecret', '..%5csecret', '%', 'link', '%00']) assert.equal(resolveMediaFile(media, name), null);
    assert.equal(resolveMediaFile(media, 'song.mp4'), path.join(media, 'song.mp4'));
    assert.equal(isAllowedOrigin('https://evil.example'), false);
    assert.equal(isAllowedOrigin('http://localhost:3002'), true);
    assert.equal(isAllowedOrigin('https://app.example', 'https://app.example'), true);
  } finally { fs.rmSync(root, { recursive: true }); }
});

test('future videos stay private with publishAt; overdue jobs publish immediately', () => {
  assert.equal(policy.publicationStatus('2030-01-01T00:00:00Z', 0).privacyStatus, 'private');
  assert.equal(policy.publicationStatus('2030-01-01T00:00:00Z', 0).publishAt, '2030-01-01T00:00:00.000Z');
  assert.equal(policy.publicationStatus('2000-01-01T00:00:00Z').privacyStatus, 'public');
  assert.throws(() => policy.publicationStatus('bad'));
  assert.equal(policy.resumeOffset('bytes=0-99', 200), 100);
  assert.equal(policy.resumeOffset(null, 200), 0);
  assert.throws(() => policy.resumeOffset('bytes=0-999', 200));
});

test('administrator gate fails closed, authenticates, and rejects cross-site writes', () => {
  const { proxy } = load('../src/proxy.ts');
  const saved = { user: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD };
  const req = (pathname, method = 'GET', headers = {}) => ({ nextUrl: { pathname }, url: 'https://app.example/api/projects', method, headers: new Headers(headers) });
  try {
    delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD;
    assert.equal(proxy(req('/api/projects')).status, 503);
    process.env.ADMIN_USERNAME = 'owner'; process.env.ADMIN_PASSWORD = 'strong-password';
    assert.equal(proxy(req('/api/projects')).status, 401);
    const authorization = `Basic ${Buffer.from('owner:strong-password').toString('base64')}`;
    assert.equal(proxy(req('/api/projects', 'GET', { authorization })).status, 200);
    assert.equal(proxy(req('/api/projects', 'POST', { authorization, origin: 'https://evil.example' })).status, 403);
    assert.equal(proxy(req('/api/cron/upload')).status, 200);
  } finally {
    for (const [key, value] of [['ADMIN_USERNAME', saved.user], ['ADMIN_PASSWORD', saved.password]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

function worker(item) {
  const events = [];
  const client = {
    rpc: async name => ({ data: name === 'claim_scheduled_upload' ? [item] : [], error: null }),
    from: () => ({ update: values => ({ eq: async () => { events.push(values); return { error: null }; } }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob(['1234567890']), error: null }), remove: async () => { events.push('removed'); return { error: null }; } }) },
  };
  const route = load('../src/app/api/cron/upload/route.ts', {
    '@/lib/supabase': { createServerClient: () => client },
    '@/lib/youtube-auth': { getValidYouTubeToken: async () => 'token' },
    '@/lib/upload-policy': policy,
  });
  return { events, route };
}
const item = { id: 'job', retry_count: 0, video_path: 'scheduled/video.mp4', title: 'Title', scheduled_at: '2030-01-01T00:00:00Z' };

test('worker saves a new session before uploading bytes, then commits before cleanup', async () => {
  const { route, events } = worker(item);
  const savedFetch = globalThis.fetch; const savedSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-secret';
  globalThis.fetch = async (url, options) => {
    if (url.includes('uploadType=resumable')) {
      assert.equal(JSON.parse(options.body).status.privacyStatus, 'private');
      return new Response(null, { headers: { Location: 'https://upload.example/session' } });
    }
    assert.equal(events[0].upload_session_url, url);
    return Response.json({ id: 'video' });
  };
  try {
    const result = await route.GET({ headers: new Headers({ authorization: 'Bearer test-secret' }) });
    assert.equal(result.status, 200);
    assert.equal(events[1].youtube_video_id, 'video');
    assert.equal(events[2], 'removed');
  } finally { globalThis.fetch = savedFetch; if (savedSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedSecret; }
});

test('worker resumes existing sessions and never creates another video after an expired session', async () => {
  const savedFetch = globalThis.fetch; const savedSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-secret';
  try {
    const { route } = worker({ ...item, upload_session_url: 'https://upload.example/session' });
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(options);
      return calls.length === 1 ? new Response(null, { status: 308, headers: { Range: 'bytes=0-4' } }) : Response.json({ id: 'video' });
    };
    assert.equal((await route.GET({ headers: new Headers({ authorization: 'Bearer test-secret' }) })).status, 200);
    assert.equal(calls[1].headers['Content-Range'], 'bytes 5-9/10');
    assert.equal(calls[1].body.byteLength, 5);
    const failed = worker({ ...item, upload_session_url: 'https://upload.example/session' });
    globalThis.fetch = async () => new Response(null, { status: 404 });
    assert.equal((await failed.route.GET({ headers: new Headers({ authorization: 'Bearer test-secret' }) })).status, 500);
    assert.equal(failed.events[0].status, 'failed');
    assert.ok(!failed.events.includes('removed'));
    delete process.env.CRON_SECRET;
    assert.equal((await failed.route.GET({ headers: new Headers({ authorization: 'Bearer undefined' }) })).status, 401);
  } finally { globalThis.fetch = savedFetch; if (savedSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedSecret; }
});
