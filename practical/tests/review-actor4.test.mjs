import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { createApp } from '../server/index.mjs';
import { hash } from '../server/database.mjs';

let app, directory, origin, owner, viewer, project, publicDoc;
const syntheticKey = 'fixture-review-actor4-not-a-real-key';
function client() { return { cookie: '', studio: '', async request(path, method = 'GET', body) {
  const response = await fetch(origin + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', cookie: this.cookie, 'x-studio-id': this.studio }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const cookies = response.headers.getSetCookie(); if (cookies.length) this.cookie = cookies.map(s => s.split(';')[0]).join('; ');
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : new Uint8Array(await response.arrayBuffer()) };
}, async ok(path, method = 'GET', body) { const result = await this.request(path, method, body); assert.ok(result.status < 300, `fixture HTTP ${result.status}: ${JSON.stringify(result.data)}`); return result.data; } }; }
before(async () => {
  const holder = createServer(); await new Promise(resolve => holder.listen(0, '127.0.0.1', resolve)); const port = holder.address().port; await new Promise(resolve => holder.close(resolve)); origin = `http://127.0.0.1:${port}`;
  const root = fileURLToPath(new URL('../../.runtime/', import.meta.url)); await mkdir(root, { recursive: true }); directory = await mkdtemp(root + 'actor4-review-');
  app = await createApp({ dataDir: directory, baseURL: origin, modelRunner: async connection => { throw new Error('fixture-provider-rejected: ' + connection.apiKey); } }); await app.listen(port);
  owner = client(); viewer = client();
  for (const [index, user] of [owner, viewer].entries()) { await user.ok('/api/auth/sign-up/email', 'POST', { name: '虚构审计用户' + index, email: `actor4-review-${index}@example.test`, password: 'Fixture-password-review-2026!' }); const context = await user.ok('/api/p/context'); user.studio = context.studioId; }
  const invite = await owner.ok('/api/p/invites', 'POST', { email: 'actor4-review-1@example.test', role: 'viewer' }); await viewer.ok('/api/p/join', 'POST', { token: new URL(invite.url).searchParams.get('invite') }); viewer.studio = owner.studio;
  project = await owner.ok('/api/p/projects', 'POST', { title: '虚构审计项目', actor: '把子肉' });
  publicDoc = await owner.ok(`/api/p/projects/${project.id}/documents`, 'POST', { name: '虚构公开剧本.txt', text: '第一场 内景 车站 日\n把子肉：同一封信。' });
});
after(async () => { if (app) await app.close(); if (directory) await rm(directory, { recursive: true, force: true }); });

test('review P1: a private original must not become a team-readable extracted document', async () => {
  const file = await owner.ok(`/api/p/projects/${project.id}/files`, 'POST', { name: '虚构私有备注.txt', type: 'text/plain', visibility: 'private', data: Buffer.from('fictional-private-marker-actor4').toString('base64') });
  assert.equal((await viewer.request('/api/p/files/' + file.id)).status, 404);
  const imported = await owner.request(`/api/p/projects/${project.id}/documents`, 'POST', { fileId: file.id });
  assert.ok([201, 400, 403].includes(imported.status));
  if (imported.status === 201) { const docs = await viewer.ok(`/api/p/projects/${project.id}/documents`); assert.equal(docs.some(d => d.text.includes('fictional-private-marker-actor4')), false, 'private-file extracted text leaked to viewer'); }
});

test('review P2: ZIP restore remaps document references in analysis reports', async () => {
  await owner.ok(`/api/p/projects/${project.id}/records`, 'POST', { kind: 'report', title: '虚构引用报告', body: { sections: [{ heading: '原文', items: [{ sourceId: publicDoc.id, quote: '同一封信。', citationVerified: true }] }], sourceSnapshot: [{ id: publicDoc.id, name: publicDoc.name }] } });
  const bytes = await owner.ok(`/api/p/projects/${project.id}/export`), imported = await owner.ok('/api/p/import', 'POST', { data: Buffer.from(bytes).toString('base64') });
  const docs = await owner.ok(`/api/p/projects/${imported.id}/documents`), reports = await owner.ok(`/api/p/projects/${imported.id}/records?kind=report`), report = reports.find(r => r.title === '虚构引用报告');
  const target = docs.find(d => d.name === publicDoc.name); assert.notEqual(target.id, publicDoc.id);
  assert.equal(report.body.sections[0].items[0].sourceId, target.id, 'restored report sourceId points to the old document'); assert.equal(report.body.sourceSnapshot[0].id, target.id);
});

test('review P2: invalid ZIP import must not leave archived ghost project or original files', async () => {
  const bytes = Buffer.from('fictional proof'); const manifest = { app: 'xilixiwai-practical', version: 1, project: { title: '应当整体拒绝的虚构包', actor: '', data: {} }, files: [{ id: 'old-file', name: '虚构原件.txt', type: 'text/plain', size: bytes.length, sha256: hash(bytes), visibility: 'team' }], documents: [], records: [{ id: 'old-record', kind: 'invalid-kind', title: '拒绝', body: {} }] };
  const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'originals/old-file': bytes });
  const beforeProjects = app.store.get('SELECT COUNT(*) AS n FROM projects').n, beforeFiles = app.store.get('SELECT COUNT(*) AS n FROM files').n;
  const result = await owner.request('/api/p/import', 'POST', { data: Buffer.from(zip).toString('base64') }); assert.ok(result.status >= 400);
  assert.equal(app.store.get('SELECT COUNT(*) AS n FROM projects').n, beforeProjects, 'failed import left a project'); assert.equal(app.store.get('SELECT COUNT(*) AS n FROM files').n, beforeFiles, 'failed import left files');
});

test('review P1: provider errors cannot leak the actual connection key into persisted jobs', async () => {
  const connection = await owner.ok('/api/p/connections', 'POST', { name: '合成审计连接', provider: 'compatible', model: 'fixture', baseUrl: 'https://example.com/v1', apiKey: syntheticKey });
  const job = await owner.ok(`/api/p/projects/${project.id}/jobs`, 'POST', { connectionId: connection.id, task: 'script', documentIds: [publicDoc.id], confirmed: true, visibility: 'private' });
  let result; for (let count = 0; count < 100; count++) { result = (await owner.ok(`/api/p/projects/${project.id}/jobs`)).find(j => j.id === job.id); if (['error', 'done'].includes(result.status)) break; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.equal(result.status, 'error'); assert.equal(JSON.stringify(result).includes(syntheticKey), false, 'actual connection key persisted in the returned job error');
  assert.equal(JSON.stringify(await viewer.ok(`/api/p/projects/${project.id}/jobs`)).includes(syntheticKey), false, 'actual connection key leaked to another team member');
});

test('review baseline: business and another user personal space remain inaccessible to viewer', async () => {
  const context = await owner.ok('/api/p/context'); assert.equal((await viewer.request('/api/p/projects/' + context.businessProjectId)).status, 403); assert.equal((await viewer.request('/api/p/projects/' + context.personalProjectId)).status, 404);
});

test('review P1: publishing a sanitized record cannot publish its previous private contents', async () => {
  const record = await owner.ok(`/api/p/projects/${project.id}/records`, 'POST', { kind: 'decision', title: '虚构阶段决定', visibility: 'private', body: { text: 'fictional-private-history-marker-actor4' } });
  await owner.ok(`/api/p/projects/${project.id}/records/${record.id}`, 'PATCH', { revision: 1, visibility: 'team', body: { text: '可共享的虚构结论' } });
  const history = await viewer.request(`/api/p/projects/${project.id}/records/${record.id}/versions`);
  assert.ok([200, 403, 404].includes(history.status));
  assert.equal(JSON.stringify(history.data).includes('fictional-private-history-marker-actor4'), false, 'private historical contents became readable after safe publication');
});

test('review P1: imported documents inherit privacy from their private originals', async () => {
  const bytes = Buffer.from('fictional-private-import-marker-actor4');
  const manifest = { app: 'xilixiwai-practical', version: 1, project: { id: 'old-project', title: '虚构私有原件导入', actor: '', phase: 0, data: {} }, files: [{ id: 'old-private-file', name: '虚构私有材料.txt', type: 'text/plain', size: bytes.length, sha256: hash(bytes), visibility: 'private' }], documents: [{ id: 'old-document', name: '虚构私有材料', text: bytes.toString(), file_id: 'old-private-file', visibility: 'team', metadata: {} }], records: [] };
  const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'originals/old-private-file': bytes });
  const result = await owner.request('/api/p/import', 'POST', { data: Buffer.from(zip).toString('base64') }); assert.ok([201, 400, 403].includes(result.status));
  if (result.status === 201) { const docs = await viewer.ok(`/api/p/projects/${result.data.id}/documents`); assert.equal(docs.some(d => d.text.includes('fictional-private-import-marker-actor4')), false, 'ZIP restore turned private original text into team-readable document'); }
});
