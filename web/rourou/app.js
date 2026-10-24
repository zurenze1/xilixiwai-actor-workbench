
(async () => {
const KEY = 'rourou-world-v1';
const $ = s => document.querySelector(s);
const params=new URLSearchParams(location.search);
document.body.classList.toggle('embedded',params.get('embedded')==='1');
const setTheme=theme=>{if(['tide','butter','moss'].includes(theme))document.documentElement.dataset.theme=theme;};
setTheme(params.get('theme')||'butter');
addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='workbench:theme')setTheme(e.data.theme);});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = new Date(); const ymd = d => d.toISOString().slice(0, 10);
const T0 = ymd(today);
const toast = t => { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2000); };
let S, client, draftTimer, writes = Promise.resolve(), importing = false, dirty = false, pending = 0, changeVersion=0;
const status = (text, error = false) => { $('#storageStatus').textContent = text; $('#storageStatus').classList.toggle('error', error); };
const failed = error => {
  const detail = error?.name === 'QuotaExceededError' ? '本机存储空间不足，内容尚未保存。请先导出备份，再释放空间后重试。'
    : error?.message || '请保留本页内容并重试';
  const text = '操作未完成：' + detail;
  status(text, true); toast(text);
};
try {
  if (!window.ActorStore || !window.PetSchema) throw new Error('可靠存储未加载，当前没有改动任何已保存资料。请刷新重试。');
  client = await ActorStore.open(KEY, PetSchema.fresh, PetSchema.validate);
  S = PetSchema.validate(client.state);
} catch (error) {
  failed(error); $('#main').textContent = '记录暂未打开。原数据不会被空白页覆盖；请检查存储或刷新。';
  document.querySelectorAll('.storage-actions button,.storage-actions input').forEach(el => { el.disabled = true; });
  return;
}
async function save() {
  clearTimeout(draftTimer); draftTimer = 0;
  dirty = true;
  const version=++changeVersion;
  const snapshot = PetSchema.validate(S);
  const work = writes.then(() => client.save(snapshot));
  writes = work.catch(() => {});
  pending++;
  try { await work; if(version===changeVersion)dirty = false; status(dirty?'新修改待保存…':'已保存到本机可靠存储 · 换设备前请导出完整备份'); }
  finally { pending--; }
}
function saveDraft() {
  dirty = true;
  changeVersion++;
  status('草稿待保存…');
  clearTimeout(draftTimer); draftTimer = setTimeout(() => save().catch(failed), 350);
}
async function whenIdle(){if(importing)throw Error('肉肉正在保存文件，请稍候再切换');if(dirty||draftTimer)await save();await writes;if(dirty)throw Error('肉肉资料尚未保存，请先重试或导出备份');}
window.PetModule=Object.freeze({whenIdle,flush:whenIdle,getState:()=>structuredClone(S)});
const draft = (tab = S.tab) => (S.drafts[tab] = S.drafts[tab] || {});
const stamp = () => new Date().toLocaleString('zh-CN', { hour12: false });
const objectURLs = new Map();
async function fileURL(ref) {
  if (!objectURLs.has(ref.id)) objectURLs.set(ref.id, URL.createObjectURL(await ActorStore.getFile(ref.id)));
  return objectURLs.get(ref.id);
}
async function previews() {
  for (const el of document.querySelectorAll('[data-original]')) {
    const ref = PetSchema.references(S).find(f => f.id === el.dataset.original);
    if (!ref) continue;
    try { const src = await fileURL(ref); if (el.isConnected) el.src = src; }
    catch (error) { if (el.isConnected) { el.alt = '原件暂不可读取'; el.removeAttribute('src'); } failed(error); }
  }
}
window.addEventListener('beforeunload', event => { if (dirty || pending || draftTimer || importing) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('actor-store-conflict', event => { if (event.detail?.key === KEY) failed(new Error(event.detail.message)); });
window.addEventListener('pagehide', () => { for (const url of objectURLs.values()) URL.revokeObjectURL(url); objectURLs.clear(); });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmt = d => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
const daysTo = d => Math.round((new Date(d) - new Date(T0)) / 86400000);

/* ---------- 档案（示例） ---------- */
let PROFILE,ageY,TARGET;
function profileValues(){PROFILE=S.profile;ageY=PROFILE.birth?((today-new Date(PROFILE.birth))/31557600000).toFixed(1):'';TARGET={food:(PROFILE.meals||0)*(PROFILE.gram||0),water:PROFILE.water||0,walk:PROFILE.walk||0};}
profileValues();
if (!S.health) {
  const d = n => ymd(addDays(today, n));
  S.health = [
    { id: 'core', ic: '💉', n: '犬核心疫苗（八联 / 六联）', last: d(-340), every: 365, note: '每年一次加强' },
    { id: 'rabies', ic: '🩺', n: '狂犬疫苗', last: d(-358), every: 365, note: '每年一次，办理犬证需要' },
    { id: 'in', ic: '💊', n: '体内驱虫', last: d(-80), every: 90, note: '每 3 个月' },
    { id: 'out', ic: '🧴', n: '体外驱虫（跳蚤 / 蜱虫）', last: d(-33), every: 30, note: '每月一次，春夏外出多时尤其注意' },
    { id: 'check', ic: '🏥', n: '年度体检', last: d(-200), every: 365, note: '血常规、心脏听诊、膝盖检查' },
    { id: 'teeth', ic: '🦷', n: '牙齿检查 / 洗牙评估', last: d(-150), every: 180, note: '小型犬牙结石高发' },
    { id: 'groom', ic: '✂️', n: '美容修剪', last: d(-26), every: 30, note: '修脚底毛、眼周毛，减少泪痕' }
  ];
}
if (!S.behLog) S.behLog = [
  { d: ymd(addDays(today, -6)), b: '主人出门就叫' }, { d: ymd(addDays(today, -5)), b: '主人出门就叫' }, { d: ymd(addDays(today, -5)), b: '像猪一样哼哼（反向喷嚏）' },
  { d: ymd(addDays(today, -3)), b: '一直舔爪子' }, { d: ymd(addDays(today, -2)), b: '主人出门就叫' }, { d: ymd(addDays(today, -1)), b: '摇尾巴翻肚皮' }
];
const WEIGHTS = [2.6, 2.7, 2.7, 2.8, 2.8, 2.9, 2.9, 3.0, 2.9, 2.9, 2.9, PROFILE.weight];

/* ---------- 马尔济斯品种知识 ---------- */
const BREED = {
  facts: [
    ['🏝', '起源', '来自地中海马耳他岛，是有两千多年历史的古老玩赏犬，一直被当作“陪伴犬”培育。'],
    ['🤍', '单层被毛', '没有底毛，几乎不掉毛，对过敏人群友好；但毛又长又细，容易打结，需要每天梳理。'],
    ['💧', '白色被毛与泪痕', '泪液中的卟啉氧化后呈红褐色，白毛上特别明显。每天擦拭、保持眼周干燥。'],
    ['⚖️', '体型', '成犬体重通常在 4 公斤以内，骨架小，跳上跳下要格外小心。'],
    ['🫶', '性格', '亲人、粘人、聪明、警觉，喜欢跟着主人；独处时间长容易分离焦虑。'],
    ['⏳', '寿命', '一般 12–15 年，做好牙齿和关节护理，能陪伴很久。']
  ],
  risks: [
    ['膝盖骨脱位', '小型犬常见的遗传性关节问题。表现为走路时突然抬起一条后腿跳几步。控制体重，减少从沙发、床上跳下。', 80],
    ['牙齿疾病', '小型犬牙齿拥挤，牙结石和牙周病高发。每天刷牙或用洁齿产品，定期检查。', 85],
    ['泪溢 / 泪痕', '与眼周毛发刺激、泪管、饮食都有关。泪痕突然变多要检查眼睛。', 75],
    ['气管塌陷', '小型犬气管软骨较弱。遛狗用胸背带，不用项圈；剧烈咳嗽像鹅叫要就医。', 55],
    ['低血糖', '幼犬和体型特别小的狗容易发生。长时间不吃、发抖无力时要警惕。', 45],
    ['白色犬震颤综合征', '常见于白色小型犬，表现为全身细微发抖，需要兽医诊断治疗。', 30],
    ['门静脉分流', '先天肝脏血管异常，发育慢、饭后精神差等。可通过体检血液指标筛查。', 25]
  ],
  gene: '如果想更深入了解，可以给肉肉做一次犬类基因检测，筛查遗传病风险、确认血统，并把结果存进这里。'
};
const BEH = [
  { k: ['哼哼', '猪', '反向喷嚏', '吸气'], n: '像猪一样哼哼（反向喷嚏）', lv: 'warn', t: '这很可能是“反向喷嚏”',
    why: ['小型犬、短鼻犬很常见，多由咽喉或软腭受刺激引起（兴奋、灰尘、喝水太急）', '通常几秒到一分钟会自己停下'],
    todo: ['轻轻抚摸喉咙、或让它吞咽一下，帮助停止', '记录发作频率和时长', '如果越来越频繁、伴随咳嗽或呼吸困难，要去医院排查气管塌陷'] },
  { k: ['舔爪', '啃脚', '舔脚'], n: '一直舔爪子', lv: 'warn', t: '可能是皮肤痒、过敏，或者无聊焦虑',
    why: ['马尔济斯皮肤偏敏感，季节过敏、食物过敏都可能表现为舔爪', '爪间潮湿也容易长湿疹', '主人不在、无聊时也会用舔爪来安抚自己'],
    todo: ['检查爪子之间有没有发红、潮湿、异物', '散步回来把脚擦干', '持续几天或出现红肿、掉毛，带去看医生'] },
  { k: ['出门', '叫', '拆家', '分离'], n: '主人出门就叫', lv: 'ok', t: '典型的分离焦虑，马尔济斯很常见',
    why: ['马尔济斯天生粘人，把主人当作安全感来源', '主人经常出差、作息变化大，会加重焦虑'],
    todo: ['出门前不要刻意告别，回来也先冷淡几分钟', '留一件有主人味道的衣服和嗅闻玩具', '出差期间请熟悉的人照顾，固定时间视频连线'] },
  { k: ['抬腿', '跛', '跳着走', '后腿'], n: '走路突然抬起一条后腿', lv: 'bad', t: '要警惕膝盖骨脱位',
    why: ['这是马尔济斯高发的遗传性关节问题', '膝盖骨滑出位置时，狗会抬腿跳几步，滑回去后又正常'],
    todo: ['记录发生的频率和是哪条腿', '减少从沙发、床上跳下，可以放宠物楼梯', '尽快去医院做触诊或拍片，严重程度分级很重要'] },
  { k: ['转圈', '追尾巴'], n: '转圈追尾巴', lv: 'ok', t: '多数是兴奋或玩耍',
    why: ['开心、等吃饭、等出门时都会转圈', '如果频繁追咬尾巴根部，可能是肛门腺堵塞或皮肤痒'],
    todo: ['偶尔转圈不用担心', '频繁追咬尾巴，检查肛门腺、跳蚤', '如果像停不下来的强迫行为，咨询医生或行为训练师'] },
  { k: ['吃草'], n: '出去散步吃草', lv: 'ok', t: '很常见，多数没有问题',
    why: ['可能是好奇、喜欢口感', '也可能是肠胃有点不舒服'],
    todo: ['注意草地有没有打过药', '如果吃完呕吐、拉肚子，或者频繁吃草，要留意肠胃'] },
  { k: ['泪痕', '眼睛', '红褐'], n: '眼角红褐色变深', lv: 'warn', t: '泪痕加重，需要多观察眼睛',
    why: ['白毛上的泪痕来自泪液中的卟啉', '眼周毛刺激、泪管堵塞、饮食变化都会让泪痕加重'],
    todo: ['每天用干净的湿巾擦拭，保持干燥', '修剪眼周的毛', '突然变多、眼睛发红或分泌物变黄，去医院检查'] },
  { k: ['发抖', '抖'], n: '身体发抖', lv: 'warn', t: '可能是冷、紧张，也可能是低血糖',
    why: ['小型犬怕冷，紧张时也会抖', '长时间没吃东西、精神差的发抖，要警惕低血糖', '白色小型犬还可能是“白色犬震颤综合征”'],
    todo: ['先保暖、安抚', '如果很久没吃东西、走路无力，喂一点葡萄糖水并立刻就医', '反复全身发抖，请医生诊断'] },
  { k: ['翻肚皮', '摇尾巴', '开心'], n: '摇尾巴翻肚皮', lv: 'ok', t: '放松、信任你',
    why: ['翻肚皮是把最脆弱的地方露出来，代表很有安全感'], todo: ['摸摸它，这是你们关系很好的信号'] },
  { k: ['不吃', '拒食', '没胃口'], n: '一天以上不吃东西', lv: 'bad', t: '小型犬不吃饭要重视',
    why: ['小型犬能量储备少，长时间不吃容易低血糖', '可能是肠胃、牙齿疼痛或其他疾病'],
    todo: ['先确认有没有呕吐、腹泻、精神差', '超过 24 小时不吃，尽快去医院'] }
];
const LV = { ok: ['正常', 'ok'], warn: ['多观察', 'warn'], bad: ['建议就医', 'bad'] };

/* ---------- 今天 ---------- */
const day = () => (S.logs[T0] = S.logs[T0] || { food: [], water: 0, walk: [], poop: [], care: {} });
function ring(v, max, color, label, unit) {
  const p = max>0?Math.min(1, v / max):0, R = 40, L = 2 * Math.PI * R;
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${L * p} ${L}" transform="rotate(-90 50 50)" style="transition:stroke-dasharray .6s"/><text x="50" y="55" text-anchor="middle" font-size="18" font-weight="700" fill="var(--ink)">${Math.round(p * 100)}%</text></svg><b>${label}</b><small>${v}/${max} ${unit}</small></div>`;
}
const now = () => new Date().toTimeString().slice(0, 5);
function vToday() {
  const L = day(), food = L.food.reduce((a, x) => a + x.g, 0);
  const care = [['brush', '🪮', '梳毛'], ['tear', '💧', '擦泪痕'], ['teeth', '🦷', '刷牙']];
  const evs = [...L.food.map(x => [x.t, `🍚 喂食 ${x.g} 克`]), ...L.walk.map(x => [x.t, `🐾 遛弯 ${x.m} 分钟`]), ...L.poop.map(x => [x.t, `💩 便便 · ${x.s}`]), ...(L.waterLog || []).map(x => [x.t, `💧 加水 ${x.ml} 毫升`]), ...care.filter(c => L.care[c[0]]).map(c => [L.care[c[0]], `${c[1]} ${c[2]}`])].sort();
  return `<div class="rings">${ring(food, TARGET.food, '#c9825b', '吃饭', '克')}${ring(L.water, TARGET.water, '#6aa6c9', '喝水', '毫升')}${ring(L.walk.length, TARGET.walk, '#5e9e72', '遛弯', '次')}${ring(care.filter(c => L.care[c[0]]).length, 3, '#d49ab0', '护理', '项')}</div>
  <div class="grid2 mt">
    <div class="card"><div class="row between"><h3>一键记录</h3><span class="small muted">${fmt(today)}</span></div><p class="sub">谁在照顾肉肉都可以顺手点一下（演示版保存在当前设备）</p>
      <div class="quick mt">
        <button class="q" data-a="food"><span class="ic">🍚</span><b>喂食</b><small>+${PROFILE.gram} 克</small></button>
        <button class="q" data-a="water"><span class="ic">💧</span><b>加水</b><small>+50 毫升</small></button>
        <button class="q" data-a="walk"><span class="ic">🐾</span><b>遛弯</b><small>+20 分钟</small></button>
        <button class="q" data-a="poop"><span class="ic">💩</span><b>便便</b><small>记录状态</small></button>
        ${care.map(c => `<button class="q ${L.care[c[0]] ? 'done' : ''}" data-a="care" data-v="${c[0]}"><span class="ic">${c[1]}</span><b>${c[2]}</b><small>${L.care[c[0]] ? '✓ ' + L.care[c[0]] : '每天一次'}</small></button>`).join('')}
        <button class="q" data-a="reset"><span class="ic">↺</span><b>清空今天</b><small>演示用</small></button>
      </div>
      <div class="poop mt8" id="poopPick" hidden>${['正常', '偏软', '拉稀', '有血 / 异常'].map(s => `<button class="btn sm" data-a="poopset" data-v="${s}">${s}</button>`).join('')}</div></div>
    <div class="card"><h3>今天的肉肉</h3><p class="sub">吃饭计划 ${TARGET.food||'待填'} 克（${PROFILE.meals??'待填'} 顿）· 加水计划 ${TARGET.water||'待填'} 毫升（来自手动档案，可修改）</p>
      <ul class="tl mt8">${evs.map(([t, x]) => `<li><span class="tm">${esc(t)}</span><span>${esc(x)}</span></li>`).join('') || '<li class="muted">今天还没有记录，点左边的按钮开始吧。</li>'}</ul>
      ${tips(L, food)}</div>
  </div>`;
}
function tips(L, food) {
  const t = [], h = new Date().getHours();
  if (h >= 13 && food < TARGET.food / 2) t.push('已经下午了，肉肉今天吃得偏少，留意一下胃口。');
  if (h >= 16 && L.water < TARGET.water / 2) t.push('喝水偏少，可以在碗里换新鲜的水，或者加点温水泡粮。');
  if (L.poop.some(p => p.s !== '正常')) t.push('今天便便不太正常，注意饮食，持续或带血请就医。');
  if (!L.care.tear && h >= 18) t.push('今天还没擦泪痕哦。');
  return t.length ? `<div class="note" style="border-color:var(--accent2)">${t.map(x => '✦ ' + x).join('<br>')}</div>` : '';
}

/* ---------- 健康档案 ---------- */
function vHealth() {
  const rows = S.health.map(h => { const next = addDays(new Date(h.last), h.every); const n = daysTo(next); const lv = n < 0 ? 'bad' : n <= 14 ? 'warn' : ''; return { ...h, next, dl: n, lv }; }).sort((a, b) => a.dl - b.dl);
  const weights=[...WEIGHTS.slice(0,-1),PROFILE.weight||WEIGHTS.at(-1)],low=Math.min(2.2,...weights)-.1,high=Math.max(3.8,...weights)+.1,W = 560, H = 190, x = i => 40 + i * (W - 60) / 11, y = v => 160 - (v-low)/(high-low)*140;
  return `<div class="grid2">
    <div class="card"><div class="row between"><h3>疫苗、驱虫与体检</h3><span class="tag demo">示例记录</span></div><p class="sub">按“上次日期 + 周期”自动算出下次时间，快到期时提醒</p>
      <div class="mt8">${rows.map(r => `<div class="rec"><div class="ic">${esc(r.ic)}</div><div><b>${esc(r.n)}</b><div class="small muted">上次 ${fmt(new Date(r.last))} · ${esc(r.note)}</div></div>
        <div class="cd"><strong class="${r.lv}">${r.dl < 0 ? '已过期 ' + (-r.dl) : r.dl} 天</strong>${r.dl < 0 ? '请尽快安排' : '下次 ' + fmt(r.next)}<br><button class="btn sm mt8" data-a="done" data-v="${esc(r.id)}">今天已完成</button></div></div>`).join('')}</div></div>
    <div>
      <div class="card"><div class="row between"><h3>体重趋势</h3><span class="small muted">历史点为示例</span></div><p class="sub">末点来自档案中的当前体重；历史月份为演示，不自动判断健康范围。</p>
        <svg class="chart" viewBox="0 0 ${W} ${H}"><rect x="30" y="${y(3.4)}" width="${W - 40}" height="${y(2.5) - y(3.4)}" fill="#e1f0e5" rx="6"/>
          <path d="${weights.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
          ${weights.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#fff" stroke="var(--accent)" stroke-width="2"/>${i % 2 === 1 || i === 11 ? `<text x="${x(i)}" y="${y(v) - 10}" text-anchor="middle">${v}</text>` : ''}<text x="${x(i)}" y="182" text-anchor="middle">${addDays(today, -30 * (11 - i)).getMonth() + 1}月</text>`).join('')}
        </svg>
        <div class="row mt8"><span class="tag">当前 ${PROFILE.weight??'待填'} 公斤</span><button class="btn sm" data-a="tab" data-v="profile">修改档案与计划</button></div></div>
      <div class="card mt"><h3>添加一条记录</h3><div class="grid2 mt8">
        <div class="field"><label for="hSel">项目</label><select id="hSel">${S.health.map(h => `<option value="${esc(h.id)}" ${draft().healthId === h.id ? 'selected' : ''}>${esc(h.n)}</option>`).join('')}</select></div>
        <div class="field"><label for="hDate">日期</label><input id="hDate" type="date" value="${esc(draft().healthDate || T0)}"></div></div>
        <div class="row mt8"><button class="btn pri" data-a="hadd">保存</button><span class="small muted">保存后自动更新下次提醒</span></div></div>
    </div></div>`;
}

/* ---------- 品种档案 ---------- */
function vBreed() {
  return `<div class="card"><div class="row between"><div><h3>马尔济斯 · 品种档案</h3><p class="sub">了解它的天性，才知道该怎么照顾它</p></div><span class="tag">Maltese</span></div>
    <div class="grid3 mt">${BREED.facts.map(f => `<div class="fact"><span class="ic">${f[0]}</span><b>${f[1]}</b><p>${f[2]}</p></div>`).join('')}</div></div>
  <div class="card mt"><h3>遗传与常见健康风险</h3><p class="sub">品种常见，不代表肉肉一定会有；知道了，就能提早预防</p>
    <div class="mt8">${BREED.risks.map(r => `<div class="risk"><b>${r[0]}</b><span class="muted">${r[1]}</span><div><span class="small muted">品种常见程度</span><div class="meter"><i style="width:${r[2]}%"></i></div></div></div>`).join('')}</div>
    <p class="note">${BREED.gene}</p></div>
  <div class="card mt"><h3>马尔济斯的照顾要点</h3><div class="grid4 mt8">
    ${[['🪮', '每天梳毛', '单层长毛易打结，从毛尖往根部梳'], ['💧', '每天擦泪痕', '保持眼周干燥，定期修眼周毛'], ['🦷', '每天刷牙', '小型犬牙结石高发'], ['🦮', '用胸背带', '保护气管，不用项圈'], ['🛋', '少跳高', '放宠物楼梯，保护膝盖'], ['🍗', '少量多餐', '防低血糖，控制零食'], ['🧥', '注意保暖', '体型小、怕冷'], ['🫂', '多陪伴', '容易分离焦虑']].map(x => `<div class="fact"><span class="ic">${x[0]}</span><b>${x[1]}</b><p>${x[2]}</p></div>`).join('')}</div></div>`;
}

/* ---------- AI 行为解读 ---------- */
let answer = null, thinking = false;
function vBeh() {
  const cnt = {}; S.behLog.forEach(x => { cnt[x.b] = (cnt[x.b] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...top.map(t => t[1]));
  const sep = cnt['主人出门就叫'] || 0;
  return `<div class="grid2">
    <div><div class="card"><h3>肉肉在做什么？</h3><p class="sub">点一个常见行为，或者用自己的话描述</p>
      <div class="behs mt">${BEH.map((b, i) => `<button data-a="beh" data-v="${i}">${b.n}</button>`).join('')}</div>
      <div class="ask"><input id="behIn" aria-label="描述肉肉的行为" placeholder="例如：肉肉今天一直舔脚，还不太想吃饭" value="${esc(draft().behavior || '')}"><button class="btn pri" data-a="askbeh">查看预置解读</button></div><p class="sub">演示按关键词匹配预置内容，不会调用模型。</p></div>
      <div class="mt" id="ans">${thinking ? '' : answer ? answerHTML(answer) : ''}</div></div>
    <div class="card"><div class="row between"><h3>行为记录与规律</h3><span class="small muted">近 7 天 · ${S.behLog.length} 条</span></div>
      <div class="bars">${top.map(([n, c]) => `<div><span>${esc(n.split('（')[0])}</span><i><b style="width:${c / max * 100}%"></b></i><span class="small muted">${c}</span></div>`).join('')}</div>
      ${sep >= 2 ? `<div class="note" style="border-color:var(--accent2)">✦ AI 发现：“主人出门就叫”近 7 天出现 ${sep} 次，和你的出差时间重合。出差前可以提前做独处训练，并把托管卡交给照顾它的人。</div>` : ''}
      <ul class="blog mt">${S.behLog.slice().reverse().slice(0, 8).map(x => `<li><span class="muted">${x.d.slice(5).replace('-', '/')}</span><span>${esc(x.b)}</span><span></span></li>`).join('')}</ul></div>
  </div>`;
}
function answerHTML(a) {
  const [t, c] = LV[a.lv];
  return `<div class="answer"><div class="row between"><h4>${a.t}</h4><span class="tag ${c}">${t}</span></div>
    <p class="small muted mt8">${a.custom ? `你描述的是：“${esc(a.custom)}”` : '行为：' + esc(a.n)}</p>
    <div class="grid2 mt8"><div><b class="small">可能的原因</b><ul>${a.why.map(x => `<li>${x}</li>`).join('')}</ul></div><div><b class="small">建议怎么做</b><ul>${a.todo.map(x => `<li>${x}</li>`).join('')}</ul></div></div>
    <p class="note">演示模式：按关键词匹配预置解读。正式版接入大模型，并结合肉肉的年龄、体重和历史记录分析。健康问题以宠物医生判断为准。</p></div>`;
}
function interpret(b, custom) {
  thinking = true; answer = null;
  $('#ans').innerHTML = `<div class="thinking"><span class="spin"></span>AI 正在分析<ol><li>识别行为特征</li><li>对照马尔济斯的品种特点</li><li>结合肉肉最近的记录</li><li>判断要不要就医</li></ol></div>`;
  const lis = [...document.querySelectorAll('#ans li')];
  lis.forEach((li, i) => setTimeout(() => li.classList.add('in'), 150 + i * 380));
  setTimeout(() => {
    thinking = false;
    answer = b ? { ...b, custom } : { t: '已记录，先多观察', lv: 'warn', why: ['这个描述没有匹配到常见行为库', '可能需要更多细节：持续多久、频率、精神和食欲'], todo: ['补充描述，或者拍一段视频存下来', '如果伴随精神差、不吃不喝、呕吐腹泻，尽快就医'], custom, n: custom };
    S.behLog.push({ d: T0, b: b ? b.n : custom });
    save().then(() => { render(); toast('已记录预置解读'); }).catch(failed);
  }, 300 + lis.length * 380);
}

/* ---------- 出差托管 ---------- */
const contactLabels = {
  ownerName: '主人姓名', ownerPhone: '主人联系电话', assistantName: '助理 / 照顾者姓名', assistantPhone: '助理 / 照顾者电话',
  hospitalName: '常去医院名称', hospitalPhone: '常去医院电话', hospitalAddress: '常去医院地址',
  emergencyName: '24小时急诊医院名称', emergencyPhone: '24小时急诊电话', emergencyAddress: '24小时急诊地址', careNote: '交接补充说明'
};
function contactFields(keys, values) {
  return keys.map(k => `<div class="field"><label for="contact-${k}">${contactLabels[k]}</label><input id="contact-${k}" data-contact="${k}" type="${k.endsWith('Phone') ? 'tel' : 'text'}" value="${esc(values[k])}" autocomplete="off" maxlength="${k === 'careNote' ? 10000 : 1000}"></div>`).join('');
}
function contactLine(label, name, phone, address) {
  return `<li><strong>${label}：</strong><span class="contact-value">${esc([name, phone, address].filter(Boolean).join(' · ') || '未填写')}</span></li>`;
}
async function saveContacts() {
  S.contacts = { ...S.contacts, ...(draft('care').contacts || {}) };
  delete draft('care').contacts;
  await save();
}
function vCare() {
  const from = addDays(today, 1), to = addDays(today, 6);
  const contacts = { ...S.contacts, ...(draft('care').contacts || {}) };
  return `<div class="card noprint"><div class="row between"><div><h3>出差期间，谁来照顾肉肉？</h3><p class="sub">按示例出差安排：${fmt(from)} – ${fmt(to)} 成都 → 重庆 → 上海，共 6 天</p></div><button class="btn pri" data-a="print">打印 / 保存托管卡</button></div></div>
  <section class="card mt contacts-form noprint" aria-labelledby="contacts-title"><h3 id="contacts-title">填写托管联系方式</h3><p class="sub">只保存在本机。保存后显示在下方托管卡；打印也会带入当前填写内容。</p>
    <fieldset><legend>主人与助理 / 照顾者</legend><div class="grid2">${contactFields(['ownerName','ownerPhone','assistantName','assistantPhone'], contacts)}</div></fieldset>
    <fieldset><legend>常去的宠物医院</legend><div class="grid2">${contactFields(['hospitalName','hospitalPhone','hospitalAddress'], contacts)}</div></fieldset>
    <fieldset><legend>24小时急诊医院</legend><div class="grid2">${contactFields(['emergencyName','emergencyPhone','emergencyAddress'], contacts)}</div></fieldset>
    <div class="field"><label for="contact-careNote">交接补充说明</label><textarea id="contact-careNote" data-contact="careNote" rows="3" maxlength="10000">${esc(contacts.careNote)}</textarea></div>
    <button class="btn pri mt8" data-a="contacts">保存托管联系方式</button>
  </section>
  <div class="handoff mt"><div class="row between"><h3>🐾 肉肉托管卡</h3><span class="small muted">${fmt(from)} – ${fmt(to)}</span></div>
    <div class="hgrid">
      <div><h4>吃饭</h4><ul><li>${esc(PROFILE.food||'主粮待填写')}，每天 ${PROFILE.meals??'待填'} 顿，每顿 ${PROFILE.gram??'待填'} 克（按实际安排调整）</li><li>少量多餐，不额外加零食</li><li>每顿吃完在小世界里点一下「喂食」</li></ul></div>
      <div><h4>喝水</h4><ul><li>每天约 ${TARGET.water} 毫升，水碗每天换两次</li><li>喝得少可以用温水泡粮</li></ul></div>
      <div><h4>每天要做</h4><ul><li>遛弯计划 ${TARGET.walk||'待填'} 次，每次时长按实际安排</li><li>梳毛、擦泪痕、刷牙</li><li>固定时间联系照顾者</li></ul></div>
      <div><h4>绝对不能吃</h4><ul class="no"><li>巧克力、葡萄 / 葡萄干、洋葱、大蒜</li><li>木糖醇（口香糖、无糖食品）、酒精、咖啡</li><li>煮过的骨头、太咸太油的人类食物</li></ul></div>
      <div><h4>需要注意</h4><ul><li>不要让它从沙发上跳下来（保护膝盖）</li><li>发抖无力、超过一天不吃 → 立刻联系</li><li>突然像猪哼哼（反向喷嚏）一般会自己停下</li></ul></div>
      <div><h4>紧急联系</h4><ul>${contactLine('主人', S.contacts.ownerName, S.contacts.ownerPhone)}${contactLine('助理 / 照顾者', S.contacts.assistantName, S.contacts.assistantPhone)}${contactLine('常去的宠物医院', S.contacts.hospitalName, S.contacts.hospitalPhone, S.contacts.hospitalAddress)}${contactLine('24小时急诊医院', S.contacts.emergencyName, S.contacts.emergencyPhone, S.contacts.emergencyAddress)}</ul></div>
    </div>
    ${S.contacts.careNote ? `<div class="mt"><h4>交接补充说明</h4><p class="contact-value">${esc(S.contacts.careNote)}</p></div>` : ''}
    <p class="small muted mt">${S.health.filter(h => daysTo(addDays(new Date(h.last), h.every)) <= 14).map(h => `⚠ ${esc(h.n)}将在出差期间到期，请提前安排`).join('<br>')}</p>
  </div>`;
}

/* ---------- 时光机 ---------- */
const PET_SAMPLE_PHOTOS=[['12_maltese','在家等你回来的一天'],['16_maltese_walk','第一次穿新的胸背带出去散步'],['17_maltese_groom','每天的梳毛时间'],['18_maltese_sleep','晒着太阳睡着了']];
let albumOrbit = false;
function photoViewControls(){return `<section class="card mt photo-view-controls"><div class="row between"><div><h3>把照片，转到眼前。</h3><p class="sub">照片网格便于找原件；环绕看图可以拖动、暂停和放大，只改变浏览方式。</p></div><div class="row"><button class="btn sm ${albumOrbit?'':'pri'}" data-a="album-view" data-v="grid">照片网格</button><button class="btn sm ${albumOrbit?'pri':''}" data-a="album-view" data-v="orbit">环绕看图 ✦</button></div></div></section><section id="petPhotoOrbit" data-photo-orbit data-orbit-source=".album .ph img" ${albumOrbit?'':'hidden'} aria-label="肉肉照片环绕视图"></section>`;}
function vAlbum() {
  const base = PET_SAMPLE_PHOTOS;
  return `<div class="row between"><div><h3 style="font:600 20px var(--serif)">肉肉的时光机</h3><p class="sub">拍戏间隙，把和肉肉的日常存下来</p></div></div>
  ${photoViewControls()}<div class="album mt" id="petPhotoGrid" ${albumOrbit?'hidden':''}>${base.map(([p, c], i) => `<div class="ph"><img src="../assets/photos/${p}.jpg" alt="" onerror="this.parentNode.style.display='none'"><div>${c}<small>${fmt(addDays(today, -i * 23 - 2))}</small><button class="btn sm" data-a="photo-sticker" data-v="sample-${p}">做成表情包 ☺</button></div></div>`).join('')}
    ${S.photos.map((p, i) => `<div class="ph"><img ${p.file ? `data-original="${esc(p.file.id)}"` : `src="${p.src}"`} alt="${esc(p.c || '肉肉的照片')}" loading="lazy"><div>${esc(p.c)}<small>${esc(p.d)}</small><small>${p.file ? '已保存原件 · ' + esc(p.file.name) : '旧版照片副本，无法还原上传前原件'}</small><div class="file-actions"><button class="btn sm" data-a="photo-sticker" data-v="${esc(p.id)}">做成表情包 ☺</button><button class="btn sm" data-a="photo-download" data-v="${i}">${p.file ? '下载照片原件' : '下载现存副本'}</button><button class="btn sm" data-a="photo-remove" data-v="${i}">移除照片</button></div></div></div>`).join('')}
    <label class="add"><input type="file" accept="image/*" id="ph" multiple hidden><div><div style="font-size:30px">＋</div>添加照片原件<br><small>保存在本机，支持完整备份</small></div></label></div>
    <div class="card mt"><h3>下一张照片的说明</h3><div class="grid2 mt8"><div class="field"><label for="photoCaption">照片说明</label><input id="photoCaption" maxlength="5000" value="${esc(draft().photoCaption || '')}" placeholder="今天发生了什么"></div><div class="field"><label for="photoDate">照片日期</label><input id="photoDate" type="date" value="${esc(draft().photoDate || T0)}"></div></div><p class="sub">上传时带入以上说明和日期；未填写说明时使用原文件名。</p></div>`;
}

/* ---------- 可编辑档案与本机表情工坊 ---------- */
function vProfile(){
 const p={...S.profile,...(draft('profile').profile||{})},contacts={...S.contacts,...(draft('care').contacts||{})};
 const field=(key,label,type='text')=>`<div class="field"><label for="profile-${key}">${label}</label><input id="profile-${key}" data-profile="${key}" type="${type}" ${type==='number'?'min="0" step="'+(['meals','walk'].includes(key)?'1':'any')+'"':''} maxlength="1000" value="${esc(p[key]??'')}"></div>`;
 return `<section class="card"><div class="row between"><div><h3>📋 ${esc(p.name||'肉肉')}的档案</h3><p class="sub">生日、体重与饮食初值是原演示资料。请按实际情况确认；计划由你和照顾者填写，不自动作健康判断。</p></div><span class="tag">可编辑 · 本机保存</span></div><div class="grid2 mt">${[['name','名字'],['breed','品种'],['birth','生日（不知道可留空）','date'],['sex','性别 / 绝育情况'],['weight','目前体重（公斤）','number'],['targetWeight','目标体重（公斤，可留空）','number'],['food','目前主粮'],['meals','每天计划几顿','number'],['gram','每顿计划多少克','number'],['water','每天加水计划（毫升）','number'],['walk','每天散步计划次数','number']].map(args=>field(...args)).join('')}</div><div class="field mt8"><label for="profile-notes">照护习惯、禁忌和医生交代</label><textarea id="profile-notes" data-profile="notes" rows="3" maxlength="10000">${esc(p.notes)}</textarea></div><p class="sub mt8">填写时先保存草稿；点下方“保存档案与联系”后，今天的照护计划与托管卡同步采用这些值。</p></section><section class="card mt contacts-form"><h3>☎ 联系人与交接资料</h3><p class="sub">与“出差托管”共用同一组联系资料，不需要重复填写。</p><div class="grid2 mt8">${contactFields(PetSchema.contactKeys.filter(k=>k!=='careNote'),contacts)}</div><div class="field mt8"><label for="contact-careNote">交接补充说明</label><textarea id="contact-careNote" data-contact="careNote" maxlength="10000" rows="3">${esc(contacts.careNote)}</textarea></div><button class="btn pri mt8" data-a="profile-save">保存档案与联系</button></section>`;
}
function studioPhotos(){return [...PET_SAMPLE_PHOTOS.map(([id,c])=>({id:'sample-'+id,c,src:'../assets/photos/'+id+'.jpg',example:true})),...S.photos];}
function selectedStudioPhoto(){const photos=studioPhotos();return photos.find(p=>p.id===S.studio.photoId)||photos[0];}
function vStudio(){
 const photo=selectedStudioPhoto(),p=S.studio;
 return `<div class="grid2 pet-studio"><section class="card"><div class="row between"><h3>☺ 把肉肉做成一句话</h3><span class="tag">实际生成 PNG</span></div><p class="sub">可选原来的狗狗配图、自己上传的照片原件或旧版照片副本。只在本机排版；不改原图、不调用模型。</p><div class="field mt"><label for="studio-photoId">选择照片</label><select id="studio-photoId" data-studio="photoId">${studioPhotos().map(x=>`<option value="${esc(x.id)}" ${x.id===photo?.id?'selected':''}>${esc((x.example?'原有配图 · ':'我的照片 · ')+(x.c||x.file?.name||'照片'))}</option>`).join('')}</select></div><div class="field mt8"><label for="studio-caption">表情文字（建议24字以内）</label><textarea id="studio-caption" data-studio="caption" maxlength="100" rows="3">${esc(p.caption)}</textarea></div><div class="grid2 mt8"><div class="field"><label for="studio-layout">文字位置</label><select id="studio-layout" data-studio="layout">${[['bottom','文字在下'],['top','文字在上'],['square','叠在照片上']].map(([k,n])=>`<option value="${k}" ${p.layout===k?'selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label for="studio-fontFamily">字体风格</label><select id="studio-fontFamily" data-studio="fontFamily"><option value="sans" ${p.fontFamily==='sans'?'selected':''}>干净粗黑体</option><option value="serif" ${p.fontFamily==='serif'?'selected':''}>温柔宋体</option></select></div><div class="field"><label for="studio-background">画布背景色</label><input type="color" id="studio-background" data-studio="background" value="${p.background}"></div><div class="field"><label for="studio-textColor">文字颜色</label><input type="color" id="studio-textColor" data-studio="textColor" value="${p.textColor}"></div></div><div class="field mt8"><label for="studio-fontSize">起始字号（24–80，过长会自动缩小）</label><input type="range" id="studio-fontSize" data-studio="fontSize" min="24" max="80" step="2" value="${p.fontSize}"></div><div class="row mt"><button class="btn pri" data-a="sticker-export">下载 PNG 表情包</button><button class="btn" data-a="tab" data-v="album">去上传自己的照片</button></div><p class="sub mt8">720 × 720 PNG。原件仍在时光机，可独立下载并随完整备份带走；旧版照片只能保留现存副本。</p></section><section class="card"><h3>导出预览</h3><canvas id="stickerCanvas" width="720" height="720" aria-label="肉肉表情包预览"></canvas><p id="stickerStatus" class="sub">正在排版…</p></section></div>`;
}
let drawing=0;
async function drawSticker(target){
 const run=++drawing,photo=selectedStudioPhoto(),options={...S.studio};if(!photo)throw Error('先选择一张照片');
 const source=photo.file?await fileURL(photo.file):photo.src,canvas=target||document.createElement('canvas');await PetSticker.draw(canvas,source,options);
 if(!target&&run===drawing&&S.tab==='studio'){const visible=$('#stickerCanvas');if(visible){visible.width=720;visible.height=720;visible.getContext('2d').drawImage(canvas,0,0);$('#stickerStatus').textContent='720 × 720 PNG · '+(photo.example?'使用原有狗狗配图':photo.file?'使用已保存照片原件':'使用旧版照片副本');}}
 return canvas;
}

/* ---------- 框架 ---------- */
function vGarden(){return '<section class="card"><h3>🐾 陪伴小院</h3><p class="sub">和'+esc(PROFILE.name||'肉肉')+'玩一会儿。此处为当次互动，不生成健康或照护记录。</p><div id="petGardenHost" class="mt"></div></section>';}

const TABS = [['today', '🐾 今天'], ['garden','♡ 陪伴小院'], ['profile','📋 肉肉档案'], ['health', '💉 健康档案'], ['breed', '📖 品种档案'], ['beh', '✦ AI 行为解读'], ['care', '🧳 出差托管'], ['album', '📷 时光机'], ['studio','☺ 表情工坊']];
const VIEW = { garden:vGarden, today: vToday, profile:vProfile, health: vHealth, breed: vBreed, beh: vBeh, care: vCare, album: vAlbum, studio:vStudio };
function render() {
  window.PetGarden?.destroy();
  profileValues();const title=(PROFILE.name||'肉肉')+'的小世界';if($('#petTitle').textContent!==title)$('#petTitle').textContent=title;
  const due = S.health.filter(h => daysTo(addDays(new Date(h.last), h.every)) <= 14).length;
  $('#badges').innerHTML = `<span class="badge">🐶 ${esc(PROFILE.breed||'品种待填写')}</span><span class="badge">🎂 ${ageY?ageY+' 岁':'生日待填写'}</span><span class="badge">⚖️ ${PROFILE.weight??'待填'} 公斤</span><span class="badge">${due ? `⏰ ${due} 项即将到期` : '✓ 健康项目都按时'}</span>`;
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-a="tab" data-v="${k}" aria-current="${S.tab === k ? 'page' : 'false'}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('');
  S.notes = S.notes || {};
  const nl = S.notes[S.tab] || [];
  $('#main').innerHTML = VIEW[S.tab]() + `<section class="card mt notes"><div class="row between"><div><h3>✍️ 我的记录 / 决定</h3><p class="sub">看完上面的信息，写下你们最后决定怎么做；也可以导入疫苗本照片、体检报告、医生的话</p></div><span class="tag ${nl.length ? 'ok' : ''}">${nl.length ? nl.length + ' 条' : '还没有记录'}</span></div>
    <div class="field mt8"><label for="noteIn">本页记录草稿</label><textarea id="noteIn" rows="3" placeholder="记录照顾安排或待办事项">${esc(draft().note || '')}</textarea></div>
    <div class="row between mt8"><label class="btn sm" style="cursor:pointer">📎 导入附件原件<input type="file" id="noteFile" multiple hidden></label><button class="btn pri" data-a="note">保存记录</button></div>
    ${nl.length ? `<ul class="tl mt8">${nl.slice().reverse().map((n, j) => `<li><span class="tm">${esc(n.at)}</span><span style="flex:1">${n.attachment && /^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(n.attachment.type) ? `<img class="file-preview" data-original="${esc(n.attachment.id)}" alt="附件预览">` : n.img ? `<img class="file-preview" src="${n.img}" alt="旧版缩略图">` : ''}${esc(n.text)}${n.attachment ? `<small class="muted"> · 原件 ${n.attachment.size} 字节</small><span class="file-actions"><button class="btn sm" data-a="file-download" data-v="${esc(n.attachment.id)}">下载附件原件</button></span>` : n.file ? '<small class="muted"> · 旧版仅有文件名或缩略图，原件未存入；可重新导入原件。</small>' : ''}</span><button class="btn sm" data-a="notedel" data-v="${nl.length - 1 - j}">移除记录</button></li>`).join('')}</ul>` : ''}</section>`;
  previews();
  if(S.tab==='garden')window.PetGarden?.mount($('#petGardenHost'),{name:PROFILE.name||'肉肉'});
  if(S.tab==='studio')drawSticker().catch(error=>{if($('#stickerStatus'))$('#stickerStatus').textContent=error.message;});
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
document.addEventListener('input', e => {
  const id = e.target.id;
  if(e.target.dataset.profile){(draft('profile').profile??={})[e.target.dataset.profile]=e.target.value;saveDraft();return;}
  if(e.target.dataset.studio){const key=e.target.dataset.studio;S.studio[key]=key==='fontSize'?Number(e.target.value):e.target.value;drawSticker().catch(error=>{if($('#stickerStatus'))$('#stickerStatus').textContent=error.message;});saveDraft();return;}
  if (id === 'noteIn') draft().note = e.target.value;
  else if (id === 'behIn') draft().behavior = e.target.value;
  else if (id === 'hSel') draft().healthId = e.target.value;
  else if (id === 'hDate') draft().healthDate = e.target.value;
  else if (id === 'photoCaption') draft().photoCaption = e.target.value;
  else if (id === 'photoDate') draft().photoDate = e.target.value;
  else if (e.target.dataset.contact) {
    const contacts = draft('care').contacts || (draft('care').contacts = {});
    contacts[e.target.dataset.contact] = e.target.value;
  } else return;
  saveDraft();
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (importing) return toast('文件正在保存，请稍候');
  const a = el.dataset.a, v = el.dataset.v, L = day();
  el.disabled = true;
  try {
  switch (a) {
    case 'album-view': {
  albumOrbit=v==='orbit';$('#petPhotoGrid').hidden=albumOrbit;$('#petPhotoOrbit').hidden=!albumOrbit;
  document.querySelectorAll('[data-a="album-view"]').forEach(b=>b.classList.toggle('pri',b.dataset.v===(albumOrbit?'orbit':'grid')));
  window.ActorGalleryEffects?.refresh();break;
 }
 case 'tab': { const previous = S.tab; S.tab = v; try { await save(); } catch (error) { S.tab = previous; throw error; } render(); break; }
    case 'profile-save': {const p={...S.profile,...(draft('profile').profile||{})};if(!p.name.trim())throw Error('请填写名字');if(p.birth&&p.birth>T0)throw Error('生日不能晚于今天');for(const k of ['weight','targetWeight','meals','gram','water','walk']){const value=p[k];p[k]=value===''||value===null?null:Number(value);}const checked=PetSchema.validate({...S,profile:p});S.profile=checked.profile;delete draft('profile').profile;S.contacts={...S.contacts,...(draft('care').contacts||{})};delete draft('care').contacts;await save();render();toast('档案、照护计划和联系方式已保存');break;}
    case 'photo-sticker': {if(!studioPhotos().some(p=>p.id===v))throw Error('照片不存在');S.studio.photoId=v;S.tab='studio';await save();render();break;}
    case 'sticker-export': {await save();importing=true;try{const canvas=await drawSticker(document.createElement('canvas'));if(!canvas)throw Error('请先选择照片');downloadBlob(await PetSticker.png(canvas),(PROFILE.name||'肉肉')+'表情-'+T0+'.png');toast('720×720 PNG 已生成；照片原件保持不变');}finally{importing=false;}break;}
    case 'food': if(!(PROFILE.gram>0))throw Error('请先在肉肉档案填写每顿计划克数');L.food.push({ t: now(), g: PROFILE.gram }); await save(); render(); toast('已记录喂食'); break;
    case 'water': L.water += 50; (L.waterLog = L.waterLog || []).push({ t: now(), ml: 50 }); await save(); render(); toast('已记录加水'); break;
    case 'walk': L.walk.push({ t: now(), m: 20 }); await save(); render(); toast('已记录遛弯'); break;
    case 'poop': $('#poopPick').hidden = !$('#poopPick').hidden; break;
    case 'poopset': L.poop.push({ t: now(), s: v }); await save(); render(); toast(v === '正常' ? '已记录' : '已记录，注意观察'); break;
    case 'care': if (L.care[v]) delete L.care[v]; else L.care[v] = now(); await save(); render(); break;
    case 'reset': if (!window.confirm('清空今天的照顾记录？其他日期、草稿和附件会保留。')) break; delete S.logs[T0]; await save(); render(); toast('已清空今天的记录'); break;
    case 'done': { const h = S.health.find(x => x.id === v); if (!h) throw new Error('没有找到该健康项目'); h.last = T0; await save(); render(); toast('已更新，下次提醒已重新计算'); break; }
    case 'hadd': { const h = S.health.find(x => x.id === $('#hSel').value); if (!h) throw new Error('请先选择健康项目'); h.last = $('#hDate').value || T0; await save(); render(); toast('已保存健康记录'); break; }
    case 'beh': interpret(BEH[+v]); break;
    case 'askbeh': { const q = $('#behIn').value.trim(); if (!q) return toast('先描述一下肉肉的行为'); interpret(BEH.find(b => b.k.some(k => q.includes(k))), q); break; }
    case 'contacts': await saveContacts(); render(); toast('托管联系方式已保存'); break;
    case 'print': await saveContacts(); render(); window.print(); break;
    case 'note': { const t = $('#noteIn').value.trim(); if (!t) return toast('先写点什么'); (S.notes[S.tab] = S.notes[S.tab] || []).push({ at: stamp(), text: t }); draft().note = ''; await save(); render(); toast('记录已保存'); break; }
    case 'notedel': S.notes[S.tab].splice(+v, 1); await save(); render(); toast('已从本页移除记录'); break;
    case 'file-download': await ActorStore.downloadFile(v); toast('已生成附件原件下载'); break;
    case 'photo-download': { const p = S.photos[Number(v)]; if (!p) throw new Error('照片不存在'); if (p.file) await ActorStore.downloadFile(p.file.id); else downloadBlob(await (await fetch(p.src)).blob(), '肉肉-旧版照片副本.jpg'); break; }
    case 'photo-remove': S.photos.splice(Number(v), 1); await save(); render(); toast('已从时光机移除照片'); break;
    case 'backup': { await writes.catch(() => {}); const bundle = await PetBackup.export(S); downloadBlob(new Blob([JSON.stringify(bundle)], {type:'application/json'}), '肉肉完整备份-' + T0 + '.json'); toast('完整备份已生成，包含本页草稿和附件原件'); break; }
    case 'retry': await save(); render(); toast('本页内容已重新保存'); break;
    case 'reload': if (!window.confirm('重新读取会替换本页尚未保存的内容。若要保留，请先取消并导出肉肉完整备份。继续读取？')) break; clearTimeout(draftTimer); draftTimer = 0; await client.reload(); S = PetSchema.validate(client.state); dirty = false; render(); status('已读取本机保存记录'); toast('已读取保存记录'); break;
  }
  } catch (error) { failed(error); }
  finally { if (el.isConnected) el.disabled = false; }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'behIn') document.querySelector('[data-a="askbeh"]').click(); });
document.addEventListener('change', async e => {
  if (!['noteFile','ph','petBackup'].includes(e.target.id) || !e.target.files?.length || importing) return;
  const files = [...e.target.files], tab = S.tab, mode = e.target.id;
  importing = true; status('正在校验并保存文件…');
  try {
    if (mode === 'petBackup') {
      const doc = JSON.parse(await files[0].text());
      const checked = await PetBackup.validate(doc);
      if (!window.confirm('已校验肉肉备份：' + (checked.pet?.photos?.length || 0) + ' 张照片、' + checked.files.length + ' 份原件。恢复将替换本机肉肉记录，主工作台保持不变。建议先导出当前备份。继续恢复？')) { status('已取消恢复，原记录保留'); return; }
      await PetBackup.restore(doc, client);
      await client.reload(); S = PetSchema.validate(client.state); answer = null; dirty = false;
      render(); status('肉肉完整备份已恢复'); toast('记录和原件已恢复');
    } else {
      const added = [];
      for (const f of files) {
        if (mode === 'ph' && !f.type.startsWith('image/')) throw new Error('时光机请导入图片；其他资料可使用附件入口');
        added.push({ file: f, ref: await ActorStore.putFile(f) });
      }
      for (const {file, ref} of added) {
        if (mode === 'ph') S.photos.push({ id: crypto.randomUUID(), file: ref, c: draft(tab).photoCaption?.trim() || file.name, d: draft(tab).photoDate || T0 });
        else (S.notes[tab] = S.notes[tab] || []).push({ at: stamp(), text: file.name, attachment: ref });
      }
      await save(); render(); toast('已保存 ' + added.length + ' 份原件');
    }
  } catch (error) { failed(new Error('未完成导入：' + error.message)); }
  finally { importing = false; if (e.target.isConnected) e.target.value = ''; }
});
render();
status('已打开本机可靠存储 · 草稿自动保存，换设备前请导出备份');
})();
