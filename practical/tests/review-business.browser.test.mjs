import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createApp } from '../server/index.mjs';

test('real server: business owner workflow, private originals, theme and leave flush', { timeout: 90_000 }, async () => {
  const holder = createServer(); await new Promise(resolve => holder.listen(0, '127.0.0.1', resolve)); const port = holder.address().port; await new Promise(resolve => holder.close(resolve));
  const origin = `http://127.0.0.1:${port}`, root = fileURLToPath(new URL('../../.runtime/', import.meta.url)); await mkdir(root, { recursive: true }); const directory = await mkdtemp(root + 'actor4-business-real-');
  let app, browser;
  try {
    app = await createApp({ dataDir: directory, baseURL: origin, modelRunner: async () => { throw Error('No models are used in this test'); } }); await app.listen(port);
    const executablePath = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } }), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); page.setDefaultTimeout(10_000);
    await page.goto(origin + '/practical/'); await page.locator('[name=name]').fill('虚构经营验收人'); await page.locator('[name=email]').fill('actor4-business-owner@example.test'); await page.locator('[name=password]').fill('Fixture-business-password-2026!'); await page.getByRole('button', { name: '注册账号', exact: true }).click(); await page.waitForSelector('#shell:not([hidden])');
    await page.locator('a[data-route=business]').click(); const frame = page.frameLocator('iframe.module-frame'); await frame.locator('#status').filter({ hasText: '已连接' }).waitFor();
    const businessContext = await page.evaluate(() => ActorStore.context()); assert.ok(businessContext.businessProjectId); assert.equal(app.store.all('SELECT * FROM records WHERE project_id=?', businessContext.businessProjectId).length, 1);
    const businessState = () => JSON.parse(app.store.get("SELECT body FROM records WHERE project_id=? AND kind='module'", businessContext.businessProjectId).body).state;
    assert.deepEqual(businessState().entities, []); assert.deepEqual(businessState().entries, []); assert.equal(await frame.locator('body').getAttribute('class'), 'embedded');
    const tab = async name => { await frame.getByRole('button', { name, exact: true }).click(); await frame.locator('#app:not([inert])').waitFor(); };
    const register = async type => { await frame.locator(`form[data-form=${type}] button[type=submit]`).click(); await frame.locator('#app:not([inert])').waitFor(); assert.equal(await frame.locator('#error').isVisible(), false, await frame.locator('#error').textContent()); };
    await tab('主体与合作'); let form = frame.locator('form[data-form=entities]'); await form.locator('[name=name]').fill('虚构实战工作室'); await register('entities');
    const entityId = businessState().entities[0].id; await tab('收支与回款'); form = frame.locator('form[data-form=entries]'); await form.locator('[name=entityId]').selectOption(entityId); await form.locator('[name=title]').fill('虚构两期合作'); await form.locator('[name=counterparty]').fill('虚构合作机构'); await form.locator('[name=amount]').fill('100.01'); await form.locator('[name=schedule]').fill('首期 | 40.00 | 2026-10-23\n尾期 | 60.01 | 2026-11-23'); await register('entries'); assert.equal(businessState().entries[0].amountMinor, 10001);
    await page.reload(); await page.waitForSelector('#shell:not([hidden])'); await frame.locator('#status').filter({ hasText: '已连接' }).waitFor(); assert.equal(businessState().entries.length, 1); await tab('收支与回款'); assert.match(await frame.locator('#content').textContent(), /虚构两期合作/);
    await page.locator('#theme').selectOption('butter'); await frame.locator('html[data-theme=butter]').waitFor(); assert.equal(await frame.locator('html').getAttribute('data-theme'), 'butter');
    await tab('主体与合作'); form = frame.locator('form[data-form=entities]'); await form.locator('[name=name]').fill('离页前的未提交主体'); await form.locator('[name=note]').fill('此文本必须在离页时保存为草稿');
    await page.locator('a[data-route=settings]').click(); await page.waitForFunction(() => !document.querySelector('iframe')); assert.equal(businessState().drafts.entities.note, '此文本必须在离页时保存为草稿'); assert.equal(businessState().entities.length, 1);
    await page.locator('a[data-route=business]').click(); await frame.locator('#status').filter({ hasText: '已连接' }).waitFor(); assert.equal(await frame.locator('form[data-form=entities] [name=name]').inputValue(), '离页前的未提交主体');
    await tab('票据原件'); form = frame.locator('form[data-form=vouchers]'); await form.locator('[name=entityId]').selectOption(entityId); await form.locator('[name=title]').fill('虚构经营凭据'); await form.locator('[name=amount]').fill('12.34'); await form.locator('[name=date]').fill('2026-10-23'); const original = Buffer.from('fictional original business proof only'); await form.locator('[type=file]').setInputFiles({ name: '虚构原件.txt', mimeType: 'text/plain', buffer: original });
    await page.locator('a[data-route=settings]').click(); await page.locator('#error:not([hidden])').waitFor(); assert.equal(await page.locator('iframe.module-frame').count(), 1); assert.match(await page.locator('#error').textContent(), /原件|表单/);
    await register('vouchers'); const metadata = app.store.all('SELECT * FROM files WHERE project_id=?', businessContext.businessProjectId); assert.equal(metadata.length, 1); assert.equal(metadata[0].visibility, 'private');
    const downloadPromise = page.waitForEvent('download'); await frame.locator('[data-download]').first().click(); const download = await downloadPromise, stream = await download.createReadStream(), chunks = []; for await (const bytes of stream) chunks.push(bytes); assert.deepEqual(Buffer.concat(chunks), original);
    const backupPromise = page.waitForEvent('download'); await frame.locator('#backup').click(); const backup = await backupPromise, backupStream = await backup.createReadStream(), jsonChunks = []; for await (const bytes of backupStream) jsonChunks.push(bytes); const backupBytes = Buffer.concat(jsonChunks), bundle = JSON.parse(backupBytes); assert.equal(bundle.files.length, 1); assert.equal(bundle.key, 'business-v1');
    await frame.locator('[data-delete=vouchers]').first().click(); await frame.locator('#app:not([inert])').waitFor(); assert.equal(businessState().vouchers.length, 0);
    await frame.locator('#restore').setInputFiles({ name: '经营备份.json', mimeType: 'application/json', buffer: backupBytes }); await frame.locator('#status').filter({ hasText: '经营资料与原件已恢复' }).waitFor(); assert.equal(businessState().vouchers.length, 1); assert.notEqual(businessState().vouchers[0].files[0].id, bundle.state.vouchers[0].files[0].id);
    const viewerContext = await browser.newContext(), viewer = await viewerContext.newPage(); await viewer.goto(origin + '/practical/'); await viewer.locator('[name=name]').fill('虚构只读验收人'); await viewer.locator('[name=email]').fill('actor4-business-viewer@example.test'); await viewer.locator('[name=password]').fill('Fixture-business-password-2026!'); await viewer.getByRole('button', { name: '注册账号', exact: true }).click(); await viewer.waitForSelector('#shell:not([hidden])');
    const invite = await page.evaluate(async () => ActorStore.api('invites', { method: 'POST', body: { email: 'actor4-business-viewer@example.test', role: 'viewer' } }));
    await viewer.evaluate(async ({ token, studioId }) => { await ActorStore.api('join', { method: 'POST', body: { token } }); sessionStorage.setItem('actor-practical-context', JSON.stringify({ studioId })); }, { token: new URL(invite.url).searchParams.get('invite'), studioId: businessContext.studioId });
    const denied = await viewer.evaluate(async ({ businessId, fileId, studioId }) => {
      const headers = { 'x-studio-id': studioId }; return { project: (await fetch('/api/p/projects/' + businessId, { headers })).status, file: (await fetch('/api/p/files/' + fileId, { headers })).status };
    }, { businessId: businessContext.businessProjectId, fileId: metadata[0].id, studioId: businessContext.studioId }); assert.equal(denied.project, 403); assert.equal(denied.file, 404);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ test: 'real-business-server', betterAuth: true, emptyStart: true, entriesPersist: true, originalExact: true, privateOwnerOnly: true, restoredNewFileId: true, themeMessage: true, leaveDraftFlush: true, pendingFilePreventsLeave: true, errors }));
  } finally { if (browser) await browser.close(); if (app) await app.close(); await rm(directory, { recursive: true, force: true }); }
});
