(async () => {
const D = window.DEMO;
const KEY = 'xilixiwai-demo-v1';
const $ = (s, el = document) => el.querySelector(s);

/* ---------------- 状态 ---------------- */
const fresh = () => ({
  theme: 'tide', nameIdx: 0, st: 0, userEvents: [], hiddenEv: {}, evDone: {}, todayDone: {}, home: true, trip: false, body: false, charity: false, fans: false, deals: false, crisis: false, portfolio: false, rourou: false, meals: [], check: {}, reviews: {}, files: {}, archives: [], cycleOn: false, cycle: { lastStart: -24, len: 28, dur: 5 }, sym: {}, inv: {}, selDay: 12, pack: {}, packAdd: {}, tab: {}, ran: {}, folder: [], provider: 'demo',
  guide: false, lab:false, labKind:'scene',visionPreferences:{}, experience: {active:false,step:0,checks:{}}, replySubmissions:{}, rel: 'xia', adopt: null, handling: 'probe', tasks: D.tasks.map(t => ({ ...t })),
  sel: null, tone: 'warm', submitted: {}, scope: 'ad', scopeTried: false, checks: {}, faqQ: '', seen: {}, pick: 'nl'
});
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validateMain = raw => {
 const state=ActorStore.validateMain(raw,fresh);
 if(!D.people.some(p=>p.id===state.rel)||!['warm','play','formal'].includes(state.tone)||!Object.keys(D.scopes).includes(state.scope)||!D.handlings.some(h=>h.id===state.handling)||!['demo','deepseek','openai','claude','codex','claudecode','compatible'].includes(state.provider))throw Error('状态含有无效选项');
 for(const task of state.tasks)if(typeof task.t!=='string'||typeof task.who!=='string'||typeof task.due!=='string')throw Error('任务字段无效');
 return state;
};
let client;
try { client = await ActorStore.open(KEY, fresh, validateMain); }
catch (error) {
  document.querySelector('#main').textContent = error.message;
  const b = document.createElement('button'); b.textContent = '导出原始记录供恢复'; b.onclick = async () => ActorStore.download('原始记录.json',await ActorStore.exportRaw(KEY)); document.querySelector('#main').append(b); const r=document.createElement('button');r.textContent='保留原记录，开始新演示';r.onclick=async()=>{if(!confirm('先下载原始记录，然后开始新演示？原始记录也会在本机保留恢复副本。'))return;ActorStore.download('原始记录.json',await ActorStore.exportRaw(KEY));await ActorStore.startFresh(KEY,validateMain(fresh()));location.reload();};document.querySelector('#main').append(r);return;
}
let S = client.state;
const requestedTheme=new URLSearchParams(location.search).get('theme'),chosenTheme=requestedTheme||localStorage.getItem('xilixiwai.theme.v2');if(['tide','butter','moss'].includes(chosenTheme)){S.theme=chosenTheme;localStorage.setItem('xilixiwai.theme.v2',chosenTheme);}if(['tide','butter','moss'].includes(requestedTheme)){const clean=new URL(location.href);clean.searchParams.delete('theme');history.replaceState(null,'',clean.pathname+clean.search+clean.hash);}
let renderedPage=null, draftTimer;
function captureDraft() {
 if(!renderedPage)return;
 const form={};document.querySelectorAll('#main input:not([type=file]):not([type=range]),#main textarea,#main select').forEach((el,i)=>{const k=el.id||el.dataset.self!==undefined&&'self-'+el.dataset.self||el.dataset.role&&'pack-'+el.dataset.role;if(k)form[k]=el.type==='checkbox'?el.checked:el.value;});
 form.__status=draftStatus;S.formDrafts[renderedPage]=form;
}
function restoreDraft(){
 const form=S.formDrafts[renderedPage]||{};
 document.querySelectorAll('#main input:not([type=file]):not([type=range]),#main textarea,#main select').forEach(el=>{const k=el.id||el.dataset.self!==undefined&&'self-'+el.dataset.self||el.dataset.role&&'pack-'+el.dataset.role;if(k&&form[k]!==undefined){if(el.type==='checkbox')el.checked=!!form[k];else el.value=form[k];}});
 draftStatus=form.__status||'adopt';document.querySelectorAll('[data-act="rvst"]').forEach(b=>b.classList.toggle('on',b.dataset.v===draftStatus));
}
function showError(error){
 let b=document.querySelector('#saveError');if(!b){b=document.createElement('div');b.id='saveError';b.setAttribute('role','alert');b.style.cssText='position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;padding:16px;background:#70222a;color:white;border-radius:12px';document.body.append(b);}
 b.textContent='未保存：'+error.message+' ';const out=document.createElement('button');out.textContent='导出当前草稿';out.onclick=()=>ActorStore.download('未保存的工作台草稿.json',JSON.stringify({app:'xilixiwai',version:1,state:S}));b.append(out);
 const reload=document.createElement('button');reload.textContent='刷新读取已保存记录';reload.onclick=()=>location.reload();b.append(reload);
}
addEventListener('actor-store-conflict',e=>{if(e.detail.key===KEY)showError(Error(e.detail.message));});
const save = async () => { clearTimeout(draftTimer);captureDraft();await client.save(S); };
let freshKey = null, newFolder = null, timers = [];
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; try { if (window.__comicStop) window.__comicStop(); if(comicAudio)comicAudio.pause(); } catch {} };
const later = (fn, ms) => timers.push(setTimeout(() => Promise.resolve().then(fn).catch(showError), ms));

/* 资料夹：每站产出 */
const FOLDER = {
  take:   { st: 0, t: '接戏评估卡', d: '初读梗概 · 戏份 · 匹配度 · 档期' },
  read:   { st: 1, t: '角色分析卡', d: '背景 · 经历 · 性格 · 动机 · 关系 · 弧线', tab: 'card' },
  line:   { st: 1, t: '第12场台词建议稿', d: '原句保留，建议稿待导演确认', opt: true },
  role:   { st: 2, t: '第12场表演方案', d: '情绪节拍 · 目标与动作 · 选定演法' },
  dance:  { st: 2, t: '第21场舞蹈拆解', d: '主题 · 情绪 · 节奏 · 四段动作 · 训练记录' },
  prev:   { st: 3, t: '造型参考与分镜表', d: '三套造型 · 5个镜头' },
  comic:  { st: 3, t: '动态漫剧预演', d: '第12场 · 16秒' },
  shoot:  { st: 4, t: '任务看板与内容日历', d: '纪要拆解 · 一周排期 · 常见问题' },
  promo:  { st: 5, t: '粉丝反馈周报', d: '留言分类 · 回复草稿 · 舆情信号' },
  deal:   { st: 6, t: '授权核对清单', d: '品牌核验 · 五项授权边界 · 待律师审核' },
  review: { st: 7, t: '作品复盘报告', d: '复盘 · 播出口碑 · 表演自评' }
};
const has = k => S.folder.includes(k);
async function addFolder(k, msg) {
  if (!has(k)) { S.folder.push(k); newFolder = k; }
  await save(); render(true); toast(msg || `已存入资料夹：${FOLDER[k].t}`); nudge();
}
const stationDone = i => Object.entries(FOLDER).some(([k, v]) => v.st === i && has(k)) && Object.entries(FOLDER).filter(([, v]) => v.st === i && !v.opt).every(([k]) => has(k));

/* ---------------- 小工具 ---------------- */
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}
const tag = (lv, t) => `<span class="tag ${lv}">${t}</span>`;
const demoTag = () => tag('demo', '示例结果 · 演示模式');
const experienceStatus = () => DemoExperience.statuses(S);
function experienceWelcome() {
 const all=experienceStatus(), done=all.filter(m=>m.done).length;
 return `<section class="experience-welcome" data-rising-lines aria-labelledby="experienceTitle"><div class="experience-intro"><div class="eyebrow">ON SET · OFF SET / 亲手体验</div><span class="tag demo">虚构项目 · 无需密钥</span><h1 id="experienceTitle" data-elastic>一封来信，<br>走进演员的一部戏。</h1><p>如果你是演员和团队，接到《逆光来信》之后，怎样读懂角色、准备表演，再把每一次决定留得下来？</p><div class="row mt"><button class="btn pri" data-act="exp-resume">${S.experience.active||done ? '继续我的体验' : '开始 8 步体验'} →</button><button class="btn" data-act="go" data-i="-11">先看功能地图</button></div><p class="experience-caption">约 6–8 分钟（视操作速度） · 自由探索随时可用 · ${done}/8 个体验任务已完成</p></div><div class="experience-letter" aria-hidden="true"><span>《逆光来信》</span><p>“我只是还没想好，<br>要把它放在哪里。”</p><div class="experience-seal">许知夏 / 第12场</div><small>你负责选择，工作台负责记住。</small></div></section>
 <section class="experience-map" aria-label="八步体验地图"><div class="row" style="justify-content:space-between"><div><h2>第一次来，从这条主线开始</h2><p class="small muted">点一个场景进入；做过的操作会留下记录。体验任务与完整资料夹分别计数。</p></div><button class="btn sm" data-act="exp-results">我的体验成果 ${done}/8 ↗</button></div><div class="experience-stations">${all.map((m,i)=>`<button data-act="exp-open" data-i="${i}" class="experience-stop ${m.done?'complete':''}"><span>${m.done?'✓':String(i+1).padStart(2,'0')}</span><b>${D.stations[i].name}</b><small>${esc(m.output)}</small></button>`).join('')}</div><div class="experience-facts"><span>✦ 示例分析可展开</span><span>✎ 选择与草稿可修改</span><span>↧ 实际记录可导出</span><span>🔒 不会自动对外发布</span></div></section>`;
}
function experiencePanel() {
 if(!S.experience.active)return '';
 const all=experienceStatus(),i=S.experience.step,m=all[i],done=all.filter(x=>x.done).length;
 const onRoute=!onPage()&&S.st===i;
 return `<section class="experience-panel" id="experiencePanel" aria-label="当前体验任务"><div class="experience-panel-head"><span>引导体验 · ${String(i+1).padStart(2,'0')}/08</span><div class="row"><button class="btn sm" data-act="go" data-i="-1">体验首页</button><button class="btn sm" data-act="exp-pause">收起引导</button></div></div><div class="experience-panel-body"><div><h2>${m.title}</h2><p>${m.question}</p><p class="small muted mt8">${m.value}</p><span class="experience-output">本步留下：${m.output}</span></div><div class="experience-checks">${m.checks.map((c,k)=>`<button data-act="exp-locate" data-check="${k}" class="${c.done?'complete':''}"><i>${c.done?'✓':k+1}</i><span>${c.label}</span><small>${c.done?'已完成':'去操作 ↗'}</small></button>`).join('')}</div></div><div class="experience-panel-foot"><span class="small muted">${done}/8 个体验任务已完成${onRoute?'':' · 正在浏览其他板块'}</span><div class="row">${[1,6].includes(i)&&!S.reviews['st'+i]?.length?'<button class="btn sm" data-act="exp-example">填入示例意见，再自行修改</button>':''}<button class="btn sm" data-act="exp-locate">${onRoute?'定位下一项操作':'回到本步继续'} ↗</button><button class="btn sm pri" data-act="exp-next" ${m.done?'':'disabled'}>${i===7?'查看我的成果':'继续：'+D.stations[i+1].name+' →'}</button></div></div></section>`;
}
function updateExperiencePanel(){const panel=$('#experiencePanel');if(panel)panel.outerHTML=experiencePanel();}
async function positionExperience(i,checkIndex,locate=false) {
 captureDraft();S.experience.active=true;S.experience.step=i;S.provider='demo';
 const m=experienceStatus()[i],c=m.checks[checkIndex??Math.max(0,m.checks.findIndex(c=>!c.done))];
 const targetTab=c.tab||m.tab;if(targetTab)S.tab[i]=targetTab;
 const already=!onPage()&&S.st===i;
 if(already){await save();render();}else await go(i);
 if(locate)requestAnimationFrame(()=>{const target=$('#main '+c.selector.split(',').join(', #main '));if(target){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});target.focus?.({preventScroll:true});target.classList.add('experience-target');setTimeout(()=>target.classList.remove('experience-target'),2200);}});
}
function experienceResults() {
 const all=experienceStatus(),done=all.filter(x=>x.done).length,dlg=$('#dlg');
 dlg.innerHTML=`<div class="dlg experience-results"><h2>我的体验成果<button data-act="close" aria-label="关闭">×</button></h2><p class="mt8">《逆光来信》 · ${done}/8 个体验任务已完成 · 资料夹 ${S.folder.length}/11 项</p><p class="note">每个勾选都来自你实际保存的操作。尚未完成的会保留空缺，不会替你填好。</p><div class="experience-result-list">${all.map((m,i)=>`<button data-act="exp-result-open" data-i="${i}"><span>${m.done?'✓':'○'}</span><div><b>${m.output}</b><small>${m.checks.filter(c=>c.done).length}/${m.checks.length} 项操作完成</small></div><span>查看 ↗</span></button>`).join('')}</div><div class="row mt"><button class="btn pri" data-act="exp-export">下载我的体验成果单 .md</button><button class="btn" data-act="export">下载资料夹 .md</button><button class="btn" data-act="backup">主线与肉肉备份 .json</button></div><p class="small muted mt8">文字成果单含实际选择、已保存回复、审核快照和个人批注。此JSON备份还保留主线与肉肉附件原件；业务资料实验室请使用其独立备份。</p></div>`;if(!dlg.open)dlg.showModal();
}
function capabilityPreview(){return `<section class="capability-preview card"><div><div class="eyebrow">THE WHOLE PICTURE</div><h2>一部戏之外，还有整个工作室。</h2><p class="sub">实战业务在这里有对应入口；用虚构资料试操作，也看看下一阶段的产品愿景。</p></div><div class="capability-teasers"><button data-act="capabilities"><span data-illustration="studio"></span><b>20 个能力入口</b><small>工作 · 事业 · 生活</small></button><button data-act="lab-open" data-v="company"><span data-illustration="business"></span><b>自己填，真的存</b><small>25 类业务记录 · 可导入导出</small></button><button data-act="visions"><span data-illustration="previs"></span><b>未来也值得期待</b><small>5 个规划预览 · 明确能力边界</small></button></div></section>`;}
function modelOrbitPreview(){return `<section class="model-orbit-preview"><div><div class="eyebrow">ONE WORKSPACE · MANY TOOLS</div><h3>不同模型，围绕你的工作。</h3><p class="small muted mt8">旋转光环是协作示意。真实连接状态、权限与模型配置单独显示。</p><div class="row mt8">${['DeepSeek','ChatGPT / OpenAI','Codex','Claude Code'].map(n=>`<span class="tag">${n}</span>`).join('')}</div></div><div class="model-orbit-slot" data-chrome-orbit aria-label="多模型协作的金属环视觉示意"></div></section>`;}
let lookPreviewMode='reveal',extractionRows=[];
function lookRevealPreview(){const images=D.looks.map(l=>({src:'assets/photos/'+l.img+'.jpg',alt:l.sc+' · '+l.k+'（虚构氛围配图）',label:l.k}));return `<section class="card look-reveal-preview"><div><div class="eyebrow">FROM A PERSON TO A ROLE</div><h3>从一束光，走进角色。</h3><p class="sub">切换氛围，或拖动对比两种方案。预置配图仅供选方向。</p><div class="row mt"><button class="btn ${lookPreviewMode==='reveal'?'pri':''}" data-act="look-mode" data-v="reveal">光边揭图</button><button class="btn ${lookPreviewMode==='compare'?'pri':''}" data-act="look-mode" data-v="compare">两图对比</button></div></div>${lookPreviewMode==='compare'?`<div data-comparison-slider data-images="${esc(JSON.stringify(images.slice(0,2)))}"></div>`:`<div data-ember-reveal data-images="${esc(JSON.stringify(images))}"></div>`}</section>`;}
function portfolioItems(){return [...S.userWorks.map(w=>({...w,origin:'自行录入'})),...D.portfolio.works.map(w=>({year:String(w[0]),title:w[1],genre:w[2],role:w[3],note:w[4]?'示例评分 '+w[4]:'拍摄中（示例）',origin:'虚构作品示例'}))];}
function portfolioCarousel(){const photos=['20_award','09_script','02_window','15_studio'];return `<section class="card"><div data-gradient-carousel data-items="${esc(JSON.stringify(portfolioItems().slice(0,32).map((w,index)=>({src:'assets/photos/'+photos[index%photos.length]+'.jpg',title:'《'+w.title+'》',subtitle:[w.year,w.role].filter(Boolean).join(' · '),index}))))}"></div><p class="small muted">氛围配图，非作品正式海报；点击中央作品查看已登记资料。</p></section>`;}
function taskTransformPreview(text,rows){return `<div data-magic-transform data-document="${esc(JSON.stringify({title:'当前会议纪要',text}))}" data-results="${esc(JSON.stringify(rows.slice(0,24).map(x=>({title:x.t,subtitle:x.who+' · '+x.due}))))}"></div>`;}
function taskExtractionDialog(){
 const text=$('#minutes')?.value||'';try{extractionRows=ActorTaskExtract.extract(text);}catch(e){toast(e.message);return;}
 const dlg=$('#dlg');dlg.innerHTML=`<div class="dlg task-extraction"><h2>先确认，再变成待办<button data-act="close" aria-label="关闭">×</button></h2><p class="small muted mt8">本地按行拆分，不调用模型。每行一件事；只有明确填写的负责人和截止时间会带入，其余由你确认。</p>${taskTransformPreview(text,extractionRows)}<div class="extraction-list">${extractionRows.map((r,i)=>`<article data-extraction-row="${i}"><label class="row"><input type="checkbox" data-extraction-select checked> 事项 ${i+1}</label><div class="field"><label>要做什么<input data-extraction-title maxlength="500" value="${esc(r.t)}"></label></div><div class="grid2"><div class="field"><label>负责人<input data-extraction-owner maxlength="100" value="${esc(r.who)}"></label></div><div class="field"><label>截止时间<input data-extraction-due maxlength="100" value="${esc(r.due)}"></label></div></div><details><summary class="small">查看原话${r.timeHint?' · 时间线索 '+esc(r.timeHint):''}</summary><p class="small">${esc(r.sourceText)}</p></details></article>`).join('')}</div><p id="extractError" role="alert" class="bad-t"></p><div class="row mt"><button class="btn pri" data-act="task-extract-save">确认，加入任务看板</button><button class="btn" data-act="close">取消</button></div></div>`;if(!dlg.open)dlg.showModal();
}
function capabilityDialog(){const dlg=$('#dlg');dlg.innerHTML=`<div class="dlg capability-dialog"><h2>工作台的完整能力<button data-act="close" aria-label="关闭">×</button></h2><p class="sub mt8">看场景、亲手填资料、继续自由探索。实战与演示共用18类业务表单字段；模型分析在这里展示预置示例。</p><div class="capability-grid">${DemoExperience.capabilities.map((c,i)=>`<article><span class="capability-picture" data-illustration="${c.art}"></span><h3>${c.name}</h3><p>${c.description}</p><div class="row">${c.page!==null?`<button class="btn sm" data-act="cap-open" data-i="${i}">进入场景 →</button>`:''}${c.kind?`<button class="btn sm" data-act="lab-open" data-v="${c.kind}">自己填一条 ↗</button>`:''}${c.page===null&&!c.kind?'<button class="btn sm" data-act="deployment-info">查看实战部署说明</button>':''}</div></article>`).join('')}</div><p class="note">本机演示记录可保存、修改、导出。账号权限、团队在线协作、真实模型与外部平台连接，以实战版实际部署配置为准。</p></div>`;if(!dlg.open)dlg.showModal();}
function visionsDialog(id){const dlg=$('#dlg'),v=DemoExperience.visions.find(x=>x.id===id);if(!v){dlg.innerHTML=`<div class="dlg"><h2>更进一步的想象<button data-act="close" aria-label="关闭">×</button></h2><p class="sub mt8">这些属于规划预览。可以选择场景、看输入与结果设想；不会发起真实生成、监测或对外动作。</p><div class="capability-grid">${DemoExperience.visions.map(v=>`<article><span class="capability-picture" data-illustration="${v.art}"></span><span class="tag warn">规划预览</span><h3>${v.title}</h3><p>${v.lead}</p><button class="btn" data-act="vision-open" data-v="${v.id}">展开规划预览 →</button></article>`).join('')}</div></div>`;}else{const choice=S.visionPreferences[v.id]||v.choices[0];dlg.innerHTML=`<div class="dlg vision-dialog"><h2>${v.title}<button data-act="close" aria-label="关闭">×</button></h2><p class="mt8">${tag('warn','规划预览 · 尚未接入')} ${v.lead}</p>${v.image?`<img class="world-concept" src="${v.image}" alt="作品走向世界：彩色地球概念预览，虚构案例，非实际发行数据">`:`<span class="vision-picture" data-illustration="${v.art}"></span>`}<h3 class="mt">先选一个方向</h3><div class="opt">${v.choices.map((c,i)=>`<button data-act="vision-choice" data-kind="${v.id}" data-i="${i}" class="${choice===c?'on':''}">${c}</button>`).join('')}</div><div class="vision-flow">${v.steps.map((s,i)=>`<div><b>0${i+1}</b><span>${s}</span></div>`).join('')}</div><div class="gate"><b>当前设想：${esc(choice)}</b><p class="small mt8">${v.result}</p></div><div class="row mt"><button class="btn pri" data-act="vision-export" data-v="${v.id}">导出这份功能设想</button><button class="btn" data-act="visions">看其他规划</button></div></div>`;}if(!dlg.open)dlg.showModal();}
async function openLab(kind='scene'){await flushPet();S.labKind=kind;if($('#dlg').open)$('#dlg').close();if(S.lab){await save();render();}else await go(PAGES.lab);}
const tab = (st, def) => S.tab[st] || def;
const tabs = (st, list) => `<div class="tabs">${list.map(([k, n]) => `<button data-act="tab" data-st="${st}" data-v="${k}" class="${tab(st, list[0][0]) === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;

/* AI 运行：先展示“思考步骤”，再显示结果（结果为预置示例） */
function aiBlock(key, label, hint, result) {
  if (S.ran[key]) return `<div class="${freshKey === key ? 'reveal' : ''}">${result()}</div>`;
  return `<div class="ai-box" data-ai="${key}"><p>${hint}</p><button class="btn pri ai" data-act="run" data-k="${key}">${label}</button><small class="demo-boundary">预置示例 · 展开查看流程，不会分析你上传的新文件</small></div>`;
}
const STEPS = {
  airdata:  ['读取 32 集播放与讨论数据', '统计口碑评分与关键词', '对比开播前后的粉丝增长'],
  selfrev:  ['读取你的自评回答', '对照导演反馈与观众口碑', '提炼最值得带走的经验'],
  port:     ['读取 9 部作品的题材、角色与口碑', '结合年龄、气质、体态、声线', '计算题材 × 角色适配度', '生成发展路线'],
  vet:      ['检索导演与主创的公开报道', '查询出品方的诉讼与纠纷记录', '研判题材导向与审查风险', '评估角色形象风险，对照你的作品库'],
  crisis:   ['抓取全网相关讨论 3.6 万条', '识别首发来源与扩散路径', '核对剧方与经纪团队的确认信息', '比较回应方式并起草声明'],
  clause:   ['读取合同草案（共 23 条）', '逐条检查排他、使用期限、AI 条款、违约责任、付款', '对照你现有的合同和代言', '标出风险与修改建议'],
  offer0:   ['查询工商与经营状态', '检索司法诉讼与产品抽检', '扫描舆情与过往代言人', '对照形象、粉丝、排他与档期打分'],
  offer1:   ['查询工商与经营状态', '检索司法诉讼与产品抽检', '扫描舆情与过往代言人', '对照形象、粉丝、排他与档期打分'],
  offer2:   ['查询工商与经营状态', '检索司法诉讼与产品抽检', '扫描舆情与过往代言人', '对照形象、粉丝、排他与档期打分'],
  fanplan:  ['汇总各平台本周热议话题', '整理粉丝提问与期待', '按平台调性分配内容形式', '排出一周内容日历'],
  orgcheck: ['查询民政部门登记信息', '核对公开募捐资格与年报', '检查过往项目的结项公示', '扫描近一年的舆情'],
  fanpost:  ['读取本次公益项目与机构信息', '按粉丝公益规范起草', '标注需要工作室审核的地方'],
  bodyplan: ['读取角色设定：曾是舞团学员，形象轻盈挺拔', '对照近 90 天体重与运动记录', '计算到定妆、开机的时间', '生成安全的节奏、训练与饮食建议'],
  legs:     ['读取 4 段行程与出发时间', '对照起降两地天气：雷雨、降雨概率', '估算去机场 / 车站的路况（高峰、雨天）', '比较飞机、高铁、自驾的总耗时与延误风险'],
  wear:     ['读取每一天的城市、气温和降雨', '结合当天活动的着装要求', '生成每日穿搭与随身物品'],
  sched:    ['读取本月日程（14 项）', '逐一核对新邀约与拍摄、宣发、训练的时间', '估算跨城行程与休息时间', '给出可接 / 需协调 / 建议婉拒'],
  compare:  ['读取 3 部剧本与邀约信息', '提取角色分量、题材与团队', '对照你的年度方向与已有档期', '生成横向对比与建议'],
  rcard:    ['汇总人物关系、成长线、潜台词与小传', '整理背景与人生经历时间线', '分析性格、核心动机与外在细节', '生成角色分析卡'],
  bio:      ['汇总剧本中关于许知夏的全部交代', '补全人物前史（标注推断）', '以第一人称写成人物小传'],
  call:     ['读取今日通告单', '关联资料夹中的表演方案与台词稿', '生成今日准备清单'],
  take:     ['读取剧本全文（40场 · 约6.8万字）', '识别主要人物与出场场次', '提取许知夏的成长线', '对照你的年度方向与档期'],
  rel:      ['按剧情顺序整理人物出场', '识别人物之间的关系与变化', '标注“角色此刻知道什么”'],
  growth:   ['定位许知夏的关键选择', '按场次估计人物主动性', '生成成长线'],
  subtext:  ['定位第12场原文', '区分“剧本写明”与“人物推断”', '生成潜台词解读'],
  keysc:    ['计算每场的人物变化幅度', '结合情绪强度与戏剧功能', '排出重点场次'],
  lineopt:  ['保留原句', '按三种演法生成改写建议', '标注每种改法的风险'],
  beats:    ['把第12场拆成情绪节拍', '为每个节拍写出目标、阻碍与动作反应', '生成三种处理方式'],
  dance:    ['识别舞段主题与人物情绪', '分析音乐节奏（BPM 72 → 96）', '按 8 拍划分动作段落', '整理训练观察问题'],
  looks:    ['提取各场次人物状态与环境', '生成造型方向与色彩参考'],
  shots:    ['读取已选演法：', '拆分镜头与时长', '生成轻量分镜画面'],
  tasks:    ['读取会议纪要（6条）', '识别负责人与截止时间', '拆解为任务并排进日历'],
  classify: ['读取最新 12 条留言', '按话题与情绪分类', '标记需要人工关注的内容', '为每类准备回复草稿'],
  itv:      ['读取采访邀约与资料夹', '预测可能的问题', '整理要点与不展开的话题'],
  report:   ['统计话题热度', '分析情绪分布', '提炼可执行的运营建议'],
  brand:    ['检索品牌公开信息', '逐条核对信息来源', '区分已核验、待核验与传闻'],
  rights:   ['读取合作需求：数字人广告', '按肖像、声音、表演数据、生成内容、商业授权逐项核对', '生成需要问清楚的问题'],
  brief:    ['检索影视、舞蹈、音乐、时尚、AI 内容、行业活动、公益七个方向', '逐条标注来源类型与核验状态', '判断和你的相关度', '生成摘要、建议动作与合作灵感'],
  plan:     ['汇总这部戏的资料夹', '对照年度目标', '生成下一阶段行动清单（供团队取舍）']
};
function runAI(key) {
  if(S.provider!=='demo'){aiDialog(key);return;}
  const box = document.querySelector(`[data-ai="${key}"]`); if (!box) return;
  const steps = (STEPS[key] || ['分析中']).map(s => s === '读取已选演法：' ? s + handlingName() : s);
  const prov = S.provider === 'demo' ? '演示模式（预置示例）' : providerName();
  box.outerHTML = `<div class="thinking" id="think-${key}"><h4><span class="spin"></span>正在展开示例 · <span class="muted small">${prov}</span></h4><p class="small muted">以下展示处理步骤，本次没有发起模型调用或网络检索。</p><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;
  const lis = [...document.querySelectorAll(`#think-${key} li`)];
  lis.forEach((li, i) => {
    later(() => { li.classList.add('in'); if (lis[i - 1]) lis[i - 1].classList.add('ok'); }, 120 + i * 480);
  });
  later(async () => { S.ran[key] = true; freshKey = key; await save(); render(true); freshKey = null; nudge(); const r = document.querySelector('.reveal'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 220 + lis.length * 480);
}

/* ---------------- 每站步骤指引 ---------------- */
const seen = (st, t) => !!S.seen[st + ':' + t];
const GUIDE = [
  [['横向对比 3 部剧本', null, () => S.ran.compare], ['AI 初读首选剧本', null, () => S.ran.take], ['项目背调', null, () => S.ran.vet], ['决定接戏', null, () => has('take')]],
  [['人物关系', 'rel', () => S.ran.rel], ['成长线', 'growth', () => S.ran.growth], ['潜台词', 'sub', () => S.ran.subtext], ['重点场次', 'key', () => S.ran.keysc], ['人物小传', 'bio', () => S.ran.bio], ['生成角色分析卡', 'card', () => S.ran.rcard], ['存入资料夹', 'card', () => has('read')], ['台词优化（可选）', 'line', () => has('line'), true]],
  [['拆情绪节拍', 'scene', () => S.ran.beats], ['选定一种演法', 'scene', () => has('role')], ['拆解舞段', 'dance', () => S.ran.dance], ['存入舞蹈训练记录', 'dance', () => has('dance')]],
  [['造型参考', 'look', () => S.ran.looks], ['轻量分镜', 'board', () => S.ran.shots], ['存入分镜', 'board', () => has('prev')], ['播放动态漫剧', 'comic', () => has('comic')]],
  [['读今日通告单', 'call', () => S.ran.call], ['纪要拆成任务', 'tasks', () => S.ran.tasks], ['存入任务看板', 'tasks', () => has('shoot')], ['看内容日历', 'cal', () => seen(4, 'cal')], ['查知识库', 'faq', () => seen(4, 'faq')]],
  [['留言分类', 'cmt', () => S.ran.classify], ['提交一条回复审核', 'cmt', () => Object.keys(S.submitted).length > 0], ['提炼运营反馈', 'rep', () => S.ran.report], ['存入周报', 'rep', () => has('promo')], ['看舆情信号', 'sig', () => seen(5, 'sig')]],
  [['核验品牌信息', null, () => S.ran.brand], ['逐项核对授权', null, () => S.ran.rights], ['切换用途对比', null, () => S.scopeTried], ['生成授权清单', null, () => has('deal')]],
  [['作品复盘', 'look', () => seen(7, 'look')], ['播出与口碑', 'data', () => S.ran.airdata], ['表演自评', 'self', () => S.ran.selfrev], ['存入资料夹', 'self', () => has('review')]]
];
const curStep = i => GUIDE[i].findIndex(g => !g[3] && !g[2]());
function stepBar(i) {
  const c = curStep(i), n = D.stations[i + 1];
  return `<div class="steps">${GUIDE[i].map((g, k) => `<button class="step ${g[2]() ? 'ok' : ''} ${k === c ? 'cur' : ''}" data-act="step" data-st="${i}" data-k="${k}"><i>${g[2]() ? '✓' : k + 1}</i>${g[0]}</button>`).join('<span class="arrow">›</span>')}</div>
  ${c < 0 ? `<div class="done-banner"><b>✓ 本站完成</b><span>${n ? `成果已存进资料夹，接下来去「${n.name}」` : '一部戏完整走完了'}</span>${n ? `<button class="btn pri" data-act="go" data-i="${i + 1}">下一站：${n.name} →</button>` : `<button class="btn pri" data-act="export">导出资料包</button>`}</div>` : `<p class="step-tip">👉 现在做：<b>${GUIDE[i][c][0]}</b></p>`}`;
}
function nudge() {
  if (onPage()) return;
  const c = curStep(S.st);
  if (c >= 0) later(() => toast('下一步：' + GUIDE[S.st][c][0]), 2400);
  else later(() => toast(S.st < 7 ? `本站完成，下一站：${D.stations[S.st + 1].name}` : '全部完成，可以导出资料包'), 2400);
}

/* ---------------- 人工复核 · 最终决定（每个板块都有） ---------------- */
const pageKey = () => onPage() || 'st' + S.st;
const PAGE_NAME = k => ({ home: '日程总览', trip: '出行与天气', body: '身体与状态', charity: '公益与影响力', fans: '粉丝与社群', deals: '合同与品牌', crisis: '危机公关与舆情', portfolio: '作品库与发展规划', brief: '行业简报' })[k] || (D.stations[+k.slice(2)] ? `${D.stations[+k.slice(2)].no} ${D.stations[+k.slice(2)].name}` : k);
const REVIEW_HINT = {
  home: '例如：上海商演接，但只留 3 小时；杭州路演婉拒，改视频连线。经纪人周五前回复对方。',
  trip: '例如：成都→重庆改坐 10:00 高铁；重庆两天有雨，礼服提前装防水罩；助理负责多带 2 把伞。',
  brief: '例如：AI 标识条款转给律师；舞台小作品的想法下周和舞团老师聊；代言传闻不回应。',
  portfolio: '例如：未来一年优先现实题材和悬疑反差角色；甜宠类暂不接；明年争取一部文艺电影。',
  crisis: '例如：采用联合澄清，今天 11:30 剧方先发、工作室转发；对两个营销号保留证据，律师跟进。',
  deals: '例如：香氛品牌可以接，但排他改成“香氛品类”、内容期满 6 个月下架、加 AI 条款；借贷 App 婉拒。律师周三前回复。',
  fans: '例如：舞蹈数据站由对接人私下沟通，引导改公益应援；周三的训练 vlog 本人先看再发。',
  charity: '例如：乡村阅读角继续做；新机构先签小额试点，资金公示每季度一次；倡议文案改第二句后发布。',
  body: '例如：同意 AI 的节奏，但每周只减 0.3 公斤；周三加一次普拉提；夜戏前一定加餐。',
  st0: '例如：先接《逆光来信》，《第七号证人》让经纪人核实投资后再谈。',
  st1: '例如：第12场的潜台词解读同意第 2 条；人物小传第 3 段我自己重写。',
  st2: '例如：第12场先按“试探”准备，现场再和导演试一遍“克制”。',
  st3: '例如：第21场造型换成深灰练功服，分镜第 4 镜改成侧面。',
  st4: '例如：探班口径确认用第一版；周五的勘景助理跟。',
  st5: '例如：“住哪家酒店”那条已转安保；剧情讨论类留言本人挑 3 条亲自回。',
  st6: '例如：数字人广告暂不接，只接受不涉及声音克隆的平面合作；合同交律师。',
  st7: '例如：下半年优先找现实题材；表演工作坊报 9 月那期。'
};
const STATUS = [['adopt', '采纳 AI 建议', 'ok'], ['modify', '修改后采纳', 'warn'], ['reject', '暂不采纳', 'bad'], ['discuss', '待讨论', '']];
const WHO = ['本人', '经纪人', '助理', '宣传', '造型', '制片 / 导演'];
S.reviews = S.reviews || {}; S.files = S.files || {}; S.archives = S.archives || [];
let draftStatus = 'adopt';
function reviewBlock() {
  const k = pageKey(), list = S.reviews[k] || [], files = S.files[k] || [];
  return `<section class="card review" id="review">
    <div class="result-head"><div><h3>✍️ 人工复核 · 最终决定</h3><p class="sub">AI 只给信息和建议，最后怎么做由人决定。写下你们的决定，留档可查。</p></div>${list.length ? tag('ok', `已有 ${list.length} 条决定`) : tag('warn', '还没有人工决定')}</div>
    <div class="opt" style="margin-top:0">${STATUS.map(([v, n]) => `<button data-act="rvst" data-v="${v}" class="${draftStatus === v ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="rv-grid mt8">
      <div class="field" style="margin-top:0"><label>决定人</label><select id="rvWho">${WHO.map(w => `<option>${w}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:0"><label>我们的决定 / 批注</label><textarea id="rvText" placeholder="${REVIEW_HINT[k] || '写下最终怎么做、谁负责、什么时候完成'}"></textarea></div>
    </div>
    <div class="row mt8" style="justify-content:space-between">
      <div class="row"><label class="btn sm" style="cursor:pointer">📎 导入文件<input type="file" id="rvFile" multiple hidden></label><span class="small muted">剧本、合同、通告单、照片等，挂在这个板块下</span></div>
      <button class="btn pri" data-act="rvsave">保存决定</button></div>
    ${files.length ? `<div class="files mt8">${files.map((f, i) => `<div class="file"><span>${f.img ? `<img src="${f.img}" alt="">` : '📄'}</span><div><b>${esc(f.name)}</b><small>${esc(f.size)} · ${esc(f.at)}${f.text ? ' · 可预览' : ''}</small>${f.text ? `<pre>${f.text.slice(0, 280).replace(/</g, '&lt;')}${f.text.length > 280 ? '…' : ''}</pre>` : ''}</div>${f.file ? `<button class="btn sm" data-act="filedownload" data-v="${f.file.id}">下载原件</button>` : `<small>旧记录只有登记信息，请重新上传原件</small>`}<button class="btn sm" data-act="rvfdel" data-i="${i}">移除</button></div>`).join('')}</div>` : ''}
    ${list.length ? `<ul class="rv-list mt">${list.slice().reverse().map((r, j) => { const st = STATUS.find(s => s[0] === r.status) || STATUS[3]; return `<li><div class="row" style="justify-content:space-between"><span class="row">${tag(st[2], st[1])}<b>${esc(r.who)}</b><span class="small muted">${esc(r.at)}</span></span><button class="btn sm" data-act="rvdel" data-i="${list.length - 1 - j}">删除</button></div><p class="mt8">${r.text.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p></li>`; }).join('')}</ul>` : ''}
  </section>`;
}
const stamp = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().slice(0, 5)}`; };
async function saveReview() {
  const t = ($('#rvText').value || '').trim(); if (!t) { toast('先写下你们的决定'); return; }
  const k = pageKey(); (S.reviews[k] = S.reviews[k] || []).push({ status: draftStatus, who: $('#rvWho').value, text: t, at: stamp() });
  delete S.formDrafts[k];renderedPage=null;await save();render(true);toast('已保存人工决定');
}
async function importFiles(files) {
  const k = pageKey(), pending=[];
  for(const f of [...files]) {
    const original=await ActorStore.putFile(f);
    const rec={name:f.name,size:f.size>1048576?(f.size/1048576).toFixed(1)+' MB':Math.max(1,Math.round(f.size/1024))+' KB',at:stamp(),file:original};
    if(/^text\//.test(f.type)||/\.(txt|md|csv)$/i.test(f.name))rec.text=(await f.text()).slice(0,1000000);
    if(/\.docx$/i.test(f.name)){try{rec.text=(await window.mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()})).value.slice(0,1000000);}catch(e){rec.text='Word原件已保存，文字提取失败：'+e.message;}}
    if(/^image\//.test(f.type)) {const img=await createImageBitmap(f);const c=document.createElement('canvas'),scale=Math.min(1,480/img.width);c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);rec.img=c.toDataURL('image/jpeg',.7);img.close();}
    pending.push(rec);
  }
  S.files[k]=[...(S.files[k]||[]),...pending];await save();render(true);toast(`已保存 ${pending.length} 个附件原件，可下载和完整备份`);
}
/* ---------------- 归档 / 备份 / 导入 ---------------- */
const download = ActorStore.download;
async function exportBackup() {
  await flushPet();
  captureDraft();await save();const bundle=await ActorStore.exportBundle();await ActorStore.validateBundle(bundle,{validateMain,validatePet:PetSchema.validate});
  download(`戏里戏外-备份-${new Date().toLocaleDateString('sv')}.json`,JSON.stringify(bundle),'application/json');toast('已导出工作台与肉肉资料；实验室请另行备份');
}
async function importBackup(file) {
  const doc=JSON.parse(await file.text());
  await ActorStore.validateBundle(doc,{validateMain,validatePet:PetSchema.validate});
  if(!confirm('备份已通过校验。先导出当前备份以便撤回，然后替换当前记录？'))return;
  await exportBackup();
  await ActorStore.restoreBundle(doc,{mainClient:client,validateMain,validatePet:PetSchema.validate});S=await client.reload();renderedPage=null;render();toast('备份已恢复，原件已校验');if($('#dlg').open)settings();
}
async function archiveProject() {
  await flushPet();
  const n=Object.values(S.reviews).reduce((a,l)=>a+l.length,0);captureDraft();
  const snapshot={...structuredClone(S),archives:[]};
  S.archives.unshift({title:`《${D.project.title}》`,at:new Date().toLocaleString('zh-CN'),folder:S.folder.length,reviews:n,snap:JSON.stringify(snapshot)});
  await save();toast('已归档完整项目快照，可查看、恢复和导出');if($('#dlg').open)settings();
}
async function archiveAction(i,action) {
  await flushPet();
  const archive=S.archives[i];if(!archive?.snap)throw Error('此归档没有可恢复的快照');const raw=JSON.parse(archive.snap);
  if(action==='view'){const dlg=$('#dlg');dlg.innerHTML='<div class="dlg"><h2>'+esc(archive.title)+'<button data-act="close">×</button></h2><pre style="white-space:pre-wrap">'+esc(JSON.stringify(raw,null,2))+'</pre></div>';return;}
  if(!raw.st&&raw.st!==0)throw Error('旧版归档只保存了部分资料，无法完整恢复；可查看或导出旧快照');
  const state=validateMain(raw);
  if(action==='export'){const bundle=await ActorStore.exportBundle({state});download('项目归档备份.json',JSON.stringify(bundle));return;}
  if(!confirm('恢复这个归档？会先下载当前完整备份。'))return;
  await exportBackup();const keep=S.archives;S={...state,archives:keep};renderedPage=null;await save();render();settings();toast('已恢复归档');
}

/* ---------------- 页面结构：今天 / 戏里 / 戏外·事业 / 戏外·生活 ---------------- */
const PAGES = { home: -1, trip: -2, body: -3, charity: -4, fans: -5, deals: -6, crisis: -7, portfolio: -8, brief: -9, rourou: -10, guide: -11, lab:-12 };
const onPage = () => Object.keys(PAGES).find(k => S[k]) || '';
const VIEWP = { home: () => vHome(), trip: () => vTrip(), body: () => vBody(), charity: () => vCharity(), fans: () => vFans(), deals: () => vDeals(), crisis: () => vCrisis(), portfolio: () => vPortfolio(), brief: () => vBrief() };
const CRUMB = { home: () => `<b>日程总览</b><span>示例：拍摄期 ${D.sched.year}年${D.sched.month}月 · 当天 ${D.sched.month}月${D.sched.today}日 · ${D.actor.name}</span>`, trip: () => `<b>出行与天气</b><span>${D.trip.title}</span>`, body: () => `<b>身体与状态</b><span>角色：许知夏 · 定妆前 6 周</span>`, charity: () => `<b>公益与影响力</b><span>把热爱变成看得见的善意</span>`, fans: () => `<b>粉丝与社群</b><span>真诚对待粉丝，也守住边界</span>`, deals: () => `<b>合同与品牌</b><span>AI 先背调评估，人来做决定</span>`, crisis: () => `<b>危机公关与舆情</b><span>先核实，再回应</span>`, portfolio: () => `<b>作品库与发展规划</b><span>适合什么角色，下一步往哪走</span>`, brief: () => `<b>行业简报</b><span>${D.brief2.week} · 逐条核验来源</span>`, rourou: () => '<b>肉肉的小世界</b><span>日常陪伴 · 健康 · 时光机 · 照护记录</span>' };
async function flushPet() {
  const module = $('#rourouFrame')?.contentWindow?.PetModule;
  if (module?.whenIdle) await module.whenIdle();
  const lab=$('#labFrame')?.contentWindow?.DemoLab;if(lab?.whenIdle)await lab.whenIdle();
}
function renderEmbeddedPage(main) {
  const pet = S.rourou,lab=S.lab, id = pet ? 'rourouFrame' : lab?'labFrame':'guideFrame';
  const src = pet ? 'rourou/?embedded=1' : lab?'demo-lab/?embedded=1&kind='+encodeURIComponent(S.labKind):'guide/?embedded=1&mode=demo';
  let frame = $('#'+id);
  if (!frame) {
    main.innerHTML = `<iframe id="${id}" class="workbench-frame" title="${pet ? '肉肉的小世界' : lab?'业务资料实验室':'使用说明'}" src="${src}&theme=${encodeURIComponent(S.theme)}" data-kind="${esc(S.labKind)}"></iframe>`;
    frame = $('#'+id);
  }
  if(lab&&frame.dataset.kind!==S.labKind){frame.dataset.kind=S.labKind;frame.src=src+'&theme='+encodeURIComponent(S.theme);}
  frame.contentWindow?.postMessage({type:'workbench:theme',theme:S.theme},location.origin);
}
CRUMB.guide = () => '<b>使用说明</b><span>图示 · 功能地图 · 操作卡</span>';
CRUMB.lab = () => '<b>业务资料实验室</b><span>25 类业务表单 · 虚构示例 · 真实增改与导出 · 独立备份</span>';

/* ---------------- 框架渲染 ---------------- */
const name = () => D.names[0];
const PROVIDERS = [
  ['demo', '演示模式', '今天发布会使用'], ['deepseek', 'DeepSeek', 'API Key'], ['openai', 'ChatGPT / OpenAI', 'API Key'],
  ['claude', 'Claude', 'API Key'], ['codex', 'Codex', '本机登录'], ['claudecode', 'Claude Code', '本机登录'], ['compatible','其他兼容服务','API Key']
];
const providerName = () => (PROVIDERS.find(p => p[0] === S.provider) || PROVIDERS[0])[1];
const handlingName = () => D.handlings.find(h => h.id === S.handling).k;

/* Sidebar journey preference: independent of project records. */
const JOURNEY_PREF = 'xilixiwai.nav.journey.collapsed.v1';
let journeyCollapsed = false;
try { journeyCollapsed = localStorage.getItem(JOURNEY_PREF) === '1'; } catch {}
function toggleJourney() {
  journeyCollapsed = !journeyCollapsed;
  const button = $('#journeyToggle');
  try {
    localStorage.setItem(JOURNEY_PREF, journeyCollapsed ? '1' : '0');
    button.title = '展开或收起八阶段流程';
  } catch {
    button.title = '当前页已切换；浏览器未允许保存此偏好，刷新后会恢复展开';
  }
  button.setAttribute('aria-expanded', String(!journeyCollapsed));
  button.querySelector('.journey-action').textContent = journeyCollapsed ? '展开' : '收起';
  button.querySelector('.journey-chevron').textContent = journeyCollapsed ? '▸' : '▾';
  $('#stationJourney').hidden = journeyCollapsed;
  $('#journeyCurrent').hidden = !journeyCollapsed;
}
function renderSide() {
  const rv = k => (S.reviews[k] || []).length ? ' <i class="revdot" title="已有人工决定">✍</i>' : '';
  const it = (k, ic, t, sub) => `<button class="st home-btn ${S[k] ? 'on' : ''}" data-act="go" data-i="${PAGES[k]}"><span class="st-dot">${ic}</span><span><b>${t}${rv(k)}</b><small>${sub}</small></span></button>`;
  const inSt = !onPage();
  const currentStation = D.stations[S.st];
  const publicDemo = isPublicDemo(), demoHost = !publicDemo && location.pathname.startsWith('/demo/'), brandTag = publicDemo ? 'button' : demoHost ? 'a' : 'div';
  $('#side').innerHTML = `
  <${brandTag} class="brand" ${publicDemo ? 'type="button" data-act="deployment-info" title="实战部署说明"' : demoHost ? `href="/practical/?theme=${encodeURIComponent(S.theme)}#today" data-act="switch-practical" title="切换到实战版"` : 'data-act="settings" title="点击更换名称"'}>
    <div class="brand-mark">${name().name[0]}</div>
    <div><b data-elastic>${name().name}</b><small>${name().en}</small></div>
  </${brandTag}>
  <div class="side-cap">今天</div>
  <button class="st experience-nav" data-act="exp-home"><span class="st-dot">✦</span><span><b>体验主线</b><small>8 个场景 · 亲手留下成果</small></span></button>
  ${it('home', '📅', '日程总览', '今日 · 本月 · 新邀约')}
  <div class="journey-group">
  <button type="button" class="journey-toggle" id="journeyToggle" data-act="journey-toggle" aria-expanded="${!journeyCollapsed}" aria-controls="stationJourney" title="展开或收起八阶段流程">
    <span class="journey-label"><span class="journey-title">戏里<span class="journey-subtitle"> · 一部戏的一生</span></span><small class="journey-current" id="journeyCurrent" ${journeyCollapsed ? '' : 'hidden'}>当前阶段 · ${esc(currentStation.no)} ${esc(currentStation.name)}</small></span>
    <span class="journey-toggle-action" aria-hidden="true"><span class="journey-action">${journeyCollapsed ? '展开' : '收起'}</span><span class="journey-chevron">${journeyCollapsed ? '▸' : '▾'}</span></span>
  </button>
  <ol class="journey" id="stationJourney" ${journeyCollapsed ? 'hidden' : ''}>${D.stations.map((s, i) => `
    <li><button class="st ${inSt && S.st === i ? 'on' : ''} ${stationDone(i) ? 'done' : ''}" data-act="go" data-i="${i}">
      <span class="st-dot">${stationDone(i) && !(inSt && S.st === i) ? '✓' : s.no}</span>
      <span><b>${s.name}${rv('st' + i)}</b><small>${s.title.split(' · ')[1] || s.title}</small></span>
    </button></li>`).join('')}
  </ol>
  </div>
  <div class="side-cap">戏外 · 事业</div>
  ${it('portfolio', '🎞', '作品库与发展规划', '作品 · 雷达 · 年度规划')}
  ${it('deals', '📑', '合同与品牌', '资料库 · 代言 · 背调')}
  ${it('fans', '💬', '粉丝与社群', '后援会 · 全平台留言')}
  ${it('crisis', '🛡', '危机公关与舆情', '监测 · 研判 · 回应')}
  ${it('charity', '💛', '公益与影响力', '项目 · 核验 · 联动')}
  ${it('brief', '📰', '行业简报', '核验来源 · 趋势 · 灵感')}
  <div class="side-cap">戏外 · 生活</div>
  ${it('trip', '🧳', '出行与天气', '天气 · 交通 · 携带清单')}
  ${it('body', '💪', '身体与状态', '体重 · 饮食 · 运动 · 睡眠')}
  ${it('rourou', '🐾', '肉肉的小世界', '日常 · 健康 · 时光机')}
  <div class="side-cap">发布会与使用说明</div>
  <button class="st" data-act="capabilities"><span class="st-dot">✦</span><span><b>完整能力与愿景</b><small>已可用 · 可体验 · 规划预览</small></span></button>
  ${it('lab', '🗂', '业务资料实验室', '25 类表单 · 增改 · 导出')}
  ${it('guide', '📖', '使用说明', '图示 · 功能地图 · 操作卡')}
  <a class="st extra" href="launch.html" target="_blank" rel="noopener"><span class="st-dot">▶</span><span><b>发布会页</b><small>暖场 · 宣发片 · 讲解</small></span></a>
  <div class="side-foot">
    <div class="me"><div class="avatar">${D.actor.initial}</div><div><b>${D.actor.name}</b><small>${D.actor.role}</small></div></div>
    <div class="side-btns"><button data-act="settings">⚙ 设置</button><button data-act="reset">↺ 重新演示</button></div>
  </div>`;
}
function renderTop() {
  const s = D.stations[S.st], done = D.stations.filter((_, i) => stationDone(i)).length;
  const publicDemo = isPublicDemo(), demoHost = !publicDemo && location.pathname.startsWith('/demo/');
  $('#top').innerHTML = `
  <div class="crumb">${onPage() ? CRUMB[onPage()]() : `<b>《${D.project.title}》</b><span>${D.project.role} · 第 ${s.no} 站 / 08 · ${s.title}</span>`}</div>
  <div class="prog" title="已完成站数"><i><em style="width:${done / 8 * 100}%"></em></i><span>完整站点 ${done}/8</span></div>
  <button class="btn sm" data-act="exp-resume">${S.experience.active?'继续引导':'带我体验'} ↗</button>
  <button class="chip" data-act="${publicDemo ? 'deployment-info' : demoHost ? 'switch-practical' : 'settings'}" title="${publicDemo ? '查看实战版使用与部署说明' : demoHost ? '保存当前草稿并切换实战版' : '连接模型'}"><span class="led ${!publicDemo && aiConnected ? 'live' : ''}"></span>${publicDemo ? '演示版 · 实战部署说明' : demoHost ? '演示版 · 切换实战' : S.provider === 'demo' ? '演示模式 · 示例结果' : providerName() + (aiConnected?' · 已测试连接':' · 待配置')}</button>
  <div class="themes" title="切换主题">${[['tide', '#2e3a6b', '深蓝潮汐'], ['butter', '#e7dcc3', '奶油便签'], ['moss', '#34541f', '山野片场']].map(([k, c, n]) => `<button data-act="theme" data-v="${k}" title="${n}" class="${S.theme === k ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
  <button class="icon-btn folder-toggle" data-act="folder">资料夹 ${S.folder.length}</button>`;
}
function renderFolder() {
  const items = Object.entries(FOLDER);
  $('#folder').innerHTML = `
  <div class="folder-head"><h3>这部戏的资料夹 <span class="tag">${S.folder.length}/${items.length}</span><button type="button" class="btn sm folder-close" data-act="folder" aria-label="关闭资料夹">×</button></h3>
  <p>每一站的成果都存在这里，下一站接着用。</p><button class="btn sm mt8" data-act="exp-results">查看我的体验成果 ↗</button></div>
  <div class="folder-list">${items.map(([k, v]) => has(k)
    ? `<div class="fi ${newFolder === k ? 'new' : ''}" data-act="go" data-i="${v.st}" data-tab="${v.tab || ''}"><span class="fi-no">${D.stations[v.st].no}</span><div><b>${v.t}</b><small>${v.d}</small></div></div>`
    : `<div class="fi empty"><span class="fi-no">${D.stations[v.st].no}</span><div><b>${v.t}</b><small>待生成 · ${D.stations[v.st].name}</small></div></div>`).join('')}
  </div>
  <div class="folder-foot"><button class="btn ${S.folder.length ? 'pri' : ''}" data-act="export" ${S.folder.length ? '' : 'disabled'}>导出整部戏资料包</button>
    <div class="row mt8 foot3"><button class="btn sm" data-act="backup" title="主线、肉肉与附件；实验室请在模块内独立备份">💾 备份</button><label class="btn sm" title="导入备份文件">📥 导入<input type="file" id="bkFile" accept=".json,application/json" hidden></label><button class="btn sm" data-act="archive" title="给这部戏留一份快照">🗄 归档</button></div></div>`;
  newFolder = null;
}
const HERO_IMG = ['09_script', '02_window', '07_rooftop', '11_wardrobe', '10_set', '13_press', '14_rights', '08_station'];
function hero(s) {
  const art=['script','script','performance','previs','studio','fans','rights','script'][D.stations.indexOf(s)];
  return `<section class="hero has-img" data-illustration="${art}" data-rising-lines style="--img:url('assets/photos/${HERO_IMG[D.stations.indexOf(s)]}.jpg')"><div class="eyebrow">STATION ${s.no} · ${s.en}</div><h1>${s.title}</h1><p>${s.desc}</p>
  <div class="needs">${s.need.map(n => `<span class="need">${n}</span>`).join('')}</div></section>${stepBar(D.stations.indexOf(s))}`;
}
function next(i, carry) {
  const n = D.stations[i + 1];
  return `<div class="next"><div class="carry">${carry}</div><div class="row">
    ${i > 0 ? `<button class="btn" data-act="go" data-i="${i - 1}">← 上一站</button>` : `<button class="btn" data-act="go" data-i="-1">← 日程总览</button>`}
    ${n ? `<button class="btn pri" data-act="go" data-i="${i + 1}">带着成果去下一站：${n.name} →</button>` : `<button class="btn pri" data-act="export">导出整部戏资料包</button>`}
  </div></div>`;
}

/* ---------------- 第1站：接本 ---------------- */
// 评分逻辑：每一项都由原始数据算出，权重可由本人调整
const ARC = { 完整: 100, 部分: 65, 扁平: 35 }, PROD = { 良好: 100, 一般: 60, 待核实: 40 }, PLAT = { 'S+': 100, S: 90, A: 70, 院线待定: 50 };
function scoreScript(x) {
  const r = x.raw, rankPt = { 1: 100, 2: 75, 3: 50 }[r.rank] || 40;
  const Y = D.scoreRule.year, hit = r.goals.filter(g => Y.includes(g)).length;
  const dims = [
    ['role', '角色分量', .5 * r.share + .3 * rankPt + .2 * ARC[r.arc], `戏份 ${r.shareTxt}（${r.share}）×50% + 台词量排名第 ${r.rank}（${rankPt}）×30% + 弧线${r.arc}（${ARC[r.arc]}）×20%`],
    ['dir', '年度方向', Math.min(100, hit / 3 * 100), `今年想走的方向：${Y.join('、')}（命中 3 个记满分）。本剧对应：${r.goals.join('、')}，命中 ${hit} 个`],
    ['team', '团队与平台', .5 * r.dir * 10 + .3 * PROD[r.prod] + .2 * PLAT[r.plat], `导演口碑 ${r.dirTxt}（${r.dir * 10}）×50% + 出品方${r.prod}（${PROD[r.prod]}）×30% + ${r.platTxt}（${PLAT[r.plat]}）×20%`],
    ['sched', '档期', Math.max(0, 100 - r.conflict * 4), `和已有日程冲突 ${r.conflict} 天，每天扣 4 分`],
    ['fee', '片酬', Math.min(100, r.fee * 80), `报价 ÷ 期望片酬 = ${Math.round(r.fee * 100)}%（100% 记 80 分，最高 100）`]
  ].map(d => [d[0], d[1], Math.round(d[2]), d[3]]);
  const W = S.wts || D.scoreRule.weights, sum = Object.values(W).reduce((a, b) => a + b, 0) || 1;
  const total = Math.round(dims.reduce((a, d) => a + d[2] * (W[d[0]] || 0), 0) / sum);
  return { dims, total };
}

function vTake() {
  const T = D.take, P = D.project, SC = D.scripts;
  const weightSum=Object.values(S.wts||D.scoreRule.weights).reduce((a,b)=>a+b,0),best=Math.max(...SC.map(x=>scoreScript(x).total));
  const leaders=weightSum ? SC.filter(x=>scoreScript(x).total===best):[];
  const compare = aiBlock('compare', 'AI 横向对比 3 部剧本', '三个本子同时到，不用一部部从头读完再比。AI 先按角色分量、年度方向、团队、档期、片酬五个维度横向比较。', () => `
    <div class="card"><div class="result-head"><h3>三部剧本横向对比</h3>${demoTag()}</div>
      <div class="grid3">${SC.map(x => `<button class="pick ${S.pick === x.id ? 'on' : ''}" data-act="pick" data-v="${x.id}">
        <div class="row" style="justify-content:space-between"><h3 class="serif" style="font-size:19px">《${x.t}》</h3>${leaders.some(l=>l.id===x.id) ? tag('ok',leaders.length>1?'并列首选':'当前权重首选') : ''}</div>
        <p class="small muted">${x.g} · ${x.role}</p>
        ${(() => { const sc = scoreScript(x); return `<div class="score"><b>${sc.total}</b><small>综合匹配（按你的权重）</small></div>
        ${sc.dims.map(([k, n, v]) => `<div class="dimrow"><span>${n}</span><div class="bar"><i style="width:${v}%;background:${v >= 75 ? 'var(--ok)' : v >= 50 ? 'var(--warn)' : 'var(--bad)'}"></i></div><b class="dv">${v}</b></div>`).join('')}
        ${S.showCalc ? `<ul class="calc">${sc.dims.map(([k, n, v, how]) => `<li><b>${n} ${v}</b>　${how}</li>`).join('')}</ul>` : ''}`; })()}
        <p class="small mt8">${x.note}</p></button>`).join('')}</div>
      <div class="rule-box mt"><div class="row" style="justify-content:space-between"><b>评分规则 · 权重由你定</b><span class="row"><button class="btn sm" data-act="calc">${S.showCalc ? '收起计算过程' : '看每一项怎么算'}</button><button class="btn sm" data-act="wreset">恢复默认权重</button></span></div>
        <div class="wts">${[['role', '角色分量'], ['dir', '年度方向'], ['team', '团队与平台'], ['sched', '档期'], ['fee', '片酬']].map(([k, n]) => `<label><span>${n}</span><input type="range" min="0" max="50" step="5" data-wt="${k}" value="${(S.wts || D.scoreRule.weights)[k]}"><b>${(S.wts || D.scoreRule.weights)[k]}%</b></label>`).join('')}</div>
        <p class="small muted mt8">综合 = 各项得分 × 权重，加总后按权重总和归一。比如更看重作品和角色，就把「角色分量」「年度方向」调高；档期紧就调高「档期」。</p></div>
      <ul class="list mt"><li class="small">${weightSum ? `按当前权重排序：${SC.slice().sort((a,b)=>scoreScript(b).total-scoreScript(a).total).map(x=>'《'+x.t+'》 '+scoreScript(x).total+'分').join(' → ')}。${leaders.length>1?'最高分并列，请结合条件沟通。':'首选会随权重变化。'}`:'所有权重为0，暂无可排序依据，请至少设置一项。'}</li></ul>
      <p class="note">评分是帮你排序的参考，不是结论。接哪一部，由你和经纪团队决定。</p></div>`);
  const pickT = SC.find(x => x.id === S.pick) || SC[0];
  const detail = !S.ran.compare ? '' : S.pick !== 'nl' ? `<div class="card mt"><p>本演示以 <b>《逆光来信》</b> 走完整条主线。《${pickT.t}》的细读流程与之相同。</p><div class="row mt8"><button class="btn sm" data-act="pick" data-v="nl">切回《逆光来信》</button></div></div>` : `<div class="mt">${aiBlock('take', 'AI 细读《逆光来信》', '选定首选后，AI 再细读这一部：讲了什么故事、你的戏份、角色弧线，以及接之前要问清楚的事。', () => `
    <div class="card"><div class="result-head"><h3>《${P.title}》初读报告</h3>${demoTag()}</div>
      <p class="line-q">${T.summary}</p>
      <div class="grid4 mt">
        <div class="metric"><b>${T.scenes.hers}<small>/${T.scenes.total}场</small></b><small>${P.role} 出场</small></div>
        <div class="metric"><b>${T.scenes.linesRank}</b><small>台词量</small></div>
        <div class="metric"><b>3 场</b><small>重点场次：${T.scenes.key}</small></div>
        <div class="metric"><b class="serif" style="font-size:17px;line-height:1.4">${T.arc}</b><small>角色弧线</small></div>
      </div></div>
    <div class="grid2 mt">
      <div class="card"><h3>和你今年的方向合不合</h3><ul class="list mt8">${T.fit.map(f => `<li><div class="row" style="justify-content:space-between"><b>${f.k}</b>${tag(f.s, f.t)}</div><p class="muted small">${f.v}</p></li>`).join('')}</ul></div>
      <div class="card"><h3>接之前，建议先问清楚</h3><ul class="list mt8">${T.questions.map((q, i) => `<li>${i + 1}. ${q}</li>`).join('')}</ul>
        <p class="note">AI 只负责把信息摆清楚。接不接、什么条件接，由你和团队决定。</p>
        <div class="row mt">${has('take') ? `${tag('ok', '✓ 已决定接下这部戏')}<span class="muted small">评估卡已存入资料夹</span>` : `<button class="btn" data-act="directorquestions">先约导演聊聊</button><button class="btn pri" data-act="save" data-k="take">接下《${P.title}》 ✓</button>`}</div></div>
    </div>
    ${has('take') ? `<div class="card mt"><div class="result-head"><div><h3>合作确认记录</h3><p class="sub">把“口头说好的”和“写进合同的”分开记，谁负责、何时确认一目了然。</p></div>${tag('ev', '经纪 · 法务 · 财务')}</div>
      <table class="tbl"><tr><th>事项</th><th>约定</th><th>状态</th><th>负责人</th></tr>${D.confirm.map(c => `<tr><td><b>${c.k}</b></td><td>${c.v}</td><td>${tag(c.st, c.t)}</td><td class="muted">${c.who}</td></tr>`).join('')}</table></div>` : ''}`)}</div>`;
  const vet = S.pick !== 'nl' || !S.ran.compare ? '' : `<div class="card mt"><div class="result-head"><div><h3>项目背调 · 导演、主创、题材与角色</h3><p class="sub">接之前先查清楚：舆论风险、内容导向、角色会不会有问题</p></div></div>
    ${aiBlock('vet', 'AI 背调《逆光来信》', '查导演和主创的公开报道与纠纷记录、出品方资质，研判题材导向与审查风险、角色形象风险，并对照你的作品库。', () => `${T.vet.map(v => `<div class="src">${tag(v[0], v[1])}<div><b>${v[2]}</b><p class="small muted">${v[3]}</p></div></div>`).join('')}
      <div class="gate" style="background:color-mix(in srgb,var(--accent) 12%,transparent)">🎞 对照你的作品库：${T.vsMe} <button class="btn sm" data-act="go" data-i="-8">查看作品库与定位 →</button></div>
      <p class="note">${demoTag()}　正式版接入公开报道、裁判文书与备案信息，并附原始链接；网络传闻不作为依据。</p>`)}</div>`;
  return `${hero(D.stations[0])}
  <div class="card"><h3>收件箱 · 本周收到 ${SC.length} 部剧本</h3>
    ${SC.map(x => `<div class="inbox mt8 ${S.ran.compare ? '' : 'pulse'}"><div class="env">✉️</div><div style="flex:1"><b>《${x.t}》</b><p class="muted small">${x.g} · 邀约角色 ${x.role} · 来自 ${x.from}</p></div>${tag('ev', '新邀约')}</div>`).join('')}</div>
  ${projectInfoView()}<div class="mt">${compare}</div>${detail}${vet}
  ${next(0, has('take') ? '下一站会带上：<b>剧本 + 接戏评估卡</b>（重点场次、舞蹈准备提醒）' : '先比较、再细读，最后决定接哪一部。')}`;
}

/* ---------------- 第2站：读本 ---------------- */
function scriptPanel(hl) {
  return `<div class="card"><div class="result-head"><h3>剧本原文</h3><span class="muted small">节选 · 虚构剧本</span></div>
  <div class="script" id="script">${D.script.map(s => `<div class="sc ${hl === s.id ? 'hl' : ''}" id="sc-${s.id}"><h4>${s.title}</h4>${s.text.split('\n').map(l => `<p>${l}</p>`).join('')}</div>`).join('')}</div></div>`;
}
function relSVG() {
  const c = D.people[0];
  return `<svg viewBox="0 0 610 330" style="width:100%;height:auto">
  ${D.people.slice(1).map(p => `<line class="rel-edge ${p.dash ? 'dash' : ''}" x1="${c.x}" y1="${c.y}" x2="${p.x}" y2="${p.y}"/>
     <text class="rel-label" x="${(c.x + p.x) / 2}" y="${(c.y + p.y) / 2 - 6}" text-anchor="middle">${p.edge.split(' · ')[0]}</text>`).join('')}
  ${D.people.map(p => `<g class="rel-node ${p.me ? 'me' : ''} ${S.rel === p.id ? 'on' : ''}" data-act="rel" data-v="${p.id}">
     <circle cx="${p.x}" cy="${p.y}" r="${p.me ? 44 : 34}"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="${p.me ? 16 : 14}">${p.name}</text></g>`).join('')}
  </svg>`;
}
function growthSVG(data, h = 230, labelKey = 'label', xLabel = d => '第' + d.sc + '场') {
  const W = 620, x = i => 60 + i * ((W - 110) / (data.length - 1)), y = v => h - 40 - v * (h - 80) / 100;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.v)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:auto">
    <line class="axis" x1="40" y1="${h - 40}" x2="${W - 20}" y2="${h - 40}"/>
    <path class="curve" d="${path}"/>
    ${data.map((d, i) => `<circle class="pt" cx="${x(i)}" cy="${y(d.v)}" r="6"/>
      <text x="${x(i)}" y="${y(d.v) - 14}" text-anchor="middle" font-size="13" font-weight="600">${d[labelKey]}</text>
      <text x="${x(i)}" y="${h - 18}" text-anchor="middle" font-size="12" class="rel-label">${xLabel(d)}</text>`).join('')}
  </svg>`;
}
function vRead() {
  const t = tab(1, 'rel'), p = D.people.find(x => x.id === S.rel);
  const cite = (sc, q) => `<button class="btn sm" data-act="cite" data-sc="${sc}">↩ 回到原文 第${sc}场</button>`;
  let body = '';
  if (t === 'rel') body = aiBlock('rel', '分析人物关系', 'AI 按剧情顺序整理人物，并特别标出：每个时间点，角色自己“知道什么、不知道什么”。', () => `
    <div class="card"><div class="result-head"><h3>人物关系</h3>${demoTag()}</div>${relSVG()}
      <div class="line-q mt8"><b>${p.name}</b>　${p.desc}${p.edge ? `<br><span class="muted small">与许知夏：${p.edge}</span>` : ''}</div>
      <div class="note">⚠ 信息时点：准备第12场时，许知夏<b>还不知道</b>信是陆川寄的（第28场才揭晓）。读过结局的我们，不能把答案提前演出来。 ${cite(8)}</div></div>`);
  if (t === 'growth') body = aiBlock('growth', '生成成长线', 'AI 找出许知夏在全剧中的关键选择，画出她从“回避”到“主动”的变化。', () => `
    <div class="card"><div class="result-head"><h3>许知夏的成长线 · 主动性变化</h3>${demoTag()}</div>${growthSVG(D.growth)}
      <ul class="list">${D.growth.map(g => `<li class="row" style="justify-content:space-between"><span><b>第${g.sc}场 · ${g.label}</b>　<span class="muted">${g.note}</span></span>${cite(g.sc)}</li>`).join('')}</ul></div>`);
  if (t === 'sub') body = aiBlock('subtext', '解读第12场潜台词', 'AI 逐句写出“话里没说出口的意思”。注意：这些是对人物的推断，不是剧本写明的事实，需要你和导演判断。', () => `
    <div class="card"><div class="result-head"><h3>第12场 · 动机与潜台词</h3>${demoTag()}</div>
      <ul class="list">${D.subtext.map(s => `<li><p class="serif" style="font-size:16px"><b>${s.who}：</b>${s.line}</p><p class="mt8 small">${tag('', '推断')} <span class="muted">潜台词：</span>${s.sub}</p></li>`).join('')}</ul>
      <div class="note">许知夏在这场戏里的动机：<b>守住自己的节奏</b>——她不是不想谈，而是不想被对方带着谈。 ${cite(12)}</div></div>`);
  if (t === 'key') body = aiBlock('keysc', '找出重点场次', 'AI 按“人物变化幅度 + 情绪强度 + 戏剧功能”给场次排序，告诉你哪几场要花最多功夫。', () => `
    <div class="card"><div class="result-head"><h3>重点场次</h3>${demoTag()}</div>
      <ul class="list">${D.keyScenes.map((k, i) => `<li><div class="row" style="justify-content:space-between"><b>${i + 1}. 第${k.sc}场 · ${k.w}</b>${cite(k.sc)}</div><p class="small mt8">${k.why}</p><p class="small muted">提示：${k.tip}</p></li>`).join('')}</ul></div>`);
  if (t === 'bio') body = aiBlock('bio', 'AI 起草人物小传', '演员进组前通常要写人物小传。AI 汇总剧本里关于许知夏的全部交代，起草一版第一人称小传，你再改成自己的。', () => `
    <div class="card"><div class="result-head"><h3>许知夏 · 人物小传（草稿）</h3>${demoTag()}</div>
      ${(S.bioEdits.main ? S.bioEdits.main.split('\n') : D.bio).map(p => `<p class="serif" style="font-size:15.5px;line-height:1.95;margin-bottom:10px">${esc(p)}</p>`).join('')}
      <p class="note">${D.bioNote}</p><div class="row mt8">${cite(21)}<button class="btn sm" data-act="editbio">✎ 改成我自己的版本</button></div></div>`);
  if (t === 'card') { const RC = D.roleCard; body = aiBlock('rcard', 'AI 生成角色分析卡', '把人物关系、成长线、潜台词和小传汇总成一张卡：背景、经历、性格、动机、外在细节、关系与弧线，一眼看懂她是谁。', () => `
    <div class="rcard" id="rcard"><div class="rc-side"><div class="rc-photo" style="background-image:url('assets/photos/06_xia.jpg')"></div>
        <div class="swatch">${RC.palette.map(c => `<i style="background:${c}"></i>`).join('')}</div>
        <dl class="kv small">${RC.basic.map(b => `<dt>${b[0]}</dt><dd>${b[1]}</dd>`).join('')}</dl>
        <div class="row mt8">${RC.tags.map(x => `<span class="tag">${x}</span>`).join('')}</div></div>
      <div class="rc-main"><div class="result-head"><div><div class="eyebrow" style="color:var(--accent)">CHARACTER PROFILE</div><h2 class="serif" style="font-size:30px">许知夏</h2></div>${demoTag()}</div>
        <p class="line-q">${RC.oneLine}</p>
        <h4 class="rc-h">人物前史</h4><div class="rc-time">${RC.timeline.map(x => `<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>
        <div class="grid2 mt"><div><h4 class="rc-h">性格光谱</h4>${RC.traits.map(([l, r, v]) => `<div class="spec"><span>${l}</span><div><i style="left:${v}%"></i></div><span>${r}</span></div>`).join('')}</div>
          <div><h4 class="rc-h">核心驱动</h4>${RC.core.map(c => `<div class="core"><small>${c[0]}</small><b>${c[1]}</b></div>`).join('')}</div></div>
        <div class="grid2 mt"><div><h4 class="rc-h">外在细节</h4><dl class="kv small" style="grid-template-columns:52px 1fr">${RC.surface.map(x => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('')}</dl></div>
          <div><h4 class="rc-h">人物关系</h4><ul class="list small">${RC.relations.map(x => `<li><b>${x[0]}</b>　${x[1]}</li>`).join('')}</ul></div></div>
        <h4 class="rc-h mt">人物弧线</h4><div class="rc-arc">${RC.arc.map((x, i) => `<div><span>${x[0]}</span><b>${x[1]}</b><small>${x[2]}</small></div>${i < RC.arc.length - 1 ? '<i>→</i>' : ''}`).join('')}</div>
        <div class="grid2 mt"><div><h4 class="rc-h">关键台词</h4>${RC.lines.map(l => `<p class="serif small" style="margin:4px 0">${l}</p>`).join('')}</div>
          <div><h4 class="rc-h">表演提醒</h4><ul class="list small">${RC.notes.map(n => `<li>✦ ${n}</li>`).join('')}</ul></div></div>
        <div class="row mt">${cite(21)}<button class="btn sm" data-act="print">🖨 打印 / 存为 PDF</button>${has('read') ? tag('ok', '✓ 已存入资料夹') : `<button class="btn sm pri" data-act="save" data-k="read">存入资料夹</button>`}</div>
        <p class="note">背景与经历来自剧本交代（可点“回到原文”核对），性格、动机等为 AI 推断，请与导演确认后改成你自己的理解。</p></div></div>`); }
  if (t === 'line') body = aiBlock('lineopt', '生成台词优化建议', 'AI 给出几种改法，原句始终保留。采不采用、怎么说更像这个人物，由你和导演决定。', () => `
    <div class="card"><div class="result-head"><h3>台词优化 · 第12场</h3>${demoTag()}</div>
      <p class="small muted">原句（保留）</p><p class="line-q">${S.adopt !== null ? `<s class="muted">${D.lineOpt.original}</s><br>${D.lineOpt.options[S.adopt].t} ${tag('ok', '已采用建议 · 原句已存档')}` : D.lineOpt.original}</p>
      <div class="grid3 mt">${D.lineOpt.options.map((o, i) => `<button class="pick ${S.adopt === i ? 'on' : ''}" data-act="adopt" data-i="${i}"><span class="tag">${o.k}</span><p class="serif mt8" style="font-size:16px">${o.t}</p><p class="small muted mt8">${o.why}</p></button>`).join('')}</div>
      <div class="row mt">${S.adopt !== null ? `<button class="btn sm" data-act="adopt" data-i="-1">撤回，恢复原句</button>` : ''}${has('line') ? tag('ok', '✓ 建议稿已存入资料夹') : `<button class="btn sm" data-act="save" data-k="line" ${S.adopt === null ? 'disabled' : ''}>存为建议稿（交导演确认）</button>`}</div></div>`);
  const allRan = ['rel', 'growth', 'subtext', 'keysc', 'bio'].every(k => S.ran[k]);
  return `${hero(D.stations[1])}
  ${tabs(1, [['rel', '人物关系'], ['growth', '成长线'], ['sub', '动机与潜台词'], ['key', '重点场次'], ['bio', '人物小传'], ['card', '角色分析卡'], ['line', '台词优化']])}
  <div class="${t === 'card' ? 'fullw' : 'split'}">${t === 'card' ? '' : `<div>${scriptPanel(S.hl)}</div>`}<div>${body}
    <div class="card"><div class="row" style="justify-content:space-between"><div><h3>角色分析卡</h3><p class="sub">关系、成长线、潜台词、重点场次、人物小传都看过后，存成一张卡带进下一站。</p></div>
    ${has('read') ? tag('ok', '✓ 已存入资料夹') : `<button class="btn ${allRan ? 'pri' : ''}" data-act="save" data-k="read" ${allRan ? '' : 'disabled'}>存入资料夹</button>`}</div>
    ${allRan ? '' : `<p class="small muted mt8">还差：${[['rel', '人物关系'], ['growth', '成长线'], ['subtext', '潜台词'], ['keysc', '重点场次'], ['bio', '人物小传']].filter(([k]) => !S.ran[k]).map(x => x[1]).join('、')}</p>`}</div>
  </div></div>
  ${next(1, has('read') ? '下一站会带上：<b>角色分析卡</b>（第12场潜台词、信息时点、重点场次）' : '分析结果存入资料夹后，下一站可以直接接着用。')}`;
}

/* ---------------- 第3站：入角 ---------------- */
function vRole() {
  const t = tab(2, 'scene');
  let body;
  if (t === 'scene') {
    body = `<div class="card"><div class="result-head"><h3>第12场 · 窗边的来信</h3><span class="muted small">来自资料夹：角色分析卡 · 重点场次 1</span></div>
      <p class="line-q">陆川：你一直留着这封信？／许知夏：我只是还没想好，要把它放在哪里。／陆川：有些事情，放下了也不会忘。／许知夏：那就先让我，把话说完。</p></div>
    <div class="mt">${aiBlock('beats', '拆解情绪节拍与三种演法', 'AI 把这场戏拆成 4 个情绪节拍，写出每一拍的人物目标、阻碍和动作反应，再给出同一场戏的三种处理方式。', () => `
      <div class="card"><div class="result-head"><h3>情绪推进</h3>${demoTag()}</div>${growthSVG(D.beats, 210, 't', (d) => '')}
        <div class="grid4 mt">${D.beats.map((b, i) => `<div><span class="tag">节拍 ${i + 1} · ${b.t}</span><dl class="kv mt8" style="grid-template-columns:40px 1fr;font-size:13px"><dt>目标</dt><dd>${b.goal}</dd><dt>阻碍</dt><dd>${b.obs}</dd><dt>动作</dt><dd>${b.act}</dd></dl></div>`).join('')}</div></div>
      <div class="card"><div class="result-head"><h3>同一场戏 · 三种处理</h3><span class="muted small">点选一种，带进下一站做预演</span></div>
        <div class="grid3">${D.handlings.map(h => `<button class="pick ${S.handling === h.id ? 'on' : ''}" data-act="handling" data-v="${h.id}"><h3 class="serif" style="font-size:20px">${h.k}</h3>
          <dl class="kv mt8" style="grid-template-columns:40px 1fr;font-size:13px"><dt>节奏</dt><dd>${h.rhythm}</dd><dt>视线</dt><dd>${h.eye}</dd><dt>身体</dt><dd>${h.body}</dd><dt>风险</dt><dd>${h.risk}</dd></dl>
          <p class="small mt8" style="color:var(--accent)">${h.fit}</p></button>`).join('')}</div>
        <div class="row mt" style="justify-content:space-between"><span class="small muted">最后用哪一种，在现场和导演一起定。AI 只是把差别摆在眼前。</span>
        ${has('role') ? tag('ok', `✓ 已存：${handlingName()}版表演方案`) : `<button class="btn pri" data-act="save" data-k="role">选定「${handlingName()}」，存入表演方案</button>`}</div></div>`)}</div>`;
  } else if (t === 'drill') {
    S.drillShow = S.drillShow || {};
    body = `<div class="card"><div class="result-head"><h3>台词陪练</h3><span class="muted small">AI 念对手的词，你接自己的词；点卡片看答案</span></div>
      ${D.drill.map((d, i) => `<div class="drill"><p class="muted">${d.cue}</p><button class="drill-line ${S.drillShow[i] ? 'on' : ''}" data-act="drill" data-i="${i}">${S.drillShow[i] ? `许知夏：${d.line}` : '许知夏：▢▢▢▢▢▢▢▢　（先自己说，再点开核对）'}</button></div>`).join('')}
      <div class="row mt"><span class="small muted">已核对 ${Object.values(S.drillShow).filter(Boolean).length}/${D.drill.length} 句 · 正式版可接语音朗读与录音回放</span><button class="btn sm" data-act="drill" data-i="-1">重新遮挡</button></div></div>`;
  } else {
    const Dn = D.dance;
    body = `<div class="card"><div class="result-head"><h3>第21场 · 天台独舞</h3><span class="muted small">来自资料夹：接戏评估卡 · 需准备 6 周</span></div>
      <p class="line-q">${D.script.find(s => s.id === 21).text}</p></div>
    <div class="mt">${aiBlock('dance', 'AI 拆解舞段', 'AI 从主题、人物情绪、音乐节奏和动作段落四个方面拆解这段舞，辅助编舞灵感和训练复盘。', () => `
      <div class="card"><div class="result-head"><h3>舞段拆解</h3>${demoTag()}</div>
        <dl class="kv"><dt>主题</dt><dd class="serif">${Dn.theme}</dd><dt>音乐</dt><dd>${Dn.music}</dd></dl>
        <div class="dance">${Dn.segs.map(s => `<div class="seg" style="--c:${s.c}"><b>${s.n}</b><small>情绪：${s.emo}</small><small>动作：${s.move}</small><div class="beats">${'<i></i>'.repeat(s.beats)}</div><small>${s.beats} × 8 拍</small></div>`).join('')}</div></div>
      <div class="card"><div class="result-head"><h3>训练记录与动作观察问题</h3><span class="muted small">结合训练视频形成观察问题</span></div>
        <ul class="list">${Dn.log.map(l => `<li><div class="row"><span class="tag">${l.d}</span><b>${l.t}</b></div><p class="small mt8">❓ ${l.q}</p></li>`).join('')}</ul>
        <div class="gate">⚠ 动作纠正和身体安全由专业舞蹈老师判断。AI 只负责记录、整理和提出观察问题。</div>
        <div class="row mt">${has('dance') ? tag('ok', '✓ 舞蹈拆解已存入资料夹') : `<button class="btn pri" data-act="save" data-k="dance">存入资料夹</button>`}</div></div>`)}</div>`;
  }
  return `${hero(D.stations[2])}${tabs(2, [['scene', '第12场 · 表演设计'], ['drill', '台词陪练'], ['dance', '第21场 · 舞蹈段落']])}${body}
  ${next(2, has('role') ? `下一站会带上：<b>「${handlingName()}」版表演方案</b>，分镜会按这个演法生成` : '选定一种演法，下一站的分镜会按它来生成。')}`;
}

/* ---------------- 第4站：预演 ---------------- */
const PHOTO = { wide: '04_two', letter: '03_letter', lu: '05_lu', xia: '06_xia', two: '02_window' };
const photo = (n, cls = '') => `<img class="ph ${cls}" src="assets/photos/${n}.jpg" alt="" loading="lazy">`;
function pic(kind, uid) {
  if (PHOTO[kind]) return photo(PHOTO[kind]);
  const g = `g${uid}`;
  const bg = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4668"/><stop offset="1" stop-color="#1b2133"/></linearGradient>
    <radialGradient id="${g}l" cx=".72" cy=".3" r=".6"><stop offset="0" stop-color="#f6e7c4" stop-opacity=".55"/><stop offset="1" stop-color="#f6e7c4" stop-opacity="0"/></radialGradient></defs>
    <rect width="320" height="200" fill="url(#${g})"/><rect width="320" height="200" fill="url(#${g}l)"/>`;
  const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#efe3c6" opacity=".85" rx="2"/><path d="M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}" stroke="#3a4668" stroke-width="5"/>`;
  const person = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-46" r="17" fill="${c}"/><path d="M-30 30 Q-28 -22 0 -24 Q28 -22 30 30Z" fill="${c}"/></g>`;
  const letter = (x, y, r = -6, s = 1) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><rect x="-22" y="-14" width="44" height="28" fill="#f3ead6" rx="2"/><path d="M-22 -14 L0 3 L22 -14" stroke="#b9a782" fill="none" stroke-width="1.5"/></g>`;
  const table = `<rect x="0" y="150" width="320" height="50" fill="#141826" opacity=".85"/>`;
  const K = {
    wide: `${win(185, 28, 90, 96)}${table}${person(95, 150, 1, '#202638')}${person(232, 150, 1, '#2a3048')}${letter(162, 160)}`,
    letter: `<rect x="0" y="60" width="320" height="140" fill="#1a1f2e"/>${letter(160, 128, -8, 2.6)}<rect x="196" y="96" width="70" height="22" rx="11" fill="#d9b9a0" transform="rotate(-20 230 107)"/>`,
    lu: `${win(30, 24, 80, 86)}${person(210, 168, 1.35, '#2c3350')}<path d="M0 200 Q10 110 70 120 Q110 130 120 200Z" fill="#0f1220" opacity=".95"/>`,
    xia: `${win(220, 10, 90, 100)}<g transform="translate(150 132)"><circle cx="0" cy="-30" r="44" fill="#262d44"/><path d="M-44 -30 Q-46 -84 0 -80 Q48 -82 44 -24 Q40 -60 0 -62 Q-38 -62 -44 -30Z" fill="#141826"/><path d="M-70 80 Q-60 20 0 18 Q60 20 70 80Z" fill="#e9e2d2" opacity=".9"/></g>`,
    two: `${win(120, 20, 80, 90)}${table}${person(105, 150, 1.15, '#23293d')}${person(222, 150, 1.15, '#2e3550')}${letter(162, 162, 0, .8)}`
  };
  return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">${bg}${K[kind]}</svg>`;
}
function vPrev() {
  const t = tab(3, 'look');
  let body;
  if (t === 'look') body = aiBlock('looks', 'AI 生成造型参考', '根据每场戏的人物状态和环境，生成造型方向和色彩参考，作为和造型老师沟通的起点。', () => `
    <div class="result-head"><h3>造型参考 · 角色氛围</h3>${demoTag()}</div>
    <div class="grid3">${D.looks.map(l => `<div class="card look">${photo(l.img, 'look-img')}<span class="tag">${l.sc}</span><h3 class="serif mt8" style="font-size:19px">${l.k}</h3>
      <div class="swatch">${l.pal.map(c => `<i style="background:${c}"></i>`).join('')}</div><p class="small muted">氛围：${l.mood}</p></div>`).join('')}</div>
    <p class="note">造型参考只是方向，最终方案由造型团队设计。生成图像涉及本人肖像时，按第 07 站的授权规则处理。</p>`);
  else if (t === 'board') body = aiBlock('shots', 'AI 生成轻量分镜', `按第 03 站选定的「${handlingName()}」演法，把第12场拆成 5 个镜头。`, () => `
    <div class="result-head"><h3>第12场 · 轻量分镜（${handlingName()}版）</h3>${demoTag()}</div><p class="small muted" style="margin:-6px 0 10px">演示版三种演法共用同一组示意镜头；正式版按所选演法生成。</p>
    <div class="frames">${D.shots.map(s => `<div class="frame"><div class="pic">${pic(s.pic, 'f' + s.no)}</div><div class="cap"><b>${s.no} · ${s.size} · ${s.dur}秒</b>${s.cam}<br><span class="muted">${s.act}</span>${s.line ? `<br><span class="serif">${s.line}</span>` : ''}</div></div>`).join('')}</div>
    <div class="row mt">${has('prev') ? tag('ok', '✓ 造型与分镜已存入资料夹') : `<button class="btn pri" data-act="save" data-k="prev">存入资料夹</button>`}<button class="btn" data-act="tab" data-st="3" data-v="comic">▶ 播放成动态漫剧</button></div>`);
  else body = `<div class="result-head"><h3>动态漫剧预演 · 第12场</h3><span class="muted small">由分镜自动串联 · 共 ${D.shots.reduce((a, s) => a + s.dur, 0)} 秒</span></div>
    <div class="player" id="player"><div class="cover"><div><div class="eyebrow" style="color:#fff">MOTION PREVIEW</div><h2 class="serif" style="font-size:28px">《${D.project.title}》第12场 · 窗边的来信</h2><p style="opacity:.75">${handlingName()}版 · ${D.shots.length} 个镜头</p><button data-act="play">▶ 播放</button></div></div></div>
    <p class="note">这是分镜节奏示意，用来和导演、摄影讨论构图、停顿和镜头时长。正式版可接入图像 / 视频生成模型生成画面。</p>`;
  return `${hero(D.stations[3])}${tabs(3, [['look', '造型参考'], ['board', '轻量分镜'], ['comic', '动态漫剧']])}${t==='look'?lookRevealPreview():''}${body}
  ${next(3, has('comic') ? '预演完成。进组后，下一站管理<b>团队协同</b>' : '播放一次动态漫剧，预演就会存入资料夹。')}`;
}
let comicAudio = null;
window.__comicStop = () => { if (comicAudio) { comicAudio.pause(); comicAudio = null; } };
function playComic() {
  clearTimers();
  try { if (comicAudio) comicAudio.pause(); comicAudio = new Audio('assets/music/comic.m4a'); comicAudio.play().catch(() => {}); } catch {}
  const el = $('#player'); if (!el) return;
  const total = D.shots.reduce((a, s) => a + s.dur, 0) * 1000;
  el.innerHTML = `<div class="stage" id="stage"></div><div class="ctrl"><button data-act="play">↺ 重播</button><div class="pbar"><i id="pb"></i></div><span id="pt" style="font-size:12px">0s</span></div>`;
  let t = 0;
  D.shots.forEach((s, i) => {
    later(() => {
      $('#stage').innerHTML = `<div class="kb" style="position:absolute;inset:0;animation-duration:${s.dur}s">${pic(s.pic, 'p' + i)}</div><div class="shotno">SHOT ${s.no} · ${s.size} · ${s.cam}</div><div class="subtitle">${s.line || `<span style="opacity:.8;font-size:16px">${s.act}</span>`}</div>`;
    }, t);
    t += s.dur * 1000;
  });
  const pb = $('#pb'), pt = $('#pt'), t0 = performance.now();
  const tick = () => {
    if (!document.body.contains(pb)) return;
    const p = Math.min(1, (performance.now() - t0) / total);
    pb.style.width = p * 100 + '%'; pt.textContent = Math.round(p * total / 1000) + 's';
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  later(async () => {
    const st = $('#stage'); if (st) st.insertAdjacentHTML('beforeend', `<div class="cover" style="background:#000c"><div><h2 class="serif">预演结束</h2><button data-act="play">↺ 再看一遍</button></div></div>`);
    if (!has('comic')) await addFolder('comic', '已存入资料夹：动态漫剧预演');
  }, total + 300);
}

/* ---------------- 第5站：开机 ---------------- */
function vShoot() {
  const t = tab(4, 'call'), C = D.callsheet;
  let body;
  if (t === 'call') body = `<div class="split"><div class="card"><div class="result-head"><h3>今日通告单</h3><span class="tag">${C.date}</span></div>
      <dl class="kv"><dt>时间</dt><dd>${C.call}</dd><dt>地点</dt><dd>${C.place}</dd><dt>天气</dt><dd>${C.weather}</dd></dl>
      <table class="tbl mt"><tr><th>场</th><th>内容</th><th>时间</th><th>人物</th></tr>${C.scenes.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>
    <div>${aiBlock('call', 'AI 读通告单', '通告单每天都来，信息很碎。AI 帮你读成“今天我要准备什么”，并把资料夹里这场戏的表演方案、台词稿关联进来。', () => `
      <div class="card"><div class="result-head"><h3>今天你要准备的</h3>${demoTag()}</div>
      <ul class="list">${C.prep.map(p => `<li class="small">☐ ${p}</li>`).join('')}</ul>
      <h3 class="mt">剧本改页核对 <span class="muted small">${D.revision.from}</span></h3>
      <ul class="list mt8">${D.revision.changes.map(([k, a, b]) => `<li class="small">${tag(k === '删' ? 'bad' : k === '加' ? 'ok' : 'warn', k)} ${a ? `<s class="muted">${a}</s>` : ''} ${b ? `→ <b>${b}</b>` : ''}</li>`).join('')}</ul>
      <p class="note">${D.revision.note}</p>
      <div class="row mt8">${has('role') ? tag('ok', `已关联：第12场「${handlingName()}」版表演方案`) : tag('warn', '第12场还没有表演方案，可回到「入角」补上')}${has('line') ? tag('ok', '已关联：台词建议稿') : ''}</div></div>`)}</div></div>`;
  else if (t === 'tasks') body = `<div class="split"><div class="card"><h3>会议纪要</h3><p class="sub">把碰头会的记录粘进来（可直接修改）</p>
      <div class="field"><textarea id="minutes" style="min-height:230px">${esc(D.minutes)}</textarea></div><button class="btn pri" data-act="task-extract">把当前稿子拆成待办 →</button><p class="small muted mt8">每行一件事，先预览再确认。可写：事项｜负责人｜截止时间。</p></div>
    <div>${aiBlock('tasks', 'AI 拆解成任务', 'AI 从纪要里找出“谁、做什么、什么时候”，拆成任务卡，同时排进内容日历。', () => `
      <div class="result-head"><h3>任务看板</h3><div class="row"><span class="tag">预置与自行录入任务</span><button class="btn sm" data-act="task-new">＋ 新增自己的任务</button></div></div>
      <div class="kanban">${['待办', '进行中', '已完成'].map((c, ci) => `<div class="col"><h4>${c}<span>${S.tasks.filter(x => x.col === ci).length}</span></h4>
        ${S.tasks.map((x, i) => x.col === ci ? `<div class="task">${esc(x.t)}<small><span>${esc(x.who)} · ${esc(x.due)}</span><span><button data-act="task-edit" data-i="${i}">编辑</button> ${ci < 2 ? `<button data-act="move" data-i="${i}">推进 →</button>` : '✓'}</span></small></div>` : '').join('')}</div>`).join('')}</div>
      <div class="row mt">${has('shoot') ? tag('ok', '✓ 已存入资料夹') : `<button class="btn pri" data-act="save" data-k="shoot">存入资料夹</button>`}<button class="btn" data-act="tab" data-st="4" data-v="cal">查看内容日历 →</button></div>`)}</div></div>`;
  else if (t === 'cal') body = `<div class="card"><div class="result-head"><h3>内容日历 · 开机周</h3><div class="row small"><span class="ev shoot">拍摄</span><span class="ev post">物料发布</span><span class="ev fan">粉丝 / 社群</span></div></div>
    <div class="cal">${D.week.map(d => `<div class="day"><b>${d.d}</b>${d.ev.map(([c, n]) => `<span class="ev ${c}">${n}</span>`).join('')}</div>`).join('')}</div>
    <p class="note">物料发布前都需要经过“宣传起草 → 经纪人审核 → 本人确认”，日历只负责提醒，不会自动发布。</p></div>`;
  else {
    const q = (S.faqQ || '').trim();
    const list = D.faq.filter(f => !q || (f.q + f.a + f.tag).includes(q));
    body = `<div class="card"><div class="result-head"><h3>工作室知识库 · 常见问题模板</h3><span class="muted small">团队成员遇到问题先查这里，少重复问</span></div>
      <div class="field" style="margin-top:0"><input id="faq" placeholder="搜索：探班、行程、物料、品牌…" value="${esc(q)}"></div>
      <ul class="list mt8">${list.map(f => `<li><div class="row"><span class="tag">${f.tag}</span><b>${f.q}</b></div><p class="small mt8">${f.a}</p></li>`).join('') || '<li class="muted">没有找到，可以新建一条</li>'}</ul></div>`;
  }
  return `${hero(D.stations[4])}${tabs(4, [['call', '今日通告单'], ['tasks', '纪要 → 任务'], ['cal', '内容日历'], ['faq', '知识库与常见问题']])}${body}
  ${next(4, '拍完了，剧要开播。下一站处理<b>粉丝留言</b>')}`;
}

/* ---------------- 第6站：宣传 ---------------- */
function replyPanel() {
  const c = D.comments.find(x => x.id === S.sel);
  if (!c) return `<div class="card"><h3>回复草稿</h3><p class="sub">点左边任意一条留言，AI 会按它的类型起草回复。</p></div>`;
  const risk = c.c === 'risk';
  const tones = [['warm', '温暖'], ['play', '俏皮'], ['formal', '正式']];
  const draftKey='comment-'+c.id+'-'+S.tone,reply=S.replyEdits[draftKey]??D.replies[c.c][S.tone],submitted=S.replySubmissions[c.id];
  return `<div class="card"><div class="result-head"><h3>回复草稿</h3>${demoTag()}</div>
    <p class="small muted">${c.u}：</p><p class="line-q" style="font-size:14.5px">${c.t}</p>
    ${risk ? `<div class="alert mt"><b>⚠ 不建议回复</b><p class="small mt8">${c.id === 9 ? D.signals[0].s : D.signals[1].s}</p></div>` : `
    <p class="small muted mt">语气</p><div class="opt">${tones.map(([k, n]) => `<button data-act="tone" data-v="${k}" class="${S.tone === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="field"><label for="reply-${c.id}-${S.tone}">可编辑回复草稿 · 修改后保存</label><textarea class="reply-editor" id="reply-${c.id}-${S.tone}" rows="4">${esc(reply)}</textarea><div class="row mt8"><button class="btn sm" data-act="reply-save">保存当前回复草稿</button><span class="small muted">每种语气单独保存；切换语气不会覆盖其他草稿。</span></div></div>`}
    <div class="gate">🔒 AI 只起草，不会自动发送。重要对外回复必须经过工作室人工审核。</div>
    ${submitted?`<details class="reply-snapshot mt8"><summary>已提交审核的快照 · ${esc(submitted.at)}</summary><p class="mt8">${esc(submitted.text)}</p><p class="small muted">${submitted.risk?'已转人工处理':'待工作室人工确认'} · 修改草稿不会改写这份快照。</p></details>`:S.submitted[c.id]?'<p class="note">旧演示记录已提交过审核，未保留当时正文；可重新提交当前版本。</p>':''}
    <div class="row mt"><button class="btn pri" data-act="submit">${risk ? '转工作室人工处理' : submitted?'提交当前版本审核':'提交工作室审核'}</button>${submitted?tag('ok','已留存审核快照 · 未对外发送'):''}</div></div>`;
}
async function saveReply(submit=false){
 const c=D.comments.find(x=>x.id===S.sel);if(!c)throw Error('先选择一条留言');
 const risk=c.c==='risk',text=risk?(c.id===9?D.signals[0].s:D.signals[1].s):$('#reply-'+c.id+'-'+S.tone).value.trim();
 if(!text){toast('回复不能为空，请先写下草稿');return;}
 const edited=!risk&&text!==D.replies[c.c][S.tone];
 if(!risk){S.replyEdits['comment-'+c.id+'-'+S.tone]=text;if(edited)S.experience.checks.replyEdited=true;}
 if(submit){S.submitted[c.id]=true;S.replySubmissions[c.id]={text,tone:S.tone,at:stamp(),risk,edited};}
 await save();render(true);toast(submit?'已保存当前版本的审核快照，未对外发送':'回复草稿已保存，刷新后仍保留');
}
function vPromo() {
  const t = tab(5, 'cmt');
  let body;
  if (t === 'cmt') body = `<div class="split" style="grid-template-columns:minmax(0,7fr) minmax(0,5fr)"><div>
    ${S.ran.classify ? `<div class="${freshKey === 'classify' ? 'reveal' : ''}"><div class="result-head"><h3>留言分类</h3>${demoTag()}</div>
      <div class="buckets">${Object.entries(D.cats).map(([k, v]) => `<div class="bucket"><h4>${v.ic} ${v.n}<span class="muted">${D.comments.filter(c => c.c === k).length}</span></h4>
      <div class="cmts">${D.comments.filter(c => c.c === k).map(c => `<button class="cmt ${S.sel === c.id ? 'on' : ''}" data-act="sel" data-i="${c.id}"><small>${c.u}${S.submitted[c.id] ? ' · ✓ 已提交审核' : ''}</small>${c.t}</button>`).join('')}</div></div>`).join('')}</div></div>`
      : `<div class="result-head"><h3>最新留言 · 未整理</h3><span class="muted small">共 ${D.comments.length} 条 · 示例数据</span></div>
      <div class="cmts">${D.comments.map(c => `<div class="cmt"><small>${c.u}</small>${c.t}</div>`).join('')}</div>
      <div class="mt" data-ai="classify" style="display:flex;gap:12px;align-items:center"><button class="btn pri ai" data-act="run" data-k="classify">AI 分类并起草回复</button><span class="small muted">按话题与情绪分类，标出需要人工关注的内容</span></div>`}
    </div><div style="position:sticky;top:0">${S.ran.classify ? replyPanel() : `<div class="card"><h3>回复草稿</h3><p class="sub">先让 AI 把留言分好类。</p></div>`}</div></div>`;
  else if (t === 'rep') body = aiBlock('report', 'AI 提炼运营反馈', '把一周的留言变成团队能直接用的反馈：大家在聊什么、情绪怎么样、接下来可以做什么。', () => `
    <div class="result-head"><h3>粉丝反馈周报</h3>${demoTag()}</div>
    <div class="grid2"><div class="card"><h3>热议话题</h3><ul class="list mt8">${D.report.topics.map(([n, v]) => `<li><div class="row" style="justify-content:space-between"><span>${n}</span><span class="muted small">${v}%</span></div><div class="bar mt8"><i style="width:${v * 2.6}%"></i></div></li>`).join('')}</ul></div>
    <div class="card"><h3>情绪分布</h3><div class="bar mt" style="height:22px;display:flex"><i style="width:${D.report.mood.pos}%;background:var(--ok);border-radius:0"></i><i style="width:${D.report.mood.neu}%;background:var(--muted);border-radius:0"></i><i style="width:${D.report.mood.neg}%;background:var(--bad);border-radius:0"></i></div>
      <p class="small mt8">正面 ${D.report.mood.pos}% · 中性 ${D.report.mood.neu}% · 负面 ${D.report.mood.neg}%</p>
      <h3 class="mt">建议动作</h3><ul class="list mt8">${D.report.actions.map(a => `<li class="small">→ ${a}</li>`).join('')}</ul></div></div>
    <div class="row mt">${has('promo') ? tag('ok', '✓ 周报已存入资料夹') : `<button class="btn pri" data-act="save" data-k="promo">存入资料夹</button>`}</div>`);
  else if (t === 'itv') { const I = D.interview; body = aiBlock('itv', 'AI 生成采访备忘卡', '宣传期采访一个接一个。AI 根据角色分析、训练记录和粉丝热议，提前准备可能被问到的问题和要点。', () => `
    <div class="card"><div class="result-head"><h3>采访备忘卡 · ${I.media}</h3>${demoTag()}</div>
      <div class="grid3"><div><b>可能被问到</b><ul class="list mt8">${I.qs.map(q => `<li class="small">“${q}”</li>`).join('')}</ul></div>
      <div><b>可以讲的要点</b><ul class="list mt8">${I.keys.map(q => `<li class="small">✓ ${q}</li>`).join('')}</ul></div>
      <div><b>不展开的话题</b><ul class="list mt8">${I.avoid.map(q => `<li class="small">✕ ${q}</li>`).join('')}</ul></div></div>
      <p class="note">要点来自资料夹：角色分析卡、舞蹈训练记录、粉丝反馈周报。口径以宣传团队确认为准。</p></div>`); }
  else body = `<div class="result-head"><h3>舆情信号</h3><span class="muted small">只做归类和提醒，处置由人决定</span></div>
    ${D.signals.map(s => `<div class="alert mt8" style="${s.lv === 'warn' ? 'border-color:color-mix(in srgb,var(--warn) 55%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent)' : ''}"><div class="row">${tag(s.lv, s.t)}<b>${s.d}</b></div><p class="small mt8">建议：${s.s}</p></div>`).join('')}
    <p class="note">AI 不会把网络传闻当成事实，也不会替团队对外回应。</p>`;
  return `${hero(D.stations[5])}${tabs(5, [['cmt', '留言分类与回复'], ['rep', '运营反馈'], ['itv', '采访备忘卡'], ['sig', '舆情信号']])}${body}
  ${next(5, '剧火了，品牌找上门。下一站处理<b>商业合作与授权</b>')}`;
}

/* ---------------- 第7站：商务 ---------------- */
function vDeal() {
  const O = D.offer, sc = D.scopes[S.scope];
  return `${hero(D.stations[6])}
  <div class="inbox"><div class="env">💼</div><div style="flex:1"><b>合作邀约：${O.brand}</b><p class="small muted">${O.type} · ${O.ask} · ${O.term}</p></div>${tag('warn', '涉及数字人')}</div>
  <div class="grid2 mt">
    <div>${aiBlock('brand', 'AI 核验品牌信息', '行业信息助手先检索这家品牌的公开信息，每一条都标清来源。网络传闻不当成事实。', () => `
      <div class="card"><div class="result-head"><h3>品牌背景简报</h3>${demoTag()}</div>
      ${D.sources.map(s => `<div class="src">${tag(s.lv, s.tag)}<div><b>${s.t}</b><p class="small muted">来源：${s.from}</p></div></div>`).join('')}</div>`)}</div>
    <div class="card"><h3>相关法规提示</h3><ul class="list mt8">${D.laws.map(l => `<li class="small">${l}</li>`).join('')}</ul><p class="note">仅作知识提示，不替代专业法律意见。合同条款以律师审核为准。</p></div>
  </div>
  <div class="card mt">
    <div class="result-head"><div><h3>授权边界核对</h3><p class="sub">同一份肖像、声音和表演，用途不同，要问的问题也不同。</p></div>
      <div class="opt" style="margin:0">${Object.entries(D.scopes).map(([k, v]) => `<button data-act="scope" data-v="${k}" class="${S.scope === k ? 'on' : ''}">${v.n}</button>`).join('')}</div></div>
    ${aiBlock('rights', 'AI 逐项核对授权', '按肖像、声音、表演数据、生成内容、商业授权五个方面，结合这次的用途逐项核对。', () => `
      <p class="small">当前用途：<b>${sc.n}</b> — ${sc.d}</p>
      <div class="dims mt">${D.dims.map(d => { const lv = sc.lv[d.id]; return `<div class="dim" style="border-top:4px solid var(--${lv === 'ok' ? 'ok' : lv === 'warn' ? 'warn' : 'bad'})"><span class="ic">${d.ic}</span><b>${d.n}</b>${tag(lv, D.lvText[lv])}${d.q.map(q => `<p>· ${q}</p>`).join('')}</div>`; }).join('')}</div>
      <div class="row mt" style="justify-content:space-between"><span class="small muted">${demoTag()}　清单交经纪人与律师审核，最终是否合作由本人和团队决定。</span>
      ${has('deal') ? tag('ok', '✓ 授权核对清单已存入资料夹') : `<button class="btn pri" data-act="save" data-k="deal">生成授权核对清单</button>`}</div>`)}
  </div>
  ${next(6, '合作谈完，戏也杀青了。最后一站：<b>复盘与下一步</b>')}`;
}

/* ---------------- 第8站：复盘 ---------------- */
function planView() {
  return `<div class="card"><h3>年度目标进度</h3><div class="grid3 mt8">${D.goals.map(g => `<div><b>${g.g}</b><div class="bar mt8"><i style="width:${g.p}%"></i></div><p class="small muted mt8">${g.s}</p></div>`).join('')}</div></div>
    <div class="card"><h3>2027 档期与学习安排</h3>
      <div class="year">${Array.from({ length: 12 }, (_, i) => `<span class="m">${i + 1}月</span>`).join('')}</div>
      ${D.lanes.map(l => `<div class="lane">${l.items.map(([a, b, n, c]) => `<span class="ev ${c}" style="grid-column:${a}/${b + 1};${c === 'empty' ? 'border:1px dashed var(--muted);background:none' : ''}">${l.n} · ${n}</span>`).join('')}</div>`).join('')}</div>
    <div class="card">${aiBlock('plan', 'AI 生成下一阶段行动清单', 'AI 结合这部戏的复盘、年度目标和档期，给出下一阶段的行动建议。最终取舍由本人和团队决定。', () => `
      <div class="result-head"><h3>下一阶段行动清单</h3>${demoTag()}</div>
      ${D.actions.map((a, i) => `<label class="chk"><input type="checkbox" data-act="check" data-i="${i}" ${S.checks[i] ? 'checked' : ''}><span>${a}</span></label>`).join('')}
      <div class="row mt" style="justify-content:space-between"><span class="small muted">AI 提供结构和备选方案，勾选与否由你和团队决定。</span>${has('review') ? tag('ok', '✓ 已存入资料夹') : `<button class="btn pri" data-act="save" data-k="review">存入资料夹</button>`}</div>`)}</div>`;
}
function vReview() {
  const t = tab(7, 'look');
  let body;
  if (t === 'look') body = `<div class="grid2">
    <div class="card"><h3>这部戏留下了什么</h3><p class="sub">自动汇总自资料夹（${S.folder.length} 项）</p>
      <ul class="list mt8">${S.folder.length ? S.folder.map(k => `<li class="row" style="justify-content:space-between"><span><span class="tag">${D.stations[FOLDER[k].st].name}</span> ${FOLDER[k].t}</span><button class="btn sm" data-act="go" data-i="${FOLDER[k].st}">查看</button></li>`).join('') : '<li class="muted small">资料夹还是空的，前面几站走一遍就会出现在这里。</li>'}</ul></div>
    <div><div class="card"><h3>杀青后续 · 别断了跟踪</h3><ul class="list mt8">${D.wrapup.map(([k, t, w, lv]) => `<li class="small row" style="justify-content:space-between"><span>${tag(lv, k)} ${t}</span><span class="muted">${w}</span></li>`).join('')}</ul></div>
    <div class="card"><h3>做得好的</h3><ul class="list mt8">${D.wins.map(w => `<li class="small">✓ ${w}</li>`).join('')}</ul></div>
    <div class="card"><h3>下次可以更好的</h3><ul class="list mt8">${D.improve.map(w => `<li class="small">→ ${w}</li>`).join('')}</ul></div></div></div>`;
  else if (t === 'data') body = aiBlock('airdata', 'AI 汇总播出数据与口碑', '汇总这部戏的播出热度、口碑评分、观众热议和你的粉丝增长，看清观众记住了什么。', () => { const A = D.air, mx = Math.max(...A.heat); return `
    <div class="grid4 kpis">${A.kpi.map(k => `<div class="kpi"><small>${k[0]}</small><b>${k[1]}<em>${k[2]}</em></b><span class="small muted">${k[3]}</span></div>`).join('')}</div>
    <div class="grid2 mt"><div class="card"><div class="result-head"><h3>32 集热度曲线</h3>${demoTag()}</div>
      <svg viewBox="0 0 640 190" class="wxchart"><path class="curve" d="${A.heat.map((v, i) => `${i ? 'L' : 'M'}${30 + i * 18.5},${160 - v / mx * 130}`).join(' ')}"/>${A.marks.map(([e, t]) => `<line x1="${30 + (e - 1) * 18.5}" x2="${30 + (e - 1) * 18.5}" y1="20" y2="160" stroke="var(--line)" stroke-dasharray="4 4"/><text x="${30 + (e - 1) * 18.5}" y="14" text-anchor="middle" font-size="11" class="rel-label">第${e}集 ${t}</text>`).join('')}<text x="30" y="182" font-size="11" class="rel-label">第1集</text><text x="604" y="182" font-size="11" class="rel-label" text-anchor="end">第32集</text></svg></div>
    <div class="card"><h3>观众记住了什么</h3><div class="bars2 mt8">${A.topics.map(([n, v]) => `<div style="grid-template-columns:120px 1fr 40px"><span>${n}</span><i><b style="width:${v}%"></b></i><span>${v}%</span></div>`).join('')}</div>
      <h3 class="mt">口碑关键词</h3><div class="row mt8">${A.words.map((w, i) => `<span class="tag ${i < 4 ? 'ok' : ''}">${w}</span>`).join('')}</div></div></div>`; });
  else if (t === 'self') { S.selfAns = S.selfAns || {}; body = `<div class="grid2"><div class="card"><h3>表演自评</h3><p class="sub">AI 提问，你来回答；写下来的，才是真正留下的</p>
      ${D.selfQ.map((q, i) => `<div class="field"><label>${i + 1}. ${q}</label><textarea data-self="${i}" rows="2" placeholder="写下你的想法…">${esc(S.selfAns[i] || '')}</textarea></div>`).join('')}</div>
    <div><div class="card"><h3>导演与搭档的反馈</h3><ul class="list small mt8">${D.feedback.map(f => `<li><b>${f[0]}</b>：“${f[1]}”</li>`).join('')}</ul></div>
      <div class="card mt">${aiBlock('selfrev', 'AI 总结：带进下一部戏的三件事', '结合你的自评、导演反馈和观众口碑，总结这部戏最值得带走的经验。', () => `<div class="result-head"><h3>带进下一部戏的三件事</h3>${demoTag()}</div><ol class="small" style="padding-left:18px;margin:0">${D.takeaway.map(x => `<li style="margin:6px 0">${x}</li>`).join('')}</ol>
        <div class="row mt">${has('review') ? tag('ok', '✓ 作品复盘已存入资料夹') : `<button class="btn pri" data-act="save" data-k="review">存入资料夹</button>`}</div>`)}</div></div></div>`; }
  return `${hero(D.stations[7])}${tabs(7, [['look', '作品复盘'], ['data', '播出与口碑'], ['self', '表演自评']])}${body}
  <div class="next"><div class="carry">一部戏走完了：<b>资料夹 ${S.folder.length}/${Object.keys(FOLDER).length}</b>。下一部戏，从“接本”重新开始。</div>
  <div class="row"><button class="btn" data-act="go" data-i="6">← 上一站</button><button class="btn pri" data-act="export">导出整部戏资料包</button></div></div>`;
}

/* ---------------- 作品库与发展定位 ---------------- */
function radar2(rows) {
  const n = rows.length, R = 120, cx = 170, cy = 158, pt = (i, r) => [cx + r * Math.sin(i / n * 2 * Math.PI), cy - r * Math.cos(i / n * 2 * Math.PI)];
  const poly = (k) => rows.map((r, i) => pt(i, R * r[k] / 100).join(',')).join(' ');
  return `<svg viewBox="0 0 340 320" class="radar2">${[1, .75, .5, .25].map(f => `<polygon points="${rows.map((_, i) => pt(i, R * f).join(',')).join(' ')}" class="rg"/>`).join('')}
    ${rows.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" class="rg"/>`).join('')}
    <polygon points="${poly(2)}" class="rt"/><polygon points="${poly(1)}" class="rv"/>
    ${rows.map((r, i) => { const [x, y] = pt(i, R + 22); return `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11.5" class="rel-label">${r[0]}</text>`; }).join('')}</svg>`;
}
function vPortfolio() {
  const P = D.portfolio, H = P.heat;
  const genres = {}; P.works.forEach(w => { const g = w[2].split(' · ')[0]; genres[g] = (genres[g] || 0) + 1; });
  const hc = v => `color-mix(in srgb,var(--accent) ${Math.round((v - 40) / 60 * 85)}%,var(--panel2))`;
  return `<section class="hero has-img" style="--img:url('assets/photos/20_award.jpg')"><div class="eyebrow">MY WORKS & DIRECTION</div><h1>作品库与发展规划</h1>
    <p>把演过的每一部戏导进来，和你的年龄、气质、体态、声线放在一起，AI 帮你看清：最适合什么题材、什么角色，下一步往哪走。</p>
    <div class="needs"><span class="need">个人作品库</span><span class="need">自我画像</span><span class="need">多维能力雷达</span><span class="need">题材 × 角色适配</span><span class="need">发展路线</span></div></section>
  ${portfolioCarousel()}<div class="card"><div class="result-head"><div><h3>我的作品时间轴</h3><p class="sub">${P.works.length} 部预置示例 + ${S.userWorks.length} 部自行录入 · CSV表头：作品名,年份,角色,题材,备注</p></div><label class="btn sm" style="cursor:pointer">📥 导入CSV作品<input type="file" id="worksFile" accept=".csv" hidden></label></div>
    <div class="works">${S.userWorks.map(w=>`<div class="wk"><span class="wy">${esc(w.year)}</span><b>《${esc(w.title)}》</b><small>${esc(w.genre)} · ${esc(w.role)}</small><small>${esc(w.note)}</small><span class="tag">自行录入</span></div>`).join('')}${P.works.map(w => `<div class="wk"><span class="wy">${w[0]}</span><b>《${w[1]}》</b><small>${w[2]}</small><small>${w[3]}</small>${w[4] ? `<span class="ws ${w[4] >= 8 ? 'hi' : w[4] < 7 ? 'lo' : ''}">${w[4]}</span>` : '<span class="ws now">拍摄中</span>'}</div>`).join('')}</div>
    <div class="row mt8">${Object.entries(genres).map(([g, c]) => `<span class="tag">${g} × ${c}</span>`).join('')}<span class="small muted">口碑为示例评分</span></div></div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>多维能力与市场雷达 · 预置示例</h3><div class="legend"><span><i style="background:var(--accent)"></i>现在</span><span><i style="background:var(--hi)"></i>3 年目标</span></div></div>${radar2(P.radar)}</div>
    <div class="card"><h3>自我画像</h3><p class="sub">由本人和团队填写，AI 只做参考</p>
      <dl class="kv mt8" style="grid-template-columns:76px 1fr">${P.self.map(s => `<dt>${s[0]}</dt><dd>${s[1]}</dd>`).join('')}</dl>
      <h3 class="mt">题材 × 角色 适配度</h3>
      <table class="heat mt8"><tr><th></th>${H.cols.map(c => `<th>${c}</th>`).join('')}</tr>${H.rows.map((r, i) => `<tr><th>${r}</th>${H.v[i].map(v => `<td style="background:${hc(v)}">${v}</td>`).join('')}</tr>`).join('')}</table></div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>AI 发展建议</h3><p class="sub">结合作品口碑、自我画像和当前邀约</p></div></div>
    ${aiBlock('port', 'AI 综合分析', '读取全部作品的题材、角色和口碑，结合年龄、气质、体态、声线，给出最适合的方向、要谨慎的方向和发展路线。', () => `
      <div class="grid2"><div class="flag ok"><b>✓ 最适合</b>${P.best.map(b => `<p class="small">· ${b}</p>`).join('')}</div><div class="flag warn"><b>! 谨慎</b>${P.careful.map(b => `<p class="small">· ${b}</p>`).join('')}</div></div>
      <div class="roadmap mt">${P.road.map((r, i) => `<div class="rm"><span>${i + 1}</span><b>${r[0]}</b><p class="small">${r[1]}</p></div>`).join('')}</div>
      <p class="note">${demoTag()}　接什么、往哪走，最终由本人和团队决定。导入片单仅更新作品时间轴；雷达与此处建议为预置示例，尚未根据新片单重算。</p>`)}
  </div>
  <div class="section-title mt"><h2>年度规划</h2><p class="small muted">目标、档期与学习安排，下一阶段的行动清单</p></div>
  ${planView()}`;
}

/* ---------------- 危机公关与舆情 ---------------- */
function vCrisis() {
  const C = D.crisis, E = C.event, mx = Math.max(...C.volume);
  const W = 600, H = 170, xs = i => 30 + i * (W - 60) / (C.volume.length - 1), ys = v => 140 - v / mx * 115;
  return `<section class="hero has-img" style="--img:url('assets/photos/27_comments.jpg')"><div class="eyebrow">CRISIS & REPUTATION</div><h1>危机公关与舆情</h1>
    <p>风吹草动，第一时间知道。AI 帮你监测声量、判断性质、比较回应方案、起草声明；先核实，再回应，发不发、怎么发，由人决定。</p>
    <div class="needs"><span class="need">舆情监测</span><span class="need">预警分级</span><span class="need">事件研判</span><span class="need">回应方案</span><span class="need">声明起草</span><span class="need">预案库</span></div></section>
  <div class="grid4 kpis">
    <div class="kpi"><small>当前预警</small><b class="warn-t">${C.level[0]}</b><span class="small muted">1 个事件在扩散</span></div>
    <div class="kpi"><small>今日声量指数</small><b>${C.volume[6]}</b><span class="small warn-t">约为平时的 9 倍</span></div>
    <div class="kpi"><small>负面占比</small><b>${C.mood.neg}<em>%</em></b><div class="bar"><i style="width:${C.mood.neg}%;background:var(--bad)"></i></div></div>
    <div class="kpi"><small>响应团队</small><b>${C.team.length}<em>人在线</em></b><span class="small muted">经纪 · 公关 · 律师 · 安保</span></div>
  </div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>全网声量 · 近 7 天</h3>${tag('demo', '示例数据')}</div>
      <svg viewBox="0 0 ${W} ${H}" class="wxchart"><path d="${C.volume.map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(v)}`).join(' ')} L${xs(6)},140 L${xs(0)},140 Z" fill="color-mix(in srgb,var(--bad) 18%,transparent)"/>
        <path class="curve" style="stroke:var(--bad)" d="${C.volume.map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(v)}`).join(' ')}"/>
        ${C.volume.map((v, i) => `<circle class="pt" style="stroke:var(--bad)" cx="${xs(i)}" cy="${ys(v)}" r="4"/><text x="${xs(i)}" y="160" text-anchor="middle" font-size="11" class="rel-label">${C.days[i]}</text>`).join('')}
        <text x="${xs(5) - 6}" y="${ys(96) - 12}" text-anchor="end" font-size="12" font-weight="600" fill="var(--bad)">传闻出现</text></svg></div>
    <div class="card"><h3>事件时间线 · ${E.t}</h3><p class="sub">${E.type} · ${E.heat}</p>
      <ol class="tl mt8">${E.timeline.map(x => `<li><span class="tm" style="width:76px">${x[0]}</span><i style="background:${x[1] === '待决定' ? 'var(--warn)' : x[1] === '核实' ? 'var(--ok)' : 'var(--bad)'}"></i><span><b>${x[1]}</b>　${x[2]}</span></li>`).join('')}</ol></div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>AI 事件研判与回应方案</h3><p class="sub">先把事情看清楚，再决定怎么说</p></div></div>
    ${aiBlock('crisis', 'AI 研判并起草回应', '判断事件性质与传播趋势、评估对你的影响、比较三种回应方式，并起草一份声明供团队审核。', () => `
      <div class="grid4">${E.judge.map(j => `<div class="leg"><small class="muted">${j[0]}</small><p class="mt8"><b>${j[1]}</b></p></div>`).join('')}</div>
      <h4 class="mt" style="font:600 15px var(--serif)">三种回应方式</h4>
      <div class="grid3 mt8">${E.options.map(o => `<div class="flag ${o[2]}"><b>${o[0]}</b><p class="small">${o[1]}</p>${o[2] === 'ok' ? '<span class="tag ok mt8">AI 推荐</span>' : ''}</div>`).join('')}</div>
      <h4 class="mt" style="font:600 15px var(--serif)">声明草稿</h4><div class="draft mt8">${E.draft}</div>
      <div class="gate">🔒 AI 只起草，不会自动发布。是否回应、用哪种方式、什么时候发，由经纪人和本人在下方「人工复核 · 最终决定」写下结论。</div>`)}
  </div>
  <div class="grid2 mt">
    <div class="card"><h3>危机预案库</h3><p class="sub">常见情况，提前想好怎么做</p>
      ${C.playbook.map(p => `<div class="rule"><span>${p[0]}</span><div><b>${p[1]}</b><p class="small muted">${p[2]}</p></div></div>`).join('')}</div>
    <div><div class="card"><h3>危机响应小组</h3><div class="grid3 mt8">${C.team.map(t => `<div class="leg"><b>${t[0]}</b><p class="small muted">${t[1]}</p></div>`).join('')}</div></div>
      <div class="card mt"><h3>处理原则</h3><ul class="list small mt8">${C.principles.map(p => `<li>✓ ${p}</li>`).join('')}</ul>
        <h3 class="mt">过往事件复盘</h3><ul class="list small mt8">${C.history.map(h => `<li><b>${h[0]}</b> · ${h[1]}<br><span class="muted">${h[2]}</span></li>`).join('')}</ul></div></div>
  </div>`;
}

/* ---------------- 合同与品牌 ---------------- */
function radar(scores) {
  const n = scores.length, R = 70, cx = 90, cy = 88, pt = (i, r) => [cx + r * Math.sin(i / n * 2 * Math.PI), cy - r * Math.cos(i / n * 2 * Math.PI)];
  const ring = f => scores.map((_, i) => pt(i, R * f).join(',')).join(' ');
  return `<svg viewBox="0 0 180 180" class="radar"><polygon points="${ring(1)}" class="rg"/><polygon points="${ring(.66)}" class="rg"/><polygon points="${ring(.33)}" class="rg"/>
    <polygon points="${scores.map((s, i) => pt(i, R * s[1] / 100).join(',')).join(' ')}" class="rv"/>
    ${scores.map((s, i) => { const [x, y] = pt(i, R + 14); return `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="9.5" class="rel-label">${s[0]}</text>`; }).join('')}</svg>`;
}
function vDeals() {
  const X = D.deals, o = X.offers[S.offer || 0];
  const cats = X.brands.map(b => b.cat);
  return `<section class="hero has-img" style="--img:url('assets/photos/14_rights.jpg')"><div class="eyebrow">CONTRACTS & BRANDS</div><h1>合同与品牌</h1>
    <p>合同、证件、作品资料都放在一个地方；正在代言的品牌、交付进度、到期时间一目了然。新的代言找上门，AI 先做背调、给出评估，最后由人决定接不接。</p>
    <div class="needs"><span class="need">资料库</span><span class="need">合同库</span><span class="need">AI 条款审阅</span><span class="need">代言品牌管理</span><span class="need">品牌背调</span><span class="need">该不该接</span></div></section>
  <div class="vault">${X.vault.map(v => `<div class="vt"><span>${v[0]}</span><b>${v[1]}</b><small>${v[2]} 份</small></div>`).join('')}<label class="vt add"><span>📥</span><b>导入资料</b><small>PDF · Word · 图片</small><input type="file" id="rvFile" multiple hidden></label></div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>合同库</h3>${tag('demo', '示例数据')}</div>
      ${X.contracts.map(c => `<div class="ct"><div class="row" style="justify-content:space-between"><span class="row"><span class="tag">${c.type}</span><b>${c.n}</b></span>${tag(c.lv, c.st)}</div><p class="small muted">${c.party} · 到期 ${c.end}</p><div class="row mt8">${c.keys.map(k => `<span class="chipk">${k}</span>`).join('')}</div></div>`).join('')}</div>
    <div class="card"><div class="result-head"><div><h3>AI 条款审阅</h3><p class="sub">${X.draft.n}</p></div></div>
      ${aiBlock('clause', 'AI 审阅合同草案', '逐条读合同：排他范围、内容使用期限、AI 生成条款、违约责任、付款节点，标出对你不利的地方。', () => `${X.draft.flags.map(f => `<div class="flag ${f[0]}"><b>${{ ok: '✓', warn: '!', bad: '✕' }[f[0]]} ${f[1]}</b><p class="small">${f[2]}</p></div>`).join('')}
        <p class="note">${demoTag()}　AI 只标出风险、给出修改方向。合同以律师审核为准。</p>`)}</div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>正在代言的品牌</h3><p class="sub">交付进度、到期提醒、品类占用</p></div><span class="small muted">已占用品类：${cats.join(' · ')}</span></div>
    <div class="grid3">${X.brands.map(b => `<div class="leg"><div class="row" style="justify-content:space-between"><b>${b.n}</b><span class="tag">${b.cat}</span></div><p class="small muted">${b.role} · 到期 ${b.end}</p>
      ${b.dl.map(d => `<div class="dlr"><span>${d[0]}</span><div class="bar"><i style="width:${d[1] / d[2] * 100}%"></i></div><span class="small">${d[1]}/${d[2]}</span></div>`).join('')}
      <div class="row mt8" style="justify-content:space-between"><span class="small ${b.left < 90 ? 'warn-t' : 'muted'}">${b.left < 90 ? '⏰ ' : ''}${b.left} 天后到期</span><span class="small muted">合作评分 ${b.score}</span></div></div>`).join('')}</div></div>
  <div class="card mt"><div class="result-head"><div><h3>新的代言邀约 · 该不该接？</h3><p class="sub">AI 背调 + 评估，最后由人复核决定</p></div>
    <div class="opt" style="margin:0">${X.offers.map((x, i) => `<button data-act="offer" data-i="${i}" class="${(S.offer || 0) === i ? 'on' : ''}">${x.n}</button>`).join('')}</div></div>
    <p class="small muted">${o.cat} · ${o.role} · 报价${o.fee}</p>
    ${aiBlock('offer' + (S.offer || 0), `AI 背调并评估「${o.n}」`, '查工商、司法、产品抽检、舆情、过往代言人、广告合规，再对照你的形象、粉丝构成、现有排他和档期，给出建议。', () => `
      <div class="offer-g"><div>${radar(o.scores)}<div class="verdict ${o.verdict[0]}">${o.verdict[1]}</div></div>
        <div><h4 class="small muted" style="margin-bottom:6px">品牌背调</h4>${o.check.map(c => `<div class="src">${tag(c[0], { ok: '正常', warn: '需核实', bad: '风险' }[c[0]])}<div><b>${c[1]}</b><p class="small muted">${c[2]}</p></div></div>`).join('')}</div></div>
      <p class="note">${demoTag()}　正式版接入企业信用、裁判文书、市场监管抽检和舆情数据，并附原始链接。<b>接不接，请在下方「人工复核 · 最终决定」写下结论。</b></p>`)}
  </div>`;
}

/* ---------------- 行业简报 ---------------- */
function vBrief() {
  return `<section class="hero has-img" style="--img:url('assets/photos/13_press.jpg')"><div class="eyebrow">INDUSTRY BRIEFING</div><h1>行业简报</h1>
    <p>影视、舞蹈、音乐、时尚、AI 内容、行业活动、公益：每周一份，只推和你有关的。每一条都标清来源和核验状态，不把网络传闻当成事实。</p>
    <div class="needs"><span class="need">定向搜集</span><span class="need">分类摘要</span><span class="need">来源核验</span><span class="need">趋势提示</span><span class="need">合作灵感</span></div></section>
  ${aiBlock('brief', 'AI 生成本周行业简报', '围绕七个方向整理公开信息：每一条都标出来源、核验状态、和你有没有关系、建议怎么做。', briefView)}`;
}
function briefView() {
  const B = D.brief2, f = S.bf || '全部', only = !!S.bVerified;
  const items = B.items.filter(x => (f === '全部' || x.f === f) && (!only || x.lv === 'ok'));
  const cnt = k => B.items.filter(x => x.lv === k).length;
  const kw = [...B.keywords, ...(S.bKw || [])];
  return `<div class="card brief-top"><div class="result-head"><div><h3>本周行业简报</h3><p class="sub">${B.week} · 共 ${B.items.length} 条 · 已核验 ${cnt('ok')} · 示例 / 待核验 ${cnt('warn')} · 传闻 ${cnt('bad')}</p></div>${demoTag()}</div>
    <div class="ai-sum">✦ <b>AI 摘要：</b>${B.summary}</div></div>
  <div class="row mt">${['全部', '影视', '舞蹈', '音乐', '时尚', 'AI 内容', '行业活动', '公益'].map(x => `<button class="btn sm ${f === x ? 'pri' : ''}" data-act="bf" data-v="${x}">${x}</button>`).join('')}
    <label class="small muted" style="margin-left:auto;display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-act="bver" ${only ? 'checked' : ''}> 只看已核验</label></div>
  <div class="briefs mt8">${items.map(x => `<div class="bi ${x.lv}"><div class="row" style="justify-content:space-between"><span class="row"><span class="tag">${x.f}</span>${tag(x.lv, x.tag)}</span><span class="rel rel-${x.rel[0]}">相关度 ${x.rel[0]}</span></div>
      <h4>${x.t}</h4><p class="small muted">${x.sum}</p>
      <dl class="kv small mt8" style="grid-template-columns:62px 1fr"><dt>来源</dt><dd>${x.src}</dd><dt>和你有关</dt><dd>${x.rel[1]}</dd><dt>建议动作</dt><dd>${x.act}</dd>${x.idea ? `<dt>合作灵感</dt><dd>💡 ${x.idea}</dd>` : ''}</dl></div>`).join('') || '<p class="muted small">没有符合条件的条目</p>'}</div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>题材热度</h3><span class="small muted">近 3 个月 · 示例</span></div>
      <div class="bars2 mt8">${B.trends.map(([n, v, d]) => `<div style="grid-template-columns:110px 1fr 60px"><span>${n}</span><i><b style="width:${v}%"></b></i><span class="${d === '↑' ? 'ok-t' : d === '↓' ? 'bad-t' : 'muted'}">${d} ${v}</span></div>`).join('')}</div>
      <p class="note">热度为示例数据，正式版接入公开榜单与平台数据，按周更新。</p></div>
    <div class="card"><h3>订阅关键词</h3><p class="sub">只推送和你有关的行业信息</p>
      <div class="row mt8">${kw.map(k => `<span class="tag">#${k}</span>`).join('')}</div>
      <input class="add-item" id="kwIn" placeholder="+ 添加关键词，回车确认" style="margin-top:10px">
      <h3 class="mt">信息来源原则</h3><ul class="list small mt8">${B.rules.map(r => `<li>✓ ${r}</li>`).join('')}</ul></div>
  </div>`;
}

/* ---------------- 粉丝与社群 ---------------- */
function spark(v, c) { const m = Math.max(...v); return `<svg viewBox="0 0 120 36" class="spark"><path d="${v.map((x, i) => `${i ? 'L' : 'M'}${i * 20},${34 - x / m * 30}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/></svg>`; }
function vFans() {
  const F = D.fans, P = Object.fromEntries(F.platforms.map(p => [p.k, p]));
  const pf = S.fanPf || 'all', inbox = F.inbox.filter(m => pf === 'all' || m.p === pf);
  const maxA = Math.max(...F.portrait.age.map(a => a[1]));
  return `<section class="hero has-img" style="--img:url('assets/photos/28_fans.jpg')"><div class="eyebrow">FANS & COMMUNITY</div><h1>粉丝与社群</h1>
    <p>后援会、粉丝团、各个平台的留言，都在一个地方。AI 帮你分类、起草、排内容、提醒风险；怎么回、发什么，由人决定。真诚对待粉丝，也守住边界。</p>
    <div class="needs"><span class="need">平台矩阵</span><span class="need">后援会对接</span><span class="need">全平台留言</span><span class="need">宠粉内容日历</span><span class="need">合规与安全</span><span class="need">粉丝洞察</span></div></section>
  <div class="plats">${F.platforms.map(p => `<div class="plat"><div class="row" style="justify-content:space-between"><span class="pbadge" style="background:${p.c}">${p.n}</span>${spark(p.grow, p.c === '#1d1d1f' ? 'var(--accent)' : p.c)}</div>
    <b class="pf">${p.fans}</b><small class="muted">粉丝 · 互动率 ${p.eng}</small>
    <p class="small mt8"><b>调性：</b>${p.tone}</p><p class="small"><b>最受欢迎：</b>${p.best}</p><p class="small muted">${p.cadence}</p></div>`).join('')}</div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><div><h3>后援会与粉丝团</h3><p class="sub">谁在组织粉丝、规模多大、守不守规矩，一目了然</p></div>${tag('demo', '示例数据')}</div>
      ${F.clubs.map(c => `<div class="club"><div><div class="row"><b>${c.n}</b><span class="tag ${c.lv === 'ok' ? 'ok' : 'bad'}">${c.tag}</span></div><p class="small muted">${c.size} 人 · ${c.lead}</p><p class="small mt8">最近：${c.last}</p></div>
        <div class="score ${c.lv}"><b>${c.score}</b><small>合规分</small></div></div>`).join('')}
      <div class="gate">⚠ AI 提醒：「舞蹈数据站」发起了打榜冲刺，且未签对接规范。建议由对接人私下沟通，引导改成公益应援；不公开点名。</div></div>
    <div class="card"><h3>和粉丝相处的规矩</h3><p class="sub">对接规范，所有后援会签署后执行</p>
      <div class="mt8">${F.rules.map(r => `<div class="rule"><span>${r[0]}</span><div><b>${r[1]}</b><p class="small muted">${r[2]}</p></div></div>`).join('')}</div></div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>全平台留言 · 一个收件箱</h3><p class="sub">微博、抖音、小红书、B站的留言汇在一起，AI 按平台调性起草回复</p></div>
    <div class="opt" style="margin:0"><button data-act="fanpf" data-v="all" class="${pf === 'all' ? 'on' : ''}">全部</button>${F.platforms.map(p => `<button data-act="fanpf" data-v="${p.k}" class="${pf === p.k ? 'on' : ''}">${p.n}</button>`).join('')}</div></div>
    <div class="inbox2">${inbox.map((m, i) => `<div class="msg"><div class="row" style="justify-content:space-between"><span class="row"><span class="pbadge sm" style="background:${P[m.p].c}">${P[m.p].n}</span><b>${m.u}</b></span>${tag(m.lv, m.c)}</div>
      <p class="mt8">${m.t}</p><div class="reply"><small>✦ AI 草稿 · ${P[m.p].tone.split('、')[0]}</small>${esc(S.replyEdits[m.u] ?? m.r)}</div>
      <div class="row mt8">${(S.fanOk || {})[m.u] ? tag('ok', '✓ 已提交审核') : m.lv === 'bad' ? `<button class="btn sm" data-act="fanok" data-v="${m.u}">转安保 / 工作室</button>` : `<button class="btn sm pri" data-act="fanok" data-v="${m.u}">提交审核</button><button class="btn sm" data-act="editreply" data-v="${esc(m.u)}">修改</button>`}</div></div>`).join('')}</div>
    <p class="note">AI 只起草，不自动回复、不自动发布。正式版通过各平台开放接口或工作室账号授权读取留言。</p></div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><div><h3>宠粉内容日历 · 本周</h3><p class="sub">用粉丝真正关心的内容，持续给惊喜</p></div></div>
      ${aiBlock('fanplan', 'AI 生成本周内容排期', '根据各平台的热议话题和粉丝提问，排出一周的内容：每一条都回应一个真实的期待。', () => `<div class="fplan">${F.plan.map(p => `<div class="fp"><b>${p[0]}</b><span class="pbadge sm" style="background:${P[p[1]].c}">${P[p[1]].n}</span><span>${p[2]}</span><small class="muted">${p[3]}</small></div>`).join('')}</div>
        <p class="note">${demoTag()}　内容由宣传团队制作、本人确认后发布。</p>`)}</div>
    <div class="card"><h3>粉丝洞察</h3><p class="sub">谁在喜欢你、他们在聊什么</p>
      <div class="bars2 mt8">${F.portrait.age.map(a => `<div><span>${a[0]}</span><i><b style="width:${a[1] / maxA * 100}%"></b></i><span>${a[1]}%</span></div>`).join('')}</div>
      <p class="small mt"><b>城市 TOP 6：</b>${F.portrait.city.join(' · ')}</p>
      <div class="row mt8">${F.portrait.topics.map((t, i) => `<span class="tag" style="font-size:${13 + (6 - i) * 1.2}px">#${t}</span>`).join('')}</div>
      <div class="gate mt">✦ 18 岁以下粉丝约 6%：相关活动不设置任何消费门槛。</div></div>
  </div>`;
}

/* ---------------- 公益与影响力 ---------------- */
function vCharity() {
  const C = D.charity, P = C.projects;
  const maxM = Math.max(...C.months.map(m => m[1]));
  return `<section class="hero has-img" style="--img:url('assets/photos/22_charity.jpg')"><div class="eyebrow">CHARITY & IMPACT</div><h1>公益与影响力</h1>
    <p>把热爱变成看得见的善意。参与过哪些公益、下一步做什么、机构靠不靠谱、粉丝怎么一起参与，都在这里，透明、可追溯。</p>
    <div class="needs"><span class="need">公益项目</span><span class="need">机构核验</span><span class="need">粉丝公益联动</span><span class="need">公益日历</span><span class="need">年度公益报告</span></div></section>
  <div class="grid4 kpis">${C.kpi.map(k => `<div class="kpi"><small>${k[0]}</small><b>${k[1]}<em>${k[2]}</em></b><span class="small muted">${k[3]}</span></div>`).join('')}</div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>正在参与的公益</h3>${tag('demo', '示例数据')}</div>
      ${P.map(p => `<div class="cproj"><div class="cimg" style="background-image:url('assets/photos/${p.img}.jpg')"></div><div><div class="row" style="justify-content:space-between"><b>${p.n}</b>${tag(p.lv, p.st)}</div>
        <p class="small muted">${p.org} · ${p.role}</p><div class="bar mt8"><i style="width:${p.p}%"></i></div><p class="small mt8">下一步：${p.next}</p></div></div>`).join('')}</div>
    <div>
      <div class="card"><div class="result-head"><h3>公益足迹</h3><span class="small muted">近 12 个月 · 参与次数</span></div>
        <svg viewBox="0 0 600 170" class="wxchart">${C.months.map(([m, v], i) => { const h = v / maxM * 110, x = 20 + i * 48; return `<rect x="${x}" y="${130 - h}" width="28" height="${h}" rx="5" fill="var(--hi)" class="grow" style="animation-delay:${i * 40}ms"/><text x="${x + 14}" y="${124 - h}" text-anchor="middle" font-size="11" class="rel-label">${v || ''}</text><text x="${x + 14}" y="152" text-anchor="middle" font-size="11" class="rel-label">${m}</text>`; }).join('')}</svg></div>
      <div class="card mt"><h3>公益日历</h3><p class="sub">提前规划，不临时起意</p>
        <ul class="list small mt8">${C.days.map(d => `<li class="row" style="justify-content:space-between"><span><b>${d[0]}</b>　${d[1]}</span><span class="muted">${d[2]}</span></li>`).join('')}</ul></div>
    </div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>AI 公益机构核验</h3><p class="sub">合作前先查清楚：登记、资质、财务公开、过往项目、舆情</p></div></div>
    <div class="row" style="flex-wrap:nowrap"><input class="add-item" id="orgIn" style="margin:0;flex:1" placeholder="输入机构名称，例如：某某乡村阅读公益基金会" value="${esc(S.orgQ || '星光乡村阅读公益基金会（示例）')}"><button class="btn pri ai" data-act="run" data-k="orgcheck">AI 核验</button></div>
    <div class="mt" ${S.ran.orgcheck ? '' : 'data-ai="orgcheck"'}>${S.ran.orgcheck ? `<div class="${freshKey === 'orgcheck' ? 'reveal' : ''}"><div class="grid3">${C.check.map(c => `<div class="leg"><div class="row" style="justify-content:space-between"><b>${c[0]}</b>${tag(c[2], c[3])}</div><p class="small muted mt8">${c[1]}</p></div>`).join('')}</div>
      <p class="note">${demoTag()}　正式版会到民政部「慈善中国」平台查询登记信息与年报，并附原始链接。演示中的机构为虚构。最终是否合作，由本人和团队决定。</p></div>` : '<p class="small muted">点击「AI 核验」，逐项检查这家机构。</p>'}</div>
  </div>
  <div class="grid2 mt">
    <div class="card"><h3>粉丝公益联动</h3><p class="sub">把粉丝的心意，引到正规、透明的地方</p>
      <ul class="list small mt8">${C.fanRules.map(r => `<li>✓ ${r}</li>`).join('')}</ul>
      ${aiBlock('fanpost', 'AI 起草倡议文案', '为下一次粉丝公益活动起草一份倡议，发布前需要工作室审核。', () => `<div class="draft">${C.fanPost}</div><div class="gate">🔒 AI 只起草，不会自动发布。以艺人名义发起的公益，需要本人和工作室确认。</div>`)}</div>
    <div class="card"><h3>AI 公益方向建议</h3><p class="sub">从作品、角色和生活里，找到真正有共鸣的方向</p>
      <div class="mt8">${C.match.map(m => `<div class="leg" style="margin-bottom:10px"><b>${m[0]}</b><p class="small muted mt8">${m[1]}</p></div>`).join('')}</div></div>
  </div>`;
}

/* ---------------- 身体与状态 ---------------- */
const KCAL = [['鸡胸', 165, '100克'], ['牛肉', 190, '100克'], ['三文鱼', 208, '100克'], ['虾', 100, '100克'], ['鸡蛋', 70, '个'], ['米饭', 116, '100克'], ['燕麦', 150, '40克'], ['红薯', 90, '100克'], ['玉米', 110, '根'], ['面条', 280, '碗'], ['馒头', 220, '个'], ['西兰花', 35, '100克'], ['沙拉', 120, '份'], ['蔬菜', 40, '份'], ['苹果', 95, '个'], ['香蕉', 105, '根'], ['酸奶', 140, '杯'], ['牛奶', 130, '盒'], ['豆浆', 80, '杯'], ['美式', 10, '杯'], ['拿铁', 190, '杯'], ['奶茶', 350, '杯'], ['蛋白棒', 200, '根'], ['坚果', 160, '小把'], ['火锅', 900, '顿'], ['炸鸡', 600, '份'], ['蛋糕', 350, '块'], ['盒饭', 750, '份'], ['粥', 120, '碗']];
function guessKcal(t) {
  const hit = KCAL.filter(([k]) => t.includes(k));
  const n = +(t.match(/(\d+)/) || [])[1] || 1;
  if (!hit.length) return { k: 300, how: '没有识别到常见食物，按一份约 300 千卡估算' };
  const k = hit.reduce((a, [, v, u]) => a + v * (u === '100克' && n > 20 ? n / 100 : (u !== '100克' && n < 10 ? n : 1)), 0);
  return { k: Math.round(k), how: hit.map(([k, v, u]) => `${k} 约 ${v} 千卡/${u}`).join('，') };
}
function vBody() {
  const B = D.body, today = new Date();
  const meals = [...B.meals, ...(S.meals || [])], intake = meals.reduce((a, m) => a + m.k, 0);
  const burn = B.bmr + B.workouts.reduce((a, w) => a + w.k, 0) + (S.extraBurn || 0);
  const w = B.weights, n = w.length, wNow = w[n - 1], wWeek = w[n - 8];
  const W = 640, H = 210, xs = i => 40 + i * (W - 60) / (n - 1), lo = Math.min(...w, B.target[0]) - .4, hi = Math.max(...w, B.target[1]) + .4, ys = v => 170 - (v - lo) / (hi - lo) * 150;
  const dd = i => { const x = new Date(today); x.setDate(x.getDate() - (n - 1 - i)); return `${x.getMonth() + 1}/${x.getDate()}`; };
  const wk = B.week, maxK = Math.max(...wk.map(d => Math.max(d[1], d[2])));
  const ck = S.check || {};
  return `<section class="hero has-img body-portrait" style="--img:url('assets/login-reference/actor-login-poster-v1.webp')"><div class="eyebrow">BODY & CONDITION</div><h1>身体与状态</h1>
    <p>身材、精力、嗓音、睡眠，都会出现在镜头里。按角色的要求，把每天的体重、饮食、运动和状态记下来，AI 帮你看趋势、给建议。</p>
    <div class="needs"><span class="need">体重趋势</span><span class="need">摄入与消耗</span><span class="need">运动记录</span><span class="need">角色体态</span><span class="need">睡眠与嗓音</span></div></section>
  <div class="gate" style="margin-top:0;margin-bottom:14px">🔒 身体数据保存在当前浏览器；本演示没有账号隔离，使用此浏览器的人可查看。完整备份会包含这些记录。体重和饮食管理请在营养师 / 医生指导下进行，不建议极端节食。</div>
  <div class="grid4 kpis">
    <div class="kpi"><small>今日体重</small><b>${wNow.toFixed(1)}<em>kg</em></b><span class="small ${wNow - wWeek <= 0 ? 'muted' : 'warn-t'}">比 7 天前 ${(wNow - wWeek > 0 ? '+' : '') + (wNow - wWeek).toFixed(1)} kg · 目标 ${B.target[0]}–${B.target[1]}</span></div>
    <div class="kpi"><small>今日摄入</small><b>${intake}<em>千卡</em></b><div class="bar"><i style="width:${Math.min(100, intake / B.goalIn * 100)}%"></i></div><span class="small muted">建议 ${B.goalIn} 千卡左右</span></div>
    <div class="kpi"><small>今日消耗</small><b>${burn}<em>千卡</em></b><span class="small muted">基础代谢 ${B.bmr} + 运动 ${burn - B.bmr}</span></div>
    <div class="kpi"><small>热量差</small><b class="${burn - intake > 700 ? 'warn-t' : ''}">${burn - intake > 0 ? '-' : '+'}${Math.abs(burn - intake)}<em>千卡</em></b><span class="small ${burn - intake > 700 ? 'warn-t' : 'muted'}">${burn - intake > 700 ? '缺口偏大，注意别饿着拍戏' : '在合理范围'}</span></div>
  </div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>体重趋势 · 近 ${n} 天</h3><span class="small muted">阴影是角色目标区间</span></div>
      <svg viewBox="0 0 ${W} ${H}" class="wxchart"><rect x="30" y="${ys(B.target[1])}" width="${W - 40}" height="${ys(B.target[0]) - ys(B.target[1])}" fill="color-mix(in srgb,var(--ok) 18%,transparent)" rx="6"/>
        <path class="curve" d="${w.map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${ys(v)}`).join(' ')}"/>
        ${B.marks.map(([i, t]) => `<line x1="${xs(i)}" x2="${xs(i)}" y1="20" y2="170" stroke="var(--line)" stroke-dasharray="4 4"/><text x="${xs(i)}" y="16" text-anchor="middle" font-size="11" class="rel-label">${t}</text>`).join('')}
        ${w.map((v, i) => i % 15 === 0 || i === n - 1 ? `<circle class="pt" cx="${xs(i)}" cy="${ys(v)}" r="4"/><text x="${xs(i)}" y="${ys(v) - 9}" text-anchor="middle" font-size="11" font-weight="600">${v.toFixed(1)}</text><text x="${xs(i)}" y="196" text-anchor="middle" font-size="11" class="rel-label">${dd(i)}</text>` : '').join('')}
      </svg></div>
    <div class="card"><div class="result-head"><h3>近 7 天 摄入 vs 消耗</h3><div class="legend"><span><i style="background:var(--hi)"></i>摄入</span><span><i style="background:var(--accent)"></i>消耗</span></div></div>
      <svg viewBox="0 0 ${W} ${H}" class="wxchart">${wk.map(([d, a, b], i) => { const x = 50 + i * 82, ha = a / maxK * 150, hb = b / maxK * 150; return `<rect x="${x}" y="${175 - ha}" width="26" height="${ha}" rx="4" fill="var(--hi)" class="grow"/><rect x="${x + 30}" y="${175 - hb}" width="26" height="${hb}" rx="4" fill="var(--accent)" class="grow"/><text x="${x + 28}" y="196" text-anchor="middle" font-size="11" class="rel-label">${d}</text>`; }).join('')}</svg></div>
  </div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>今天吃了什么</h3><span class="small muted">输入食物，AI 估算热量</span></div>
      <ul class="list small">${meals.map(m => `<li class="row" style="justify-content:space-between"><span><span class="tag">${esc(m.t)}</span> ${esc(m.n)}</span><b>${m.k} 千卡</b></li>`).join('')}</ul>
      <div class="row mt8" style="flex-wrap:nowrap"><input class="add-item" id="foodIn" placeholder="例如：一杯拿铁、200 克鸡胸、一个苹果" style="margin:0;flex:1"><button class="btn sm pri" data-act="food">记录</button></div>
      ${S.lastFood ? `<p class="small muted mt8">✦ ${esc(S.lastFood)}</p>` : ''}</div>
    <div class="card"><div class="result-head"><h3>运动记录</h3><span class="small muted">可连接 Apple 健康 / 华为运动健康 / Keep（正式版）</span></div>
      <ul class="list small">${B.workouts.map(x => `<li class="row" style="justify-content:space-between"><span>${x.ic} ${x.n} · ${x.m} 分钟</span><b>${x.k} 千卡</b></li>`).join('')}</ul>
      <h3 class="mt">今天的状态</h3><div class="checks">${[['energy', '精力'], ['mood', '情绪'], ['voice', '嗓音'], ['sleep', '睡眠质量']].map(([k, t]) => `<div class="ckrow"><span>${t}</span><div class="dots5">${[1, 2, 3, 4, 5].map(v => `<button data-act="ck" data-v="${k}" data-i="${v}" class="${(ck[k] || 0) >= v ? 'on' : ''}"></button>`).join('')}</div></div>`).join('')}
        <div class="ckrow"><span>昨晚睡眠</span><b>${B.sleep} 小时</b></div></div></div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>AI 角色体态方案 · 许知夏</h3><p class="sub">根据角色设定（曾是舞团学员）、开机时间和你最近的记录</p></div></div>
    ${aiBlock('bodyplan', 'AI 生成体态方案', '结合角色的形象要求、距离定妆和开机的时间、最近 90 天的体重与运动记录，给出安全的节奏和训练建议。', () => `
      <div class="grid3">${B.plan.map(p => `<div class="leg"><b>${p[0]}</b><ul class="small" style="margin:8px 0 0;padding-left:18px">${p[1].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
      <p class="note">${demoTag()}　AI 只给方向和提醒。具体的饮食和训练计划，请与营养师、体能教练、舞蹈老师一起制定。</p>`)}
  </div>
  ${cycleCard()}
  <div class="card mt"><h3>为角色，还可以准备这些</h3><p class="sub">一切都是为了把戏演好，下一步可以继续扩展</p>
    <div class="grid4 mt8">${B.more.map(m => `<div class="leg"><div style="font-size:22px">${m[0]}</div><b>${m[1]}</b><p class="small muted mt8">${m[2]}</p></div>`).join('')}</div></div>`;
}

/* ---------------- 私密模块：经期记录（可选） ---------------- */
function cycleCard() {
  if (!S.cycleOn) return `<div class="card mt private"><div class="result-head"><div><h3>🔒 私密模块 · 经期记录（可选）</h3><p class="sub">保存在当前浏览器；完整备份包含此记录，Markdown项目资料包不导出经期详情。随时可以关闭并清除。用不用，完全由自己决定。</p></div><button class="btn" data-act="cycle" data-v="on">开启</button></div>
    <p class="small muted">开启后：记录周期和身体感受，AI 会对照日程，提前提醒经期和拍摄、活动、出差重叠的日子。</p></div>`;
  const C = S.cycle, dayMs = 86400000, t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const start = n => new Date(t0.getTime() + n * dayMs);
  const next = C.lastStart + C.len, cycDay = -C.lastStart + 1;
  const days = Array.from({ length: 35 }, (_, i) => i - 7);
  const kind = d => { const r = ((d - C.lastStart) % C.len + C.len) % C.len; if (d >= C.lastStart && d < C.lastStart + C.dur) return 'p'; if (r < C.dur && d >= next) return 'pp'; if (r >= C.len - 3) return 'pms'; return ''; };
  const tripDays = D.trip.days.map(x => x.d);
  const overlap = D.trip.days.filter(x => x.d >= next && x.d < next + C.dur);
  const f = d => `${start(d).getMonth() + 1}/${start(d).getDate()}`;
  const SYM = ['痛经', '疲惫', '浮肿', '情绪低落', '皮肤状态差', '睡不好'];
  const sym = S.sym[new Date().toDateString()] || [];
  return `<div class="card mt private"><div class="result-head"><div><h3>🔒 私密模块 · 经期记录</h3><p class="sub">保存在当前浏览器 · 不进入团队资料包 · 不同步给任何人</p></div><button class="btn sm" data-act="cycle" data-v="off">关闭并清除</button></div>
    <div class="grid4 kpis"><div class="kpi"><small>周期第</small><b>${cycDay}<em>天</em></b></div><div class="kpi"><small>预计下次</small><b>${f(next)}</b><span class="small muted">还有 ${next} 天</span></div><div class="kpi"><small>平均周期</small><b>${C.len}<em>天</em></b></div><div class="kpi"><small>经期时长</small><b>${C.dur}<em>天</em></b></div></div>
    <div class="cyc mt">${days.map(d => `<div class="cd ${kind(d)} ${d === 0 ? 'now' : ''}" title="${f(d)}"><small>${start(d).getDate()}</small>${tripDays.includes(d) ? '<i>✈︎</i>' : ''}</div>`).join('')}</div>
    <div class="legend mt8"><span><i style="background:var(--bad)"></i>经期</span><span><i style="background:color-mix(in srgb,var(--bad) 40%,transparent)"></i>预测经期</span><span><i style="background:color-mix(in srgb,var(--warn) 45%,transparent)"></i>经前期</span><span>✈︎ 出差 / 活动</span></div>
    <div class="row mt"><span class="small muted">今天的感受：</span>${SYM.map(x => `<button class="btn sm ${sym.includes(x) ? 'pri' : ''}" data-act="sym" data-v="${x}">${x}</button>`).join('')}</div>
    ${overlap.length ? `<div class="gate mt">✦ AI 提醒：预计 ${f(next)} 开始经期，和 ${overlap.map(x => `${f(x.d)} ${x.city}「${x.ev.split('（')[0]}」`).join('、')} 重叠。<br>· 造型：避免浅色、紧身的礼服，提前和造型师沟通备选<br>· 随身：暖宝宝、止痛药、替换用品，助理包里多备一份<br>· 安排：活动结束后尽量留出休息时间；是否告诉经纪人调整行程，由你自己决定</div>` : `<p class="small muted mt">接下来的出差和活动与预测经期没有重叠。</p>`}
  </div>`;
}

/* ---------------- 出行与天气 ---------------- */
const WX = { status: 'idle', at: '', data: null };
function loadWX(force) {
  if (WX.status === 'loading' || (WX.status === 'live' && !force)) return;
  const C = D.trip.cities, names = Object.keys(C);
  if (!WX.data && window.WX_SNAPSHOT) { WX.data = window.WX_SNAPSHOT.cities; WX.status = 'snap'; WX.at = window.WX_SNAPSHOT.fetched; }
  const prev = WX.status; WX.status = 'loading';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${names.map(n => C[n][0]).join(',')}&longitude=${names.map(n => C[n][1]).join(',')}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FShanghai&forecast_days=7`;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
  fetch(url, { signal: ctl.signal }).then(r => r.json()).then(j => {
    const arr = Array.isArray(j) ? j : [j]; const data = {};
    names.forEach((n, i) => { data[n] = arr[i].daily; });
    WX.data = data; WX.status = 'live'; WX.at = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }).catch(() => { WX.status = prev === 'live' ? 'live' : WX.data ? 'snap' : 'none'; })
    .finally(() => { clearTimeout(to); if (S.trip) render(true); });
}
const WXC = c => c >= 95 ? ['⛈', '雷雨'] : c >= 80 ? ['🌦', '阵雨'] : c >= 71 ? ['❄️', '雪'] : c >= 61 ? ['🌧', '雨'] : c >= 51 ? ['🌦', '小雨'] : c >= 45 ? ['🌫', '雾'] : c >= 3 ? ['☁️', '阴'] : c >= 1 ? ['⛅', '多云'] : ['☀️', '晴'];
function wxAt(city, d) {
  const x = WX.data && WX.data[city]; if (!x || d >= x.time.length) return null;
  const dt = new Date(x.time[d] + 'T00:00:00');
  return { date: `${dt.getMonth() + 1}/${dt.getDate()}`, wk: '日一二三四五六'[dt.getDay()], max: Math.round(x.temperature_2m_max[d]), min: Math.round(x.temperature_2m_min[d]), rain: x.precipitation_probability_max[d] ?? 0, code: x.weather_code[d] };
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = m => { m = (m + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
function judgeLeg(L) {
  const a = wxAt(L.from, L.d), b = wxAt(L.to, L.d);
  const storm = [a, b].some(w => w && w.code >= 95), wet = [a, b].some(w => w && w.rain >= 60), wetFrom = !!(a && a.rain >= 60);
  const lh = Math.floor(toMin(L.leave) / 60), peak = (lh >= 7 && lh <= 9) || (lh >= 17 && lh <= 19);
  const road = Math.round(D.trip.toHub[L.from] * (peak ? 1.4 : 1) * (wetFrom ? 1.25 : 1));
  const rows = Object.entries(L.opts).map(([mode, o]) => {
    let hrs = o.h + o.hub + (mode === '自驾' ? 0 : road / 60), risk = 'ok', note = '';
    if (mode === '飞机') { if (storm) { risk = 'bad'; note = '雷雨，航班延误 / 取消风险高'; hrs += 1.5; } else if (wet) { risk = 'warn'; note = '降雨，可能延误'; hrs += .5; } else note = '天气良好'; }
    if (mode === '高铁') { note = o.h > 6 ? '车程过长' : '准点率高，可在车上休息、背台词'; if (o.h > 6) risk = 'warn'; }
    if (mode === '自驾') { if (wet) { risk = 'warn'; hrs *= 1.25; note = '雨天路滑、易拥堵'; } else note = '灵活，但长途疲劳'; }
    return { mode, hrs: Math.round(hrs * 10) / 10, risk, note };
  });
  const score = r => r.hrs + (r.risk === 'bad' ? 3 : r.risk === 'warn' ? .6 : 0) - (r.mode === '高铁' && r.hrs < 6 ? .7 : 0);
  const best = rows.slice().sort((x, y) => score(x) - score(y))[0];
  const buffer = best.mode === '飞机' ? 90 : best.mode === '高铁' ? 30 : 0;
  const leaveHome = hhmm(toMin(L.leave) - buffer - (best.mode === '自驾' ? 0 : road));
  const why = [];
  if (best.mode === '高铁') why.push(storm || wet ? '起降地有降雨或雷雨，高铁受天气影响小，更准点' : '距离适中，高铁总耗时不输飞机，还更准点');
  if (best.mode === '飞机') why.push(L.km > 1500 ? '距离远，飞机明显更快' : '飞机总耗时最短');
  if (best.mode === '飞机' && (storm || wet)) why.push('天气有风险：建议改早班机，并预留一班高铁作为备选');
  why.push(`去${best.mode === '飞机' ? '机场' : best.mode === '高铁' ? '车站' : '目的地'}${peak ? '正值高峰' : '非高峰'}${wetFrom ? '、出发地有雨' : ''}，路上约 ${road} 分钟`);
  return { a, b, rows, best, leaveHome, road, why };
}
function wearFor(w, ev) {
  if (!w) return '暂无天气数据';
  const t = [];
  if (w.max >= 26) t.push('轻薄透气，注意防晒'); else if (w.max >= 20) t.push('薄外套 + 单衣'); else if (w.max >= 14) t.push('风衣或针织开衫'); else t.push('大衣 / 薄羽绒');
  if (w.max - w.min >= 8) t.push(`早晚温差 ${w.max - w.min}°，叠穿`);
  if (w.rain >= 60 || w.code >= 61) t.push('带伞，穿防滑防水的鞋');
  if (/户外/.test(ev) && w.rain >= 40) t.push('户外环节：提前和品牌确认雨天方案');
  return t.join('；');
}
function vTrip() {
  const T = D.trip;
  if (WX.status === 'idle') loadWX();
  const days = T.days.map(x => ({ ...x, w: wxAt(x.city, x.d) }));
  const ws = days.map(x => x.w).filter(Boolean);
  const tmin = ws.length ? Math.min(...ws.map(w => w.min)) : 0, tmax = ws.length ? Math.max(...ws.map(w => w.max)) : 0, rainy = ws.filter(w => w.rain >= 60).length;
  const st = { live: ['live', `实时 · Open-Meteo · 更新于 ${WX.at}`], snap: ['', `离线快照 · Open-Meteo ${WX.at} 抓取（当前未联网）`], loading: ['', '正在获取实时天气…'], none: ['', '暂无天气数据'] }[WX.status] || ['', ''];
  const W = 640, H = 214, xs = i => 50 + i * ((W - 90) / (days.length - 1)), ty = v => 150 - (v - (tmin - 3)) / Math.max(1, (tmax + 3) - (tmin - 3)) * 110;
  const chart = ws.length ? `<svg viewBox="0 0 ${W} ${H}" class="wxchart">
    ${days.map((x, i) => x.w ? `<rect x="${xs(i) - 14}" y="${190 - x.w.rain * .35}" width="28" height="${x.w.rain * .35}" rx="4" class="rainbar"/>` : '').join('')}
    <path class="curve" d="${days.map((x, i) => x.w ? `${i ? 'L' : 'M'}${xs(i)},${ty(x.w.max)}` : '').join(' ')}" style="stroke:var(--hi)"/>
    <path class="curve" d="${days.map((x, i) => x.w ? `${i ? 'L' : 'M'}${xs(i)},${ty(x.w.min)}` : '').join(' ')}" style="stroke:var(--accent)"/>
    ${days.map((x, i) => x.w ? `<text x="${xs(i)}" y="${ty(x.w.max) - 10}" text-anchor="middle" font-size="12" font-weight="600">${x.w.max}°</text><text x="${xs(i)}" y="${ty(x.w.min) + 18}" text-anchor="middle" font-size="11" class="rel-label">${x.w.min}°</text><text x="${xs(i)}" y="207" text-anchor="middle" font-size="11" class="rel-label">${x.city} ☂${x.w.rain}%</text>` : '').join('')}
  </svg>` : '<p class="muted small">暂无天气数据</p>';
  const extra = {};
  if (rainy) { extra['艺人助理'] = ['折叠伞 ×6 + 一次性雨衣']; extra['造型'] = ['礼服防水罩、鞋套']; extra['安保'] = ['雨天路线多留 20 分钟']; }
  if (ws.length && tmin <= 10) (extra['艺人助理'] = extra['艺人助理'] || []).push('暖宝宝、薄羽绒（候场用）');
  if (days.some(x => x.city === '北京')) (extra['化妆'] = extra['化妆'] || []).push('保湿喷雾（北京干燥）');
  const team = T.team.map(r => ({ ...r, ai: extra[r.role] || [], add: S.packAdd[r.role] || [] }));
  const all = team.flatMap(r => [...r.items, ...r.ai, ...r.add].map(i => r.role + '|' + i));
  const doneN = all.filter(k => S.pack[k]).length;
  return `<section class="hero has-img" style="--img:url('assets/photos/08_station.jpg')"><div class="eyebrow">TRAVEL & WEATHER</div><h1>出行与天气</h1>
    <p>演员每天在不同城市之间奔波。接入天气预报，AI 帮你判断怎么走、几点出发、穿什么，团队各自带什么也不会落下。</p>
    <div class="needs"><span class="need">实时天气</span><span class="need">交通判断</span><span class="need">穿搭提醒</span><span class="need">团队携带清单</span></div></section>
  <div class="card trip-summary"><div class="result-head"><div><h3>${T.title}</h3><p class="sub">${days.length} 天 · ${[days[0].from, ...days.map(x => x.city)].filter((c, i, a) => c !== a[i - 1]).join(' → ')}</p></div>
    <div class="row weather-actions"><span class="chip weather-status"><span class="led ${st[0]}"></span><span class="weather-status-text">${esc(st[1])}</span></span><button class="btn sm" data-act="wx">↻ 刷新天气</button></div></div>
    <div class="route">${days.map((x, i) => `<div class="rt"><div class="rt-wx">${x.w ? WXC(x.w.code)[0] : '·'}</div><b>${x.city}</b><small>${x.w ? `${x.w.date} 周${x.w.wk}` : 'D+' + x.d}</small><small class="ev">${x.ev.split('（')[0]}</small>${x.w ? `<span class="tag ${x.w.rain >= 60 ? 'warn' : ''}">${x.w.min}–${x.w.max}° · ☂${x.w.rain}%</span>` : ''}</div>${i < days.length - 1 ? `<div class="rt-arrow">${days[i + 1].from ? (T.legs.find(l => l.d === days[i + 1].d) ? '→' : '→') : '·'}</div>` : ''}`).join('')}</div>
  </div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>行程天气</h3><div class="legend"><span><i style="background:var(--hi)"></i>最高温</span><span><i style="background:var(--accent)"></i>最低温</span><span><i style="background:color-mix(in srgb,var(--accent) 35%,transparent)"></i>降雨概率</span></div></div>${chart}</div>
    <div class="card"><h3>出发前要知道</h3><div class="grid2 mt8">
      <div class="kpi"><small>气温范围</small><b>${ws.length ? tmin + '–' + tmax : '-'}<em>°C</em></b></div>
      <div class="kpi"><small>可能下雨</small><b class="${rainy ? 'warn-t' : ''}">${rainy}<em>天</em></b></div></div>
      <ul class="list mt8 small">${days.filter(x => x.w && (x.w.rain >= 60 || x.w.code >= 95)).map(x => `<li>${WXC(x.w.code)[0]} <b>${x.w.date} ${x.city}</b> ${WXC(x.w.code)[1]}，降雨概率 ${x.w.rain}% · ${x.ev.split('（')[0]}</li>`).join('') || `<li class="muted">${ws.length ? '行程期间没有明显降雨' : '暂无天气数据，无法判断'}</li>`}</ul></div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>AI 交通判断</h3><p class="sub">飞机、高铁还是坐车？几点出门？</p></div></div>
    ${aiBlock('legs', 'AI 判断每一段怎么走', '结合起降两地的天气、去机场或车站的路况（高峰、雨天），比较飞机、高铁、自驾的总耗时和延误风险。', () => `<div class="legs">${T.legs.map(L => { const J = judgeLeg(L); return `<div class="leg">
      <div class="row" style="justify-content:space-between"><b>${L.from} → ${L.to}</b><span class="small muted">${J.a ? J.a.date : 'D+' + L.d} · 计划 ${L.leave} 出发</span></div>
      <div class="small muted mt8">${J.a ? `${L.from} ${WXC(J.a.code).join(' ')} ☂${J.a.rain}%` : ''}　→　${J.b ? `${L.to} ${WXC(J.b.code).join(' ')} ☂${J.b.rain}%` : ''}</div>
      <table class="tbl mt8"><tr><th>方式</th><th>门到门</th><th>天气风险</th><th></th></tr>${J.rows.map(r => `<tr class="${r === J.best ? 'best' : ''}"><td><b>${{ 飞机: '✈︎', 高铁: '🚄', 自驾: '🚗' }[r.mode]} ${r.mode}</b></td><td>${r.hrs} 小时</td><td>${tag(r.risk, { ok: '低', warn: '中', bad: '高' }[r.risk])}</td><td class="small muted">${r.note}</td></tr>`).join('')}</table>
      <div class="rec">建议：<b>${J.best.mode}</b>　·　${J.leaveHome} 前出门<ul>${J.why.map(w => `<li>${w}</li>`).join('')}</ul></div></div>`; }).join('')}</div>
      <p class="note">${demoTag()}　天气为${WX.status === 'live' ? '实时预报' : '离线快照'}；路况按城市与时段估算，正式版可接入高德 / 百度地图实时路况和航班动态。最终由团队确认订票。</p>`)}
  </div>
  <div class="card mt"><div class="result-head"><div><h3>每日穿搭提醒</h3><p class="sub">按每天的城市天气和活动着装要求</p></div></div>
    ${aiBlock('wear', 'AI 生成穿搭提醒', '根据每天所在城市的最高最低气温、降雨和当天活动，给出穿什么、随身带什么。', () => `<div class="wear">${days.map(x => `<div class="wd"><div class="row" style="justify-content:space-between"><b>${x.w ? x.w.date + ' 周' + x.w.wk : 'D+' + x.d} · ${x.city}</b><span class="wx-big">${x.w ? WXC(x.w.code)[0] : ''}</span></div>
      <p class="small muted">${x.w ? `${WXC(x.w.code)[1]} ${x.w.min}–${x.w.max}° · 降雨 ${x.w.rain}%` : ''}</p><p class="small mt8"><b>活动：</b>${x.ev}</p><p class="small"><b>着装：</b>${x.dress}</p><p class="small"><b>提醒：</b>${wearFor(x.w, x.ev)}</p></div>`).join('')}</div>`)}
  </div>
  <div class="card mt"><div class="result-head"><div><h3>团队携带清单</h3><p class="sub">每个人负责什么、带齐没有，一目了然；勾选会保存</p></div>
    <div class="row"><span class="small muted">已准备 ${doneN}/${all.length}</span><div class="bar" style="width:140px"><i style="width:${all.length ? doneN / all.length * 100 : 0}%"></i></div><button class="btn sm" data-act="teamlist">导出团队携带清单</button></div></div>
    <div class="team">${team.map(r => { const items = [...r.items.map(i => [i, '']), ...r.ai.map(i => [i, 'ai']), ...r.add.map(i => [i, 'add'])]; const n = items.filter(([i]) => S.pack[r.role + '|' + i]).length; return `<div class="role"><div class="row" style="justify-content:space-between"><b>${r.ic} ${r.role}</b><span class="small muted">${n}/${items.length}</span></div><div class="bar mt8"><i style="width:${n / items.length * 100}%"></i></div>
      <div class="mt8">${items.map(([i, k]) => `<label class="chk small"><input type="checkbox" data-act="pack" data-v="${esc(r.role+'|'+i)}" ${S.pack[r.role + '|' + i] ? 'checked' : ''}><span>${esc(i)}${k === 'ai' ? ' <span class="tag ev">✦ AI 按天气补充</span>' : ''}${k === 'add' ? ' <span class="tag">手动添加</span>' : ''}</span></label>`).join('')}</div>
      <input class="add-item" data-role="${r.role}" placeholder="+ 添加物品，回车确认"></div>`; }).join('')}</div>
  </div>`;
}

/* ---------------- 日程总览 ---------------- */
function schedEvents() {
  const C = D.sched, ev = C.events.map((e, i) => ({ ...e, id: 's' + i })).filter(e => !S.hiddenEv[e.id]);
  (S.userEvents || []).forEach(e => ev.push({ ...e, mine: true }));
  C.invites.forEach(i => { if (S.inv[i.id] === 'yes' && i.day) ev.push({ t: i.t, a: i.day, b: i.day, n: i.n + '（新接）', added: true, id: 'inv-' + i.id }); });
  return ev;
}
function dayInfo() { return ActorStore.scheduleDays(schedEvents(),D.sched.days); }
function donut(parts, total) {
  let off = 0; const R = 54, L = 2 * Math.PI * R;
  return `<svg viewBox="0 0 140 140" class="donut-svg">${parts.map(([c, v]) => { const len = v / total * L; const seg = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${c}" stroke-width="18" stroke-dasharray="${len} ${L - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`; off += len; return seg; }).join('')}
    <text x="70" y="66" text-anchor="middle" font-size="22" font-weight="700">${total}</text><text x="70" y="86" text-anchor="middle" font-size="11" class="rel-label">项·天</text></svg>`;
}
function vHome() {
  const C = D.sched, T = C.types, days = dayInfo();
  const work = days.filter(d => d.work).length, rest = C.days - work, clashes = days.filter(d => d.clash);
  const pending = C.invites.filter(i => !S.inv[i.id]).length;
  const tally = {}; days.forEach(d => d.list.forEach(e => { tally[e.t] = (tally[e.t] || 0) + 1; }));
  const parts = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => [T[k].c, v, k]);
  const total = parts.reduce((a, p) => a + p[1], 0);
  const sel = days[(S.selDay || C.today) - 1];
  const wk = ['一', '二', '三', '四', '五', '六', '日'];
  const yearDays = C.yearDays.slice(); yearDays[C.month - 1] = work;
  const maxY = Math.max(...yearDays);
  return `${experienceWelcome()}${capabilityPreview()}<section class="experience-calendar-heading"><div><div class="eyebrow">OVERVIEW · ${C.year}年${C.month}月 · 示例拍摄期</div><h2>日程总览</h2><p class="small muted">拍摄、宣发、训练放在同一张表。点日期可新增安排，冲突与统计会同步变化。</p></div><button class="btn sm" data-act="exp-calendar">试着新增一条日程 ↘</button></section>
  <div class="grid4 kpis">
    <div class="kpi"><small>本月工作日</small><b>${work}<em>/${C.days}天</em></b><div class="bar"><i style="width:${work / C.days * 100}%"></i></div></div>
    <div class="kpi"><small>休息日</small><b class="${rest < 4 ? 'warn-t' : ''}">${rest}<em>天</em></b><span class="small ${rest < 4 ? 'warn-t' : 'muted'}">${rest < 4 ? '偏少，注意身体' : '正常'}</span></div>
    <div class="kpi"><small>冲突 / 待核时段</small><b class="${clashes.length ? 'bad-t' : ''}">${clashes.length}<em>天</em></b><span class="small muted">${clashes.map(d => C.month + '/' + d.d).join('、') || '无'}</span></div>
    <div class="kpi"><small>待决定邀约</small><b>${pending}<em>项</em></b><span class="small muted">见下方 AI 排期助手</span></div>
  </div>
  <div class="row mt" style="justify-content:flex-end;gap:8px"><span class="small muted">${(S.userEvents || []).length ? `我添加了 ${S.userEvents.length} 项 · ` : ''}示例日程 ${D.sched.events.length - Object.keys(S.hiddenEv).length} 项</span>${Object.keys(S.hiddenEv).length < D.sched.events.length ? '<button class="btn sm" data-act="evclear">清空示例，从零开始</button>' : '<button class="btn sm" data-act="evrestore">恢复示例日程</button>'}</div>
  <div class="home-grid mt8">
    <div class="card"><div class="result-head"><h3>${C.month}月日程 <span class="small muted" style="font-weight:400">点日期查看、添加、勾选</span></h3><div class="legend">${Object.entries(T).map(([k, v]) => `<span><i style="background:${v.c}"></i>${v.n}</span>`).join('')}</div></div>
      <div class="cal-m">${wk.map(w => `<div class="wk">周${w}</div>`).join('')}
      ${'<div></div>'.repeat(C.firstWeekday - 1)}
      ${days.map(d => `<button class="dm ${d.d === C.today ? 'today' : ''} ${d.clash ? 'clash' : ''} ${S.selDay === d.d ? 'sel' : ''}" data-act="day" data-i="${d.d}">
        <span class="dn">${d.d}</span>${d.list.some(e => e.long) ? `<i class="longbar" style="background:${T.shoot.c}"></i>` : ''}
        ${d.list.filter(e => !e.long).slice(0, 2).map(e => `<em class="${S.evDone[e.id] ? 'em-done' : ''}" style="background:${T[e.t].c}">${esc(e.n.split(' · ')[0].split('（')[0])}</em>`).join('')}${d.list.filter(e => !e.long).length > 2 ? `<small class="more">+${d.list.filter(e => !e.long).length - 2}</small>` : ''}
        ${d.clash ? '<b class="cl">冲突</b>' : ''}</button>`).join('')}</div></div>
    <div>
      <div class="card"><div class="result-head"><h3>${C.month}月${sel.d}日${sel.d === C.today ? ' · 当天' : ''}</h3>${sel.clash ? tag('bad', '有冲突') : ''}</div>
        ${sel.d === C.today ? `<ol class="tl tl-check">${C.todayPlan.map(([h, n, t], i) => `<li class="${S.todayDone[i] ? 'done' : ''}"><label><input type="checkbox" data-act="tdone" data-i="${i}" ${S.todayDone[i] ? 'checked' : ''}><span class="tm">${h}</span><i style="background:${T[t].c}"></i><span>${n}</span></label></li>`).join('')}</ol>` : ''}
        <ul class="list evl">${sel.list.filter(e => !(sel.d === C.today && !e.mine && !e.added && e.long)).map(e => `<li class="${S.evDone[e.id] ? 'done' : ''}"><label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-act="evdone" data-v="${e.id}" ${S.evDone[e.id] ? 'checked' : ''}><i class="dot" style="background:${T[e.t].c};margin-top:6px"></i><span style="flex:1"><b>${esc(e.n)}</b>${e.mine ? ' <span class="tag">我添加的</span>' : ''}<br><span class="small muted">${T[e.t].n}${e.a !== e.b ? ` · ${C.month}/${e.a}–${C.month}/${e.b}` : ''}${e.time ? ' · ' + esc(e.time) : ''}${e.note ? ' · ' + e.note.replace(/</g, '&lt;') : ''}</span></span></label>
          <button class="btn sm" data-act="evdel" data-v="${e.id}">${e.mine ? '删除' : '移除'}</button></li>`).join('') || '<li class="muted small">这一天还没有安排。</li>'}</ul>
        <details class="evform" ${sel.list.length ? '' : 'open'}><summary>＋ 在 ${C.month}月${sel.d}日 添加日程</summary>
          <div class="grid2 mt8"><div class="field" style="margin-top:0"><label>内容</label><input id="evN" placeholder="例如：杂志拍摄 · 上海"></div>
            <div class="field" style="margin-top:0"><label>类型</label><select id="evT">${Object.entries(T).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('')}</select></div>
            <div class="field"><label>开始 / 结束（日）</label><div class="row" style="flex-wrap:nowrap"><input id="evA" type="number" min="1" max="${C.days}" value="${sel.d}"><span>—</span><input id="evB" type="number" min="1" max="${C.days}" value="${sel.d}"></div></div>
            <div class="field"><label>时间</label><input id="evTime" placeholder="例如：14:00–18:00"></div></div>
          <div class="field"><label>备注</label><input id="evNote" placeholder="地点、对接人、要带什么…"></div>
          <div class="row mt8" style="justify-content:space-between"><span class="small muted">按时间段检查重叠；未填具体时间的事项按全天占位，提示潜在冲突。休息标记不抵消工作。</span><button class="btn pri" data-act="evadd">添加到日程</button></div></details>
        ${sel.clash ? `<div class="gate">⚠ 这一天拍摄与${sel.list.filter(e => ['film', 'biz', 'promo', 'variety'].includes(e.t)).map(e => T[e.t].n).join('、')}重叠。建议：提前与制片确认调整通告，或改为线上参与。</div>` : ''}</div>
      <div class="card mt"><h3>这个月时间花在哪</h3><div class="row mt8" style="align-items:center;flex-wrap:nowrap">${donut(parts, total)}
        <ul class="list small" style="flex:1">${parts.slice(0, 6).map(([c, v, k]) => `<li class="row" style="justify-content:space-between;padding:4px 0"><span><i class="dot" style="background:${c}"></i>${T[k].n}</span><b>${Math.round(v / total * 100)}%</b></li>`).join('')}</ul></div></div>
    </div>
  </div>
  <div class="grid2 mt">
    <div class="card"><div class="result-head"><h3>${C.year} 年每月工作天数</h3><span class="small muted">本月偏满，下半年留出学习时间</span></div>
      <svg viewBox="0 0 600 190" class="ybars">${yearDays.map((v, i) => { const h = v / maxY * 130, x = 18 + i * 48; return `<rect x="${x}" y="${150 - h}" width="30" height="${h}" rx="5" fill="${i + 1 === C.month ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 55%,transparent)'}" style="animation-delay:${i * 50}ms"/><text x="${x + 15}" y="${144 - h}" text-anchor="middle" font-size="11" class="rel-label">${v}</text><text x="${x + 15}" y="172" text-anchor="middle" font-size="11" class="rel-label">${i + 1}月</text>`; }).join('')}</svg></div>
    <div class="card"><h3>收件箱</h3><p class="sub">一部戏的一生，从这里开始</p>
      <div class="inbox mt pulse"><div class="env">✉️</div><div style="flex:1"><b>${D.scripts.length} 部新剧本待看</b><p class="muted small">${D.scripts.map(x => '《' + x.t + '》').join('、')}</p></div><button class="btn pri" data-act="go" data-i="0">进入第 01 站 →</button></div>
      <div class="inbox mt8"><div class="env">📨</div><div style="flex:1"><b>${C.invites.length} 个新邀约</b><p class="muted small">商演、路演、综艺，见下方排期助手</p></div></div></div>
  </div>
  <div class="card mt"><div class="result-head"><div><h3>AI 排期助手</h3><p class="sub">新邀约进来，先查冲突、算行程，再决定</p></div></div>
    ${aiBlock('sched', 'AI 检查新邀约', `本周收到 ${C.invites.length} 个新邀约。AI 对照本月拍摄、宣发、训练和休息，逐一检查有没有冲突、行程是否过紧。`, () => `
      <div class="grid3">${C.invites.map(i => `<div class="inv"><div class="row" style="justify-content:space-between"><span class="tag" style="background:${T[i.t].c};color:#fff">${T[i.t].n}</span>${tag(i.lv, { ok: '可以接', warn: '需协调', bad: '建议婉拒' }[i.lv])}</div>
        <b class="mt8" style="display:block">${i.n}</b><p class="small muted">${i.d} · ${i.r}</p><p class="small mt8">💡 ${i.s}</p>
        <div class="row mt8">${S.inv[i.id] ? tag(S.inv[i.id] === 'yes' ? 'ok' : '', S.inv[i.id] === 'yes' ? '✓ 已接受，已加入日程' : '已婉拒') + `<button class="btn sm" data-act="inv" data-v="${i.id}" data-i="0">撤回</button>` : `<button class="btn sm pri" data-act="inv" data-v="${i.id}" data-i="1">接受</button><button class="btn sm" data-act="inv" data-v="${i.id}" data-i="2">婉拒</button>`}</div></div>`).join('')}</div>
      <p class="note">${demoTag()}　AI 只给建议。接不接、怎么调，由本人、经纪人和剧组沟通后决定。</p>`)}
  </div>`;
}

const VIEWS = [vTake, vRead, vRole, vPrev, vShoot, vPromo, vDeal, vReview];

/* ---------------- 渲染 ---------------- */
function render(keepScroll) {
  captureDraft();
  document.documentElement.dataset.theme = S.theme;
  document.title = `${name().name} · 演员AI工作台`;
  const m = $('#main'), y = m.scrollTop;
  m.classList.toggle('module-view', ['rourou','guide','lab'].includes(onPage()));
  renderSide(); renderTop(); renderFolder();
  if (['rourou','guide','lab'].includes(onPage())) {
    renderEmbeddedPage(m);
    renderedPage = null;
    return;
  }
  if (onPage()) { m.innerHTML = (S.home?'':experiencePanel()) + VIEWP[onPage()]() + reviewBlock(); const hero=m.querySelector('.hero');if(hero){hero.dataset.illustration=({trip:'life',body:'life',charity:'fans',fans:'fans',deals:'rights',crisis:'fans',portfolio:'script',brief:'script'})[onPage()]||'studio';if(!S.body)hero.setAttribute(S.brief?'data-blinking-dots':'data-rising-lines','');} renderedPage=pageKey();restoreDraft(); if (keepScroll) m.scrollTop = y; return; }
  const tdef = GUIDE[S.st].find(g => g[1]);
  if (tdef) S.seen[S.st + ':' + (S.tab[S.st] || tdef[1])] = true;
  const html = VIEWS[S.st](), cut = html.lastIndexOf('<div class="next">');
  m.innerHTML = experiencePanel() + (cut > 0 ? html.slice(0, cut) + reviewBlock() + html.slice(cut) : html + reviewBlock());
  renderedPage=pageKey();restoreDraft();
  if (keepScroll) m.scrollTop = y;
}
async function go(i) {
  await flushPet();
  captureDraft();
  const pk = Object.keys(PAGES).find(k => PAGES[k] === i);
  if (pk) { if (S[pk]) return; clearTimers(); Object.keys(PAGES).forEach(k => S[k] = k === pk); await save(); render(); $('#main').scrollTop = 0; $('#app').classList.remove('folder-open'); return; }
  i = Math.max(0, Math.min(7, i)); if (i === S.st && !onPage()) return;
  clearTimers(); Object.keys(PAGES).forEach(k => S[k] = false); S.st = i; S.hl = null; await save(); render(); $('#main').scrollTop = 0;
  $('#app').classList.remove('folder-open');
}

/* ---------------- 设置弹窗 ---------------- */
function settings() {
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg"><h2>设置<button data-act="close" aria-label="关闭">×</button></h2>
    ${modelOrbitPreview()}<div class="field"><label>连接 AI 模型</label>
      <div class="provider">${PROVIDERS.map(([k, n, d]) => `<button data-act="prov" data-v="${k}" class="${S.provider === k ? 'on' : ''}">${n}<small>${d}</small></button>`).join('')}</div>
      <p class="small muted mt8">${S.provider === 'demo' ? '当前为演示模式：所有 AI 结果均为预置示例，并在页面上标注“示例结果”。' : `当前选中 ${providerName()}。公开网页可演示；真实调用需在演员自己的电脑启动本机服务，密钥只在本次页面内存中保存。`}</p><button class="btn sm" data-act="aiconnect">配置 / 测试自己的连接</button></div>
    <div class="field"><label>主题</label><div class="opt">${[['tide', '深蓝潮汐'], ['butter', '奶油便签'], ['moss', '山野片场']].map(([k, n]) => `<button data-act="theme" data-v="${k}" class="${S.theme === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div class="field"><label>数据归档与备份</label>
      <div class="row"><button class="btn sm" data-act="backup">💾 导出完整备份</button><label class="btn sm" style="cursor:pointer">📥 导入备份<input type="file" id="bkFile" accept=".json" hidden></label><button class="btn sm" data-act="archive">🗄 归档这部戏</button></div>
      ${S.archives.length ? `<ul class="list small mt8">${S.archives.map((a,i) => `<li>🗄 ${esc(a.title)} · ${esc(a.at)} · 资料夹 ${a.folder} 项 · 人工决定 ${a.reviews} 条 <button class="btn sm" data-act="archiveview" data-i="${i}">查看</button><button class="btn sm" data-act="archiveexport" data-i="${i}">导出</button><button class="btn sm" data-act="archiverestore" data-i="${i}">恢复</button></li>`).join('')}</ul>` : '<p class="small muted">还没有归档记录。</p>'}</div>
    <div class="field"><label>演示操作</label><p class="small">键盘 <span class="kbd">←</span> <span class="kbd">→</span> 切换上一站 / 下一站；“重新演示”清空进度，回到日程总览首页。</p>
      <div class="row mt8"><button class="btn sm" data-act="reset">↺ 重新演示</button></div></div>
    <p class="note">本演示所有项目、人物、留言、品牌均为虚构，仅用于展示工作流程，不代表任何真实演员的经历、使用或背书。数据只保存在当前浏览器。</p></div>`;
  if (!dlg.open) dlg.showModal();
}

/* ---------------- 导出 ---------------- */
function exportMd() {
  const P = D.project, L = [];
  L.push(`# 《${P.title}》资料包`, '', `${name().name} · 演员AI工作台 演示导出 · ${new Date().toLocaleString('zh-CN')}`, '', '> 演示版：AI 结果为预置示例，项目与人物均为虚构。', '');
  if (has('take')) L.push('## 01 接戏评估卡', D.take.summary, '', ...D.take.fit.map(f => `- ${f.k}：${f.v}（${f.t}）`), '');
  if (has('read')) L.push('## 02 角色分析卡', '### 人物关系', ...D.people.slice(1).map(p => `- ${p.name}：${p.edge}`), '### 成长线', ...D.growth.map(g => `- 第${g.sc}场 ${g.label}：${g.note}`), '### 第12场潜台词', ...D.subtext.map(s => `- ${s.who}：「${s.line}」→ ${s.sub}（推断）`), '### 重点场次', ...D.keyScenes.map(k => `- 第${k.sc}场 ${k.w}：${k.why}`), '### 人物小传（草稿）', ...(S.bioEdits.main ? S.bioEdits.main.split('\n') : D.bio), '### 角色分析卡', D.roleCard.oneLine, ...D.roleCard.basic.map(b => `- ${b[0]}：${b[1]}`), ...D.roleCard.timeline.map(x => `- ${x[0]}：${x[1]}`), ...D.roleCard.core.map(c => `- ${c[0]}：${c[1]}`), ...D.roleCard.surface.map(c => `- ${c[0]}：${c[1]}`), '');
  if (has('line')) L.push('## 02 台词建议稿', `- 原句（保留）：${D.lineOpt.original}`, `- 建议：${S.adopt !== null ? D.lineOpt.options[S.adopt].t : '未采用'}（待导演确认）`, '');
  if (has('role')) {const h=D.handlings.find(h=>h.id===S.handling);L.push(`## 03 第12场表演方案 · ${handlingName()}`,`- 选定演法节奏：${h.rhythm}`,`- 视线：${h.eye}`,`- 身体：${h.body}`,`- 处理风险：${h.risk}`, ...D.beats.map((b, i) => `- 节拍${i + 1} ${b.t}｜目标：${b.goal}｜阻碍：${b.obs}｜动作：${b.act}`), '');}
  if (has('dance')) L.push('## 03 第21场舞蹈拆解', `主题：${D.dance.theme}`, `音乐：${D.dance.music}`, ...D.dance.segs.map(s => `- ${s.n}（${s.beats}×8拍）情绪：${s.emo}；动作：${s.move}`), ...D.dance.log.map(l => `- ${l.d}：${l.t}｜观察问题：${l.q}`), '');
  if (has('prev')) L.push('## 04 造型与分镜', ...D.looks.map(l => `- ${l.sc}：${l.k}（${l.mood}）`), ...D.shots.map(s => `- 镜头${s.no} ${s.size} ${s.dur}秒｜${s.cam}｜${s.act}${s.line ? '｜' + s.line : ''}`), '');
  if (has('comic')) L.push('## 04 动态漫剧预演',`第12场 · ${handlingName()}版 · ${D.shots.length}个预置示意镜头 · ${D.shots.reduce((a,s)=>a+s.dur,0)}秒`,'已在工作台播放过分镜节奏预览。本文件只包含镜头说明，不包含视频文件；三种演法共用预置画面。','');
  if (has('shoot')) L.push('## 05 任务看板', ...S.tasks.map(x => `- [${x.col === 2 ? 'x' : ' '}] ${x.t}（${x.who} · ${x.due}）${x.sourceText?'\n  原话：'+x.sourceText:''}`), '');
  if (has('promo')) L.push('## 06 粉丝反馈周报', ...D.report.topics.map(([n, v]) => `- ${n}：${v}%`), ...D.report.actions.map(a => `- 建议：${a}`), '');
  L.push(...DemoExperience.replyReport(S,D));
  if (has('deal')) L.push(`## 07 授权核对清单 · ${D.offer.brand}`, `用途：${D.scopes[S.scope].n}`, ...D.dims.map(d => `- ${d.n}（${D.lvText[D.scopes[S.scope].lv[d.id]]}）：${d.q.join(' / ')}`), '', '> 仅作知识提示，以律师审核为准。', '');
  if (has('review')) L.push('## 08 作品复盘报告', ...D.air.kpi.map(k => `- ${k[0]}：${k[1]}${k[2]}（${k[3]}）`), '### 观众记住了什么', ...D.air.topics.map(([n, v]) => `- ${n}：${v}%`), '### 表演自评', ...D.selfQ.map((q, i) => `- ${q}\n  ${(S.selfAns || {})[i] || '（未填写）'}`), '### 带进下一部戏的三件事', ...D.takeaway.map(t => `- ${t}`), '');
  const rv = Object.entries(S.reviews).filter(([, l]) => l.length);
  if (rv.length) { L.push('## 人工复核 · 最终决定'); rv.forEach(([k, l]) => { L.push(`### ${PAGE_NAME(k)}`); l.forEach(r => L.push(`- ${r.at} ${r.who}（${(STATUS.find(x => x[0] === r.status) || STATUS[3])[1]}）：${r.text.replace(/\n/g, ' ')}`)); }); L.push(''); }
  L.push('## 项目主创资料',...Object.entries(S.projectInfo).map(([k,v])=>k+'：'+v),'## 回复修改草稿',...Object.entries(S.replyEdits).map(([k,v])=>k+'：'+v),'## 自行录入作品',...S.userWorks.map(w=>w.year+' 《'+w.title+'》 '+w.role+' '+w.genre));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([L.join('\n')], { type: 'text/markdown' }));
  a.download = `《${P.title}》资料包.md`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('已导出资料包（Markdown）');
}

// The recipient owns the account. Credentials are intentionally never persisted or backed up.
let aiConnection={model:'',apiKey:'',baseUrl:''},aiConnected=false,aiTask='自由分析',aiBusy=false,aiText='';
function isPublicDemo() {
 return !['localhost','127.0.0.1','[::1]','::1'].includes(location.hostname);
}
function deploymentDialog() {
 const dlg=$('#dlg');
 dlg.innerHTML=`<div class="dlg deployment-info"><h2>实战版怎么使用<button data-act="close" aria-label="关闭">×</button></h2><p class="mt8">当前是演示版，可体验主线、业务资料实验室和肉肉模块。</p>${modelOrbitPreview()}<div class="note mt"><b>在演员自己的电脑上</b><p>启动本机实战版，使用自己的账号保存资料、连接模型。</p></div><div class="note mt"><b>团队跨设备使用</b><p>需要云服务器或支持后台的全栈托管，并配置持久存储与 HTTPS。</p></div><div class="row mt"><a class="btn" href="https://github.com/zurenze1/xilixiwai-actor-workbench/blob/main/README.md" target="_blank" rel="noopener">查看源码与启动说明 ↗</a><a class="btn" href="https://github.com/zurenze1/xilixiwai-actor-workbench/blob/main/practical/docs/部署与演员交接.md" target="_blank" rel="noopener">查看部署与交接文档 ↗</a></div><p class="small muted mt">此演示入口不接收密码或模型密钥。</p></div>`;
 if(!dlg.open)dlg.showModal();
}
function aiDialog(task) {
 if(isPublicDemo()){deploymentDialog();return;}
 if(location.pathname.startsWith('/demo/')){
  if(task)aiTask=task;
  const dlg=$('#dlg'),source=aiText||((S.files[pageKey()]||[]).filter(f=>f.text).map(f=>f.text).join('\n\n')).slice(0,150000);
  const prompt='任务：'+aiTask+'\n'+source;
  dlg.innerHTML=`<div class="dlg"><h2>独立演示入口<button data-act="close" aria-label="关闭">×</button></h2><p>这里用于体验预置示例。真实资料与模型连接，请进入实战版，在自己的账号下配置。</p><p class="mt"><a class="btn pri" href="/practical/#settings" target="_blank" rel="noopener">进入实战版配置模型 ↗</a></p><div class="field mt"><label for="demoAiPrompt">本次资料提示词（可复制）</label><textarea id="demoAiPrompt" rows="8" readonly>${esc(prompt)}</textarea></div><button class="btn" data-act="aipromptcopy">复制本次资料提示词</button><p class="small muted mt8">资料不会由此演示入口发送至模型；复制后可在实战版按需使用。</p></div>`;
  if(!dlg.open)dlg.showModal();return;
 }
 if(S.provider==='demo'){toast('先在设置里选择要连接的模型服务');return;}
 if(task)aiTask=task;const dlg=$('#dlg');const cli=['codex','claudecode'].includes(S.provider);
 const source=aiText||((S.files[pageKey()]||[]).filter(f=>f.text).map(f=>f.text).join('\n\n')).slice(0,150000);
 dlg.innerHTML=`<div class="dlg"><h2>连接自己的模型<button data-act="close">×</button></h2><p>${esc(providerName())} · 仅本次页面内存保留连接信息</p><p class="note">公开演示网页不接收密钥。在本人电脑执行 npm install 与 npm start，打开本机地址后才能调用。Codex / Claude Code另需 --local-tools，由本人安装并登录。</p>
 <div class="field"><label>模型 ID（API必填，本机工具可留空）</label><input id="aiModel" value="${esc(aiConnection.model)}" autocomplete="off"></div>
 ${cli?'':`<div class="field"><label>本人 API Key（刷新后清除）</label><input type="password" id="aiKey" value="${esc(aiConnection.apiKey)}" autocomplete="off"></div>`}
 ${S.provider==='compatible'?`<div class="field"><label>公开HTTPS服务地址（含API前缀，如 /v1）</label><input id="aiBase" value="${esc(aiConnection.baseUrl)}"></div>`:''}
 <div class="row mt8"><button class="btn" data-act="aitest">测试连接</button><span id="aiStatus">尚未测试</span></div>
 <div class="field"><label>发送给模型的资料（${esc(aiTask)}）</label><textarea id="aiSource" style="min-height:180px" placeholder="粘贴剧本、留言或需要分析的资料。此处内容会发送给所选服务。">${esc(source)}</textarea></div>
 <p class="small">只发送此框资料，不上传附件原件。请确认有权向所选模型提供这些资料。</p><button class="btn pri" data-act="aicall">发送资料并分析</button><pre id="aiResult" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><div class="row"><button class="btn sm" data-act="airesult">导出结果</button><button class="btn sm" data-act="aisave">保存为待复核记录</button></div></div>`;
 if(!dlg.open)dlg.showModal();
}
async function callModel(test) {
 if(isPublicDemo()){deploymentDialog();return;}
 if(location.pathname.startsWith('/demo/')){aiDialog();return;}
 if(aiBusy)return;const status=$('#aiStatus');
 if(!['localhost','127.0.0.1'].includes(location.hostname)){status.textContent='此处是公开演示页。请下载源码，在自己的电脑运行 npm start 后连接。';return;}
 const provider={claude:'anthropic',claudecode:'claude-code'}[S.provider]||S.provider;
 aiConnection={provider,model:$('#aiModel').value.trim(),apiKey:$('#aiKey')?.value||'',baseUrl:$('#aiBase')?.value||''};
 aiText=$('#aiSource').value;
 if(!test&&!aiText.trim())throw Error('先填写需要分析的资料');
 aiBusy=true;status.textContent=test?'正在测试…':'正在分析…';
 try {
  const response=await fetch(test?'/api/test':'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connection:aiConnection,prompt:'任务：'+aiTask+'\n'+aiText}),signal:AbortSignal.timeout(125000)});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('本机模型服务未启动。请使用 npm start 启动应用');
  const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'连接失败');
  aiConnected=true;status.textContent=test?'连接测试通过':'分析完成 · '+data.model; if(!test)$('#aiResult').textContent=data.text;renderTop();
 }catch(e){aiConnected=false;status.textContent='未完成：'+e.message;}finally{aiBusy=false;}
}

function projectInfoView() {
 const f=S.projectInfo;return `<details class="card mt project-details" ${S.experience.active?'':'open'}><summary>项目资料 · 导演与制作团队 <span class="small muted">${Object.values(f).some(Boolean)?'已有保存资料 · 可继续修改':'可编辑 · 可先填入虚构资料体验'}</span></summary><p class="sub mt8">按已有资料填写，未确认的内容可留空。展开示例分析不会重算这些资料。</p><div class="row mt8"><button class="btn sm" data-act="project-example">填入一份虚构团队资料</button></div>${[['director','导演'],['producer','出品 / 制作公司'],['team','主创与制作团队'],['notes','补充资料 / 来源链接']].map(([k,n])=>`<div class="field"><label for="project-${k}">${n}</label><input id="project-${k}" value="${esc(f[k])}"></div>`).join('')}<button class="btn pri" data-act="saveproject">保存项目资料</button></details>`;
}
function taskEditor(i=-1){
 const x=S.tasks[i]||{t:'',who:'',due:'',col:0},dlg=$('#dlg');
 dlg.innerHTML=`<div class="dlg"><h2>${i<0?'新增自己的任务':'编辑任务'}<button data-act="close" aria-label="关闭">×</button></h2><p class="small muted mt8">保存后进入当前任务看板；可以继续推进、修改，文字导出和完整备份都会保留。</p><div class="field"><label for="taskTitle">要做什么 *</label><input id="taskTitle" maxlength="500" value="${esc(x.t)}" placeholder="例如：与导演确认第12场停顿"></div><div class="grid2"><div class="field"><label for="taskOwner">负责人 *</label><input id="taskOwner" maxlength="100" value="${esc(x.who)}" placeholder="例如：经纪人小周"></div><div class="field"><label for="taskDue">截止时间 *</label><input id="taskDue" maxlength="100" value="${esc(x.due)}" placeholder="例如：10月25日 18:00"></div></div><div class="field"><label for="taskCol">状态</label><select id="taskCol">${['待办','进行中','已完成'].map((s,n)=>`<option value="${n}" ${n===x.col?'selected':''}>${s}</option>`).join('')}</select></div><p id="taskError" role="alert" class="small bad-t"></p><div class="row mt"><button class="btn pri" data-act="task-save" data-i="${i}">保存任务</button><button class="btn" data-act="close">取消</button></div></div>`;if(!dlg.open)dlg.showModal();$('#taskTitle').focus();
}
function editor(kind,key,text) {
 const dlg=$('#dlg');dlg.innerHTML=`<div class="dlg"><h2>${kind==='bio'?'人物小传':'回复草稿'}<button data-act="close">×</button></h2><textarea id="editText" style="min-height:280px;width:100%">${esc(text)}</textarea><div class="row mt8"><button class="btn pri" data-act="saveedit" data-kind="${kind}" data-v="${esc(key)}">保存修改</button><button class="btn" data-act="exportedit">导出当前草稿</button></div></div>`;if(!dlg.open)dlg.showModal();
}
async function importWorks(file) {
 const result=Papa.parse(await file.text(),{header:true,skipEmptyLines:true,transformHeader:h=>h.trim().replace(/^\uFEFF/,'')});
 if(result.errors.length||!result.meta.fields.includes('作品名'))throw Error('CSV需要作品名列；建议表头：作品名,年份,角色,题材,备注');
 const works=result.data.map(r=>({title:String(r['作品名']||'').trim(),year:String(r['年份']||''),role:String(r['角色']||''),genre:String(r['题材']||''),note:String(r['备注']||'')}));
 if(works.some(w=>!w.title)||works.length>500)throw Error('作品名不能为空，一次最多500行');
 const original=await ActorStore.putFile(file);S.userWorks.push(...works);(S.files.portfolio??=[]).push({name:file.name,size:file.size+' B',at:stamp(),file:original});await save();render(true);toast('已导入'+works.length+'部作品，预置雷达不会冒充重新分析');
}

/* ---------------- 事件 ---------------- */
const handle = fn => e => Promise.resolve(fn(e)).catch(showError);
let actionBusy=false;
const handleAction=fn=>handle(async e=>{if(e.target.closest?.('[data-act="switch-practical"]'))e.preventDefault();if(actionBusy)return;actionBusy=true;document.body.dataset.busy='1';try{await fn(e);}finally{actionBusy=false;delete document.body.dataset.busy;}});
document.addEventListener('click', handleAction(async e => {
  const el = e.target.closest('[data-act]');
  if (el?.dataset.act === 'journey-toggle') { toggleJourney(); return; }
  captureDraft();
  if (!el) return;
  const a = el.dataset.act, v = el.dataset.v, i = +el.dataset.i;
  switch (a) {
    case 'capabilities': capabilityDialog();break;
    case 'cap-open': {const cap=DemoExperience.capabilities[i];if(cap?.page!==null&&cap){$('#dlg').close();if(cap.name==='舞蹈训练')S.tab[2]='dance';await go(cap.page);render();}break;}
    case 'lab-open': await openLab(v);break;
    case 'visions': visionsDialog();break;
    case 'vision-open': visionsDialog(v);break;
    case 'vision-choice': {const vision=DemoExperience.visions.find(x=>x.id===el.dataset.kind);if(vision?.choices[i]){S.visionPreferences[vision.id]=vision.choices[i];await save();visionsDialog(vision.id);}break;}
    case 'vision-export': {const vision=DemoExperience.visions.find(x=>x.id===v);if(vision){download(vision.title+'-规划预览.md',['# '+vision.title,'','> 规划预览，尚未接入。本文不是已完成的生成或监测结果。','','选择：'+(S.visionPreferences[v]||vision.choices[0]),...vision.steps.map((s,i)=>`${i+1}. ${s}`),'',vision.result].join('\n'),'text/markdown');toast('已导出功能设想，注明尚未接入');}break;}
    case 'project-example': {
      const sample={director:'陈望（虚构导演）',producer:'青石影业（虚构公司）',team:'制片：方禾；摄影：林远；造型：周晴（均为虚构）',notes:'课堂体验资料；导演风格、履约与来源仍待人工核对。'};
      for(const [key,value]of Object.entries(sample))if(!$('#project-'+key).value.trim())$('#project-'+key).value=value;
      captureDraft();await save();toast('仅填入空字段，确认或修改后点击“保存项目资料”');break;
    }
    case 'look-mode': lookPreviewMode=v==='compare'?'compare':'reveal';render(true);break;
    case 'task-extract': taskExtractionDialog();break;
    case 'task-extract-save': {
      const selected=[...document.querySelectorAll('[data-extraction-row]')].filter(r=>r.querySelector('[data-extraction-select]').checked).map(r=>({...extractionRows[+r.dataset.extractionRow],t:r.querySelector('[data-extraction-title]').value.trim(),who:r.querySelector('[data-extraction-owner]').value.trim(),due:r.querySelector('[data-extraction-due]').value.trim()}));
      const error=$('#extractError');if(!selected.length){error.textContent='至少选择一件事。';break;}
      if(selected.some(r=>!r.t||!r.who||!r.due||r.t.length>500||r.who.length>100||r.due.length>100)){error.textContent='请补齐事项、负责人和截止时间；尚未确定时可以写“待确认”。';break;}
      const keys=new Set(S.tasks.map(x=>[x.t,x.who,x.due].join('\u0000'))),added=selected.filter(x=>{const key=[x.t,x.who,x.due].join('\u0000');if(keys.has(key))return false;keys.add(key);return true;});
      if(!added.length){error.textContent='所选任务已在看板，无需重复加入。';break;}
      const previous=S.tasks,ran=S.ran.tasks;S.tasks=[...S.tasks,...added];S.ran.tasks=true;try{await save();}catch(e){S.tasks=previous;S.ran.tasks=ran;error.textContent='未保存：'+e.message;break;}
      $('#dlg').close();render(true);toast('已新增'+added.length+'项任务，原有任务保留');break;
    }
    case 'task-new': taskEditor();break;
    case 'task-edit': taskEditor(i);break;
    case 'task-save': {
      const task={t:$('#taskTitle').value.trim(),who:$('#taskOwner').value.trim(),due:$('#taskDue').value.trim(),col:+$('#taskCol').value};
      if(!task.t||!task.who||!task.due){$('#taskError').textContent='请补齐任务内容、负责人和截止时间。';break;}
      if(i<0)S.tasks.push(task);else S.tasks[i]={...S.tasks[i],...task};
      await save();$('#dlg').close();render(true);toast('任务已保存，可以继续编辑和推进');break;
    }
    case 'exp-home': await go(-1);$('#main').scrollTop=0;break;
    case 'exp-resume': await positionExperience(S.experience.active?S.experience.step:Math.max(0,experienceStatus().findIndex(m=>!m.done)));break;
    case 'exp-open': case 'exp-result-open': if($('#dlg').open)$('#dlg').close();await positionExperience(i);break;
    case 'exp-locate': await positionExperience(S.experience.step,el.dataset.check===undefined?undefined:+el.dataset.check,true);break;
    case 'exp-next': if(experienceStatus()[S.experience.step].done){if(S.experience.step===7)experienceResults();else await positionExperience(S.experience.step+1);}break;
    case 'exp-pause': S.experience.active=false;await save();render(true);toast('已收起引导，操作进度保留；顶部可继续体验');break;
    case 'exp-results': experienceResults();break;
    case 'exp-export': await flushPet();await save();download('逆光来信-我的体验成果单.md',DemoExperience.report(S,D),'text/markdown');toast('已导出你实际保存的选择与批注');break;
    case 'exp-example': {
      const step=S.experience.step;await positionExperience(step);
      const field=$('#rvText');if(field&&!field.value.trim()){field.value=step===1?'体验示例，可改：第12场许知夏还不知道寄信人是谁。我倾向把这句理解为守住自己的表达节奏，现场再与导演确认。':'体验示例，可改：先核对用途、期限和声音使用范围；尚未确认前不授权，交团队与律师继续审核。';captureDraft();await save();}
      field?.scrollIntoView({block:'center'});field?.focus();break;
    }
    case 'exp-calendar': $('#evN')?.scrollIntoView({behavior:'smooth',block:'center'});$('#evN')?.focus();break;
    case 'switch-practical': if(location.pathname.startsWith('/demo/')){await flushPet();await save();location.assign('/practical/?theme='+encodeURIComponent(S.theme)+'#today');}break;
    case 'go': if (el.dataset.tab) { S.tab[i] = el.dataset.tab; await save(); } await go(i); if (el.dataset.tab) render(); break;
    case 'tab': clearTimers(); S.tab[el.dataset.st] = v; await save(); render(true); break;
    case 'run': runAI(el.dataset.k); break;
    case 'save': await addFolder(el.dataset.k); break;
    case 'toast': toast(el.dataset.msg); break;
    case 'saveproject': for(const k of Object.keys(S.projectInfo))S.projectInfo[k]=$('#project-'+k).value.trim();await save();toast('项目资料已保存');break;
    case 'editbio': editor('bio','main',S.bioEdits.main||D.bio.join('\n\n'));break;
    case 'editreply': {const m=D.fans.inbox.find(m=>m.u===v);editor('reply',v,S.replyEdits[v]??m?.r??'');break;}
    case 'saveedit': if(el.dataset.kind==='bio')S.bioEdits[v]=$('#editText').value;else S.replyEdits[v]=$('#editText').value;await save();$('#dlg').close();render(true);toast('修改已保存');break;
    case 'exportedit': download('编辑草稿.txt',$('#editText').value,'text/plain');break;
    case 'teamlist': {const team=D.trip.team||[];const lines=['# 团队携带清单（待人工发送）',...team.flatMap(r=>['## '+r.role,...[...(r.items||[]),...(r.ai||[]),...(S.packAdd[r.role]||[])].map(item=>'- ['+(S.pack[r.role+'|'+item]?'x':' ')+'] '+item)])];download('团队携带清单.md',lines.join('\n'),'text/markdown');toast('已下载清单，可自行审核后发送');break;}
    case 'directorquestions': download('给导演的问题清单.md','# 围读沟通问题\n\n'+D.take.questions.map(x=>'- '+x).join('\n'),'text/markdown');break;
    case 'theme': await flushPet();S.theme = v; localStorage.setItem('xilixiwai.theme.v2',v); await save(); render(true); if ($('#dlg').open) settings(); break;
    case 'deployment-info': deploymentDialog(); break;
    case 'settings': settings(); break;
    case 'aiconnect': aiDialog();break;
    case 'aipromptcopy': {
      const field=$('#demoAiPrompt');if(!field)break;
      try { if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(field.value);toast('本次资料提示词已复制'); }
      catch { field.focus();field.select();toast('已选中提示词，请按 ⌘C 或 Ctrl+C 复制'); }
      break;
    }
    case 'aitest': await callModel(true);break;
    case 'aicall': await callModel(false);break;
    case 'airesult': download('模型分析结果.txt',$('#aiResult').textContent,'text/plain');break;
    case 'aisave': {const text=$('#aiResult').textContent;if(!text)break;(S.reviews[pageKey()]??=[]).push({status:'discuss',who:'模型辅助（待人工复核）',text,at:stamp()});await save();toast('模型结果已存为待讨论记录');break;}
    case 'close': $('#dlg').close(); break;
    case 'nm': S.nameIdx = i; await save(); render(true); settings(); break;
    case 'prov': aiConnected=false;S.provider = v; await save(); render(true); settings(); break;
    case 'reset':
      if (confirm('恢复原状、重新演示？\n工作台演示改动会清空，肉肉的独立资料保留，回到「日程总览」首页（主题保留）。')) {
        await flushPet();const keep = { theme: S.theme, nameIdx: S.nameIdx }; clearTimers(); S = validateMain(Object.assign(fresh(), keep)); renderedPage=null;await save();
        if ($('#dlg').open) $('#dlg').close(); render(); toast('已重置，可以重新演示');
      } break;
    case 'folder': $('#app').classList.toggle('folder-open'); break;
    case 'export': exportMd(); break;
    case 'rel': S.rel = v; await save(); render(true); break;
    case 'cite': {
      if(S.st===1 && +el.dataset.sc===12) {S.experience.checks.source=true;await save();}
      S.hl = +el.dataset.sc; render(true);
      const sc = $('#sc-' + el.dataset.sc), box = $('#script');
      if (sc && box) box.scrollTop = sc.offsetTop - box.offsetTop - 8;
      toast(`已定位到原文 第${el.dataset.sc}场`); break;
    }
    case 'adopt': S.adopt = i < 0 ? null : i; await save(); render(true); toast(i < 0 ? '已撤回，恢复原句' : '已采用建议，原句仍保留'); break;
    case 'handling': S.handling = v;S.experience.checks.handling=true; await save(); render(true); break;
    case 'play': playComic(); break;
    case 'move': S.tasks[i].col = Math.min(2, S.tasks[i].col + 1);S.experience.checks.taskMoved=true; await save(); render(true); break;
    case 'sel': S.sel = i; await save(); render(true); break;
    case 'tone': S.tone = v; await save(); render(true); break;
    case 'reply-save': await saveReply();break;
    case 'submit': await saveReply(true);break;
    case 'scope': S.scopeTried = S.scopeTried || S.scope !== v; S.scope = v; await save(); render(true); break;
    case 'pick': S.pick = v; await save(); render(true); break;
    case 'step': { const g = GUIDE[+el.dataset.st][+el.dataset.k]; if (g[1]) { S.tab[el.dataset.st] = g[1]; await save(); render(true); } const t = document.querySelector('.ai-box, .thinking, [data-ai]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); break; }
    case 'drill': S.drillShow = i < 0 ? {} : { ...(S.drillShow || {}), [i]: !(S.drillShow || {})[i] }; await save(); render(true); break;
    case 'wx': loadWX(true); render(true); toast('正在获取实时天气…'); break;
    case 'pack': S.pack[v] = el.checked; if (!el.checked) delete S.pack[v]; await save(); render(true); break;
    case 'food': { const t = ($('#foodIn').value || '').trim(); if (!t) { toast('先输入吃了什么'); break; } const g = guessKcal(t); S.meals.push({ t: new Date().toTimeString().slice(0, 5), n: t, k: g.k }); S.lastFood = `AI 估算：${t} ≈ ${g.k} 千卡（${g.how}）`; await save(); render(true); break; }
    case 'ck': S.check[v] = i; await save(); render(true); break;
    case 'cycle': if (v === 'off' && !confirm('关闭并清除经期记录？')) break; S.cycleOn = v === 'on'; if (!S.cycleOn) { S.sym = {}; S.cycle = { lastStart: -24, len: 28, dur: 5 }; } await save(); render(true); toast(S.cycleOn ? '已开启（保存在当前浏览器）' : '已关闭并清除'); break;
    case 'sym': { const k = new Date().toDateString(), l = S.sym[k] = S.sym[k] || []; const j = l.indexOf(v); j < 0 ? l.push(v) : l.splice(j, 1); await save(); render(true); break; }
    case 'gobrief': await go(-9); break;
    case 'offer': S.offer = i; await save(); render(true); break;
    case 'fanpf': S.fanPf = v; await save(); render(true); break;
    case 'fanok': S.fanOk = S.fanOk || {}; S.fanOk[v] = true; await save(); render(true); toast('已提交工作室审核，未对外发送'); break;
    case 'bf': S.bf = v; await save(); render(true); break;
    case 'bver': S.bVerified = el.checked; await save(); render(true); break;
    case 'print': document.body.classList.add('printing-card'); window.print(); setTimeout(() => document.body.classList.remove('printing-card'), 500); break;
    case 'calc': S.showCalc = !S.showCalc; await save(); render(true); break;
    case 'wreset': delete S.wts; await save(); render(true); toast('已恢复默认权重'); break;
    case 'evadd': { const n = ($('#evN').value || '').trim(); if (!n) { toast('先写下日程内容'); break; } let a = +$('#evA').value || S.selDay, b = +$('#evB').value || a; if (b < a) [a, b] = [b, a]; a = Math.max(1, Math.min(D.sched.days, a)); b = Math.max(1, Math.min(D.sched.days, b));
      const event={ id: 'u' + Date.now(), t: $('#evT').value, a, b, n, time: ($('#evTime').value || '').trim(), note: ($('#evNote').value || '').trim() };ActorStore.timeRange(event);S.userEvents.push(event); delete S.formDrafts[pageKey()]; renderedPage=null;await save(); render(true); toast('已添加到日程，冲突与统计已更新'); break; }
    case 'evdel': if (v.startsWith('u')) S.userEvents = S.userEvents.filter(e => e.id !== v); else if (v.startsWith('inv-')) delete S.inv[v.slice(4)]; else S.hiddenEv[v] = true; await save(); render(true); toast('已移除'); break;
    case 'evdone': S.evDone[v] = el.checked; if (!el.checked) delete S.evDone[v]; await save(); render(true); break;
    case 'tdone': S.todayDone[i] = el.checked; await save(); render(true); break;
    case 'evclear': if (confirm('清空全部示例日程？你添加的日程会保留。')) { D.sched.events.forEach((_, k) => S.hiddenEv['s' + k] = true); await save(); render(true); toast('已清空示例，可以从零开始录入'); } break;
    case 'evrestore': S.hiddenEv = {}; await save(); render(true); toast('已恢复示例日程'); break;
    case 'day': S.selDay = i; await save(); render(true); break;
    case 'inv': S.inv[v] = i === 1 ? 'yes' : i === 2 ? 'no' : undefined; if (!S.inv[v]) delete S.inv[v]; await save(); render(true); toast(i === 1 ? '已接受，日程已更新' : i === 2 ? '已婉拒（演示，不会发送任何消息）' : '已撤回'); break;
    case 'rvst': draftStatus = v; document.querySelectorAll('[data-act="rvst"]').forEach(b => b.classList.toggle('on', b.dataset.v === v)); break;
    case 'rvsave': await saveReview(); break;
    case 'rvdel': if (confirm('删除这条决定？')) { S.reviews[pageKey()].splice(i, 1); await save(); render(true); } break;
    case 'rvfdel': S.files[pageKey()].splice(i, 1); await save(); render(true); break;
    case 'backup': await exportBackup(); break;
    case 'archive': await archiveProject(); break;
    case 'archiveview': await archiveAction(i,'view');break;
    case 'archiveexport': await archiveAction(i,'export');break;
    case 'archiverestore': await archiveAction(i,'restore');break;
    case 'filedownload': await ActorStore.downloadFile(v);break;
    case 'check': S.checks[i] = el.checked; await save(); break;
  }
}));
document.addEventListener('change', handle(async e => {
  if (e.target.id === 'worksFile' && e.target.files[0]) await importWorks(e.target.files[0]);
  if (e.target.id === 'rvFile' && e.target.files.length) await importFiles(e.target.files);
  if (e.target.id === 'bkFile' && e.target.files[0]) await importBackup(e.target.files[0]);
}));
document.addEventListener('input', handle(async e => {
  captureDraft();clearTimeout(draftTimer);draftTimer=setTimeout(()=>save().catch(showError),300);
  if (e.target.dataset && e.target.dataset.wt) { S.wts = { ...(S.wts || D.scoreRule.weights), [e.target.dataset.wt]: +e.target.value };S.experience.checks.weights=true; await save(); render(true); return; }
  if (e.target.dataset && e.target.dataset.self !== undefined) { S.selfAns = S.selfAns || {}; S.selfAns[e.target.dataset.self] = e.target.value; await save();updateExperiencePanel(); }
  if (e.target.id === 'orgIn') S.orgQ = e.target.value;
  if (e.target.id === 'faq') {
    S.faqQ = e.target.value; const pos = e.target.selectionStart; render(true);
    const f = $('#faq'); f.focus(); f.setSelectionRange(pos, pos);
  }
}));
document.addEventListener('keydown', handle(async e => {
  if (e.key === 'Enter' && e.target.id === 'kwIn' && e.target.value.trim()) { (S.bKw = S.bKw || []).push(e.target.value.trim()); await save(); render(true); toast('已订阅关键词'); return; }
  if (e.key === 'Enter' && e.target.id === 'foodIn') { document.querySelector('[data-act="food"]').click(); return; }
  if (e.key === 'Enter' && e.target.classList?.contains('add-item') && e.target.value.trim()) {
    const r = e.target.dataset.role; (S.packAdd[r] = S.packAdd[r] || []).push(e.target.value.trim()); await save(); render(true); toast('已添加到「' + r + '」'); return;
  }
  if ((e.target.closest && e.target.closest('input,textarea,select')) || $('#dlg').open || e.metaKey || e.ctrlKey || e.altKey) return;
  const SEQ = [-1, 0, 1, 2, 3, 4, 5, 6, 7, -8, -6, -5, -7, -4, -9, -2, -3, -10, -11], cur = onPage() ? PAGES[onPage()] : S.st, k = SEQ.indexOf(cur);
  if (e.key === 'ArrowRight' && k < SEQ.length - 1) await go(SEQ[k + 1]);
  if (e.key === 'ArrowLeft' && k > 0) await go(SEQ[k - 1]);
}));
document.addEventListener('actor:work-open',e=>{if(!e.target.closest('[data-gradient-carousel]'))return;const index=e.detail?.index;if(!Number.isSafeInteger(index))return;const w=portfolioItems()[index];if(!w)return;const dlg=$('#dlg');dlg.innerHTML=`<div class="dlg"><h2>《${esc(w.title)}》<button data-act="close" aria-label="关闭">×</button></h2><span class="tag mt8">${esc(w.origin)}</span><dl class="kv mt"><dt>年份</dt><dd>${esc(w.year||'待填写')}</dd><dt>题材</dt><dd>${esc(w.genre||'待填写')}</dd><dt>角色</dt><dd>${esc(w.role||'待填写')}</dd><dt>备注</dt><dd>${esc(w.note||'暂无备注')}</dd></dl></div>`;if(!dlg.open)dlg.showModal();});
$('#dlg').addEventListener('click', e => { if (e.target === $('#dlg')) $('#dlg').close(); });

const fromHash = async () => { const h = location.hash.slice(1), hm = h.match(/st=(\d)/); if (hm) { Object.keys(PAGES).forEach(k => S[k] = false); S.st = Math.min(7, +hm[1]); } else if (PAGES[h]) Object.keys(PAGES).forEach(k => S[k] = k === h); else return; await save(); history.replaceState(null, '', location.pathname); };
addEventListener('message', handle(async event => {
  const frame = $('#guideFrame');
  if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'actor:guide-open') return;
  const page = event.data.page;
  if (!Number.isInteger(page) || !(page >= 0 && page <= 7 || Object.values(PAGES).includes(page))) return;
  await go(page);
}));
await fromHash();
addEventListener('hashchange', handle(async () => { await flushPet();captureDraft(); await fromHash(); clearTimers(); render(); $('#main').scrollTop = 0; }));
render();
})().catch(error => { console.error(error); document.querySelector("#main").textContent="启动失败："+error.message; });
