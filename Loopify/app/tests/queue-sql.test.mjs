import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
test('SQL queue claims, lease recovery and database permissions', async () => {
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid);`);
await db.exec(fs.readFileSync(new URL('../supabase-schema.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase-migration-platforms.sql', import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase-migration-upload-recovery.sql', import.meta.url), 'utf8'));
await db.exec(`INSERT INTO scheduled_uploads(title, scheduled_at) VALUES ('due', now()), ('future', now() + interval '2 days');`);
const first = await db.query('SELECT * FROM claim_scheduled_upload()');
assert.equal(first.rows.length, 1);
assert.equal(first.rows[0].title, 'due');
assert.equal((await db.query('SELECT * FROM claim_scheduled_upload()')).rows.length, 0);
await db.exec(`UPDATE scheduled_uploads SET locked_at = now() - interval '3 minutes' WHERE title = 'due';`);
assert.equal((await db.query('SELECT * FROM claim_scheduled_upload()')).rows.length, 1);
await db.exec(`UPDATE scheduled_uploads SET status='completed', youtube_video_id='video', first_comment='hello' WHERE title='due';`);
assert.equal((await db.query('SELECT * FROM claim_scheduled_comment()')).rows.length, 1);
assert.equal((await db.query('SELECT * FROM claim_scheduled_comment()')).rows.length, 0);
await db.exec(`SET ROLE anon`);
await assert.rejects(db.query('SELECT * FROM platforms'), /permission denied/);
await assert.rejects(db.query('SELECT * FROM claim_scheduled_upload()'), /permission denied/);
console.log('SQL migration, queue claim, lease recovery, comment claim and anon permissions passed');
await db.close();

});
