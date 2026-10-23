import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fileService } from '../server/files.mjs';

test('review P2: permission revalidation failure after original write must clean up staged file', async () => {
  const root = fileURLToPath(new URL('../../.runtime/', import.meta.url)); await mkdir(root, { recursive: true }); const dir = await mkdtemp(root + 'actor4-file-review-');
  let checks = 0;
  const store = { transaction: fn => fn(), project() { if (++checks > 1) { const e = Error('合成夹具：异步写入期间访问权限已撤回'); e.status = 403; throw e; } return { data: {} }; }, run() { assert.fail('metadata must not be written after denied permission'); }, audit() {}, get() {} };
  try { const files = fileService(store, dir); await assert.rejects(files.put({ pid: 'p', studio: 's', user: 'u', name: '虚构原件.txt', type: 'text/plain', bytes: Buffer.from('fixture-original') }), { status: 403 }); assert.deepEqual(await readdir(dir + '/originals'), [], 'permission failure left an untracked original file on disk'); }
  finally { await rm(dir, { recursive: true, force: true }); }
});
