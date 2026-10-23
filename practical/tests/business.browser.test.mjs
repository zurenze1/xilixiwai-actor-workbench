import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// UI + the actual shared bridge, against a private in-memory API fixture. No real account is used.
test('business UI persists actual forms, original receipts and CSV; narrow screens stay usable', { timeout: 90_000 }, async () => {
  let record = null; const files = new Map(), seenProjects = new Set();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'); const parts = url.pathname.split('/');
      const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      let body; if (['POST', 'PATCH'].includes(req.method)) { const chunks = []; for await (const part of req) chunks.push(part); body = JSON.parse(Buffer.concat(chunks)); }
      if (url.pathname.startsWith('/api/p/projects/')) {
        const project = parts[4]; seenProjects.add(project); if (project !== 'business-hidden') return send(403, { error: '测试接口仅允许经营隔离项目' });
        if (url.pathname.endsWith('/module')) { if (!record) record = { id: 'module-business', visibility: 'private', revision: 1, body: { key: body.key, state: body.state } }; return send(200, record); }
        if (url.pathname.endsWith('/records') && req.method === 'GET') return send(200, record ? [record] : []);
        if (url.pathname.includes('/records/') && req.method === 'PATCH') { if (body.revision !== record.revision) return send(409, { error: '测试：其他页面已更新，请重新读取' }); record = { ...record, revision: record.revision + 1, body: body.body }; return send(200, record); }
        if (url.pathname.endsWith('/files')) {
          if (req.method === 'GET') return send(200, [...files.values()].map(({ bytes, ...meta }) => meta));
          const bytes = Buffer.from(body.data, 'base64'), file = { id: randomUUID(), name: body.name, type: body.type, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), projectId: project, visibility: body.visibility, bytes }; files.set(file.id, file); const { bytes: ignored, ...meta } = file; return send(200, meta);
        }
      }
      if (url.pathname.startsWith('/api/p/files/')) { const file = files.get(parts[4]); if (!file) return send(404, { error: '原件不存在' }); res.writeHead(200, { 'Content-Type': file.type }); return res.end(file.bytes); }
      const name = url.pathname === '/bridge.js' ? '../web/bridge.js' : url.pathname.startsWith('/business/') ? '../web/business/' + url.pathname.split('/').at(-1) : '';
      if (!name || name.includes('..', 3)) return send(404, { error: '不存在' });
      const bytes = await readFile(new URL(name, import.meta.url)); res.writeHead(200, { 'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(bytes);
    } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const executablePath = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => sessionStorage.setItem('actor-practical-context', JSON.stringify({ projectId: 'ordinary-film', studioId: 'fixture-studio', userId: 'fixture-owner', businessProjectId: 'business-hidden', theme: 'tide' })));
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(8000);
    const base = `http://127.0.0.1:${server.address().port}/business/index.html?embedded=1`;
    await page.goto(base); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已连接'));
    const tab = async name => { await page.getByRole('button', { name, exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#app').inert); };
    const register = async type => { const form = page.locator(`form[data-form="${type}"]`); await form.locator('button[type=submit]').click(); await page.waitForFunction(() => !document.querySelector('#app').inert); assert.equal(await page.locator('#error').isVisible(), false, await page.locator('#error').textContent()); };
    await tab('主体与合作'); let form = page.locator('form[data-form=entities]'); await form.locator('[name=name]').fill('虚构验收工作室'); await register('entities'); assert.equal(record.body.state.entities.length, 1);
    const entityId = record.body.state.entities[0].id;
    form = page.locator('form[data-form=entities]'); await form.locator('[name=name]').fill('尚未提交的虚构主体'); await page.evaluate(() => BusinessApp.whenIdle()); await page.reload(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('已连接'));
    assert.equal(await page.locator('form[data-form=entities] [name=name]').inputValue(), '尚未提交的虚构主体'); assert.equal(record.body.state.entities.length, 1);
    await tab('收支与回款'); form = page.locator('form[data-form=entries]'); await form.locator('[name=entityId]').selectOption(entityId); await form.locator('[name=title]').fill('虚构项目分期合作'); await form.locator('[name=counterparty]').fill('虚构合作方'); await form.locator('[name=amount]').fill('100.01'); await form.locator('[name=schedule]').fill('签约 | 40.00 | 2026-10-20\n交付 | 60.01 | 2026-11-20'); await register('entries');
    assert.equal(record.body.state.entries[0].amountMinor, 10001);
    await page.locator('#form-payments summary').click(); form = page.locator('form[data-form=payments]'); await form.locator('[name=entryId]').selectOption(record.body.state.entries[0].id); await form.locator('[name=installmentId]').selectOption(record.body.state.entries[0].installments[0].id); await form.locator('[name=amount]').fill('10.00'); await form.locator('[name=date]').fill('2026-10-23'); await register('payments'); assert.equal(record.body.state.payments[0].amountMinor, 1000);
    const downloaded = page.waitForEvent('download'); await page.locator('button[data-export=entries]').click(); const csvDownload = await downloaded, stream = await csvDownload.createReadStream(), pieces = []; for await (const bytes of stream) pieces.push(bytes); const csv = Buffer.concat(pieces).toString('utf8'); assert.match(csv, /虚构项目分期合作/); assert.match(csv, /30\.00/); assert.match(csv, /CNY/);
    await tab('资产管理'); form = page.locator('form[data-form=assets]'); await form.locator('[name=entityId]').selectOption(entityId); await form.locator('[name=name]').fill('虚构摄影灯'); await form.locator('[name=cost]').fill('200.00'); await register('assets');
    await page.locator('#form-assetEvents summary').click(); form = page.locator('form[data-form=assetEvents]'); await form.locator('[name=assetId]').selectOption(record.body.state.assets[0].id); await form.locator('[name=type]').selectOption('checkout'); await form.locator('[name=person]').fill('虚构经手人'); await form.locator('[name=date]').fill('2026-10-23'); await register('assetEvents'); assert.match(await page.locator('#content').textContent(), /领用中/);
    await tab('税务待办'); form = page.locator('form[data-form=taxes]'); await form.locator('[name=entityId]').selectOption(entityId); await form.locator('[name=title]').fill('虚构会计确认事项'); await form.locator('[name=period]').fill('2026-10'); await form.locator('[name=deadline]').fill('2026-11-15'); await form.locator('[name=status]').selectOption('paid'); await form.locator('[name=accountant]').fill('虚构会计'); await form.locator('[name=confirmedAt]').fill('2026-10-22'); await form.locator('[name=filedAt]').fill('2026-10-23'); await form.locator('[name=paidAt]').fill('2026-10-23'); await form.locator('[name=amount]').fill('12.34');
    const receipt = Buffer.from('fictional proof only'); await form.locator('[type=file]').setInputFiles({ name: '虚构凭据.txt', mimeType: 'text/plain', buffer: receipt }); await register('taxes'); assert.equal(record.body.state.taxes[0].amountMinor, 1234); assert.equal(files.size, 1); assert.equal([...files.values()][0].visibility, 'private');
    const originalDownload = page.waitForEvent('download'); await page.locator('[data-download]').first().click(); const d = await originalDownload, s = await d.createReadStream(), raw = []; for await (const bytes of s) raw.push(bytes); assert.deepEqual(Buffer.concat(raw), receipt);
    const before = structuredClone(record.body.state), broken = { app: 'practical-submodule', version: 1, key: 'business-v1', state: before, files: [] };
    await page.locator('#restore').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) }); await page.waitForFunction(() => document.querySelector('#error').textContent.includes('缺少匹配原件')); assert.deepEqual(record.body.state, before);
    const narrow = [];
    for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 950 }); for (const name of ['经营总览', '主体与合作', '收支与回款', '票据原件', '资产管理', '税务待办', '品牌与商品']) { await tab(name); const actual = await page.evaluate(() => document.documentElement.scrollWidth); narrow.push({ width, name, actual }); assert.ok(actual <= width, `${width}/${name} scrollWidth=${actual}`); } }
    assert.deepEqual(errors, []); assert.deepEqual([...seenProjects], ['business-hidden']);
    console.log(JSON.stringify({ test: 'business-browser', uiPersisted: true, draftReloaded: true, exactOriginalDownload: true, csvGenerated: true, invalidRestorePreserved: true, isolatedProject: true, layoutViews: narrow.length, errors }));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
