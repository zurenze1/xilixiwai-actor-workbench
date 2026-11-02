import {renderMatrix,matrixConnectionInfo} from './matrix.js?v=20261102';
import {finalChecksHTML,emptyChecks,checkProgress} from './final-review.js?v=20261103';
import {rulebookRecord,riskPanelHTML,attachRiskPanel} from './content-risk.js?v=20261103';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {D,validate,cents}=window.IPSchema;
const NAV=[['today','今日工作台','把今天最重要的事，放在眼前。'],['schedule','日程与任务','每个安排，都有时间、负责人和完成标准。'],['library','IP资料库','积累经历、观点与素材，让表达有根有据。'],['radar','热点雷达','按日期查看人物、文化、AI与观众反馈。'],['topics','选题库','让灵感有出处，让选题有明确的受众。'],['content','内容创作','从第一句，到IP确认的那一版。'],['execution','分镜执行台','把文案、画面、声音和执行要求放在一起。'],['shoots','拍摄准备','把稿件变成镜头，把现场准备到位。'],['final-check','成片核对','剪完以后，逐项看过，再放心进入发布。'],['operations','账号矩阵与复盘','把多个平台放在一起看，把下一步放进工作里。'],['business','商务合作','从第一次沟通，到交付和回款。']];
let ctx=null,ips=[],ip=null,records=[],files=[],route='today',search='',status='',showArchived=false,saving=false,dirty=false,calendarMonth='',toastTimer;
let creatorDirty=false;
window.addEventListener('message',e=>{const f=document.querySelector('.creator-module-frame');if(e.origin===location.origin&&e.source===f?.contentWindow&&e.data?.type==='creator-dirty')creatorDirty=e.data.dirty===true;});
let matrixFilters={platform:'',accountId:'',metric:'likes',from:'',to:'',page:1};
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const localTime=()=>{const d=new Date();return `${localDate()}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
calendarMonth=localDate().slice(0,7);
const path=()=>`projects/${ip.id}`;
const active=kind=>records.filter(r=>(!kind||r.kind===kind)&&!r.body.archived);
const byId=id=>records.find(r=>r.id===id);
const writable=()=>ctx?.role!=='viewer';
function dateText(v){return v?v.replace('T',' '):'未安排';}
function badge(v){const cls=['完成','已确认','已发布','拍摄完成','已结清','可复用','已落实'].includes(v)?'good':['待IP审核','待审核','待回款','待验收','待确认','待准备','待讨论'].includes(v)?'warm':['需修改','已过期'].includes(v)?'red':'';return `<span class="badge ${cls}">${esc(v||'未填写')}</span>`;}
function button(action,label,id='',cls=''){return `<button type="button" class="${cls}" data-action="${action}"${id?` data-id="${esc(id)}"`:''}>${label}</button>`;}
function add(kind,label=D[kind].name){return writable()?`<button class="primary" data-action="new" data-kind="${kind}">＋ ${esc(label)}</button>`:'';}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
async function api(p,{method='GET',body,raw=false}={}){
 const r=await fetch('/api/p/'+p,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(ctx?{'x-studio-id':ctx.studioId}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 if(!r.ok){let data;try{data=await r.json();}catch{}const e=Error(data?.error||`请求未完成（${r.status}）`);e.status=r.status;throw e;}
 return raw?r:await r.json();
}
async function reload(){
 const all=await api('projects');ips=all.filter(p=>!p.archived);const key='ip-workbench-selected-'+ctx.user.id;
 ip=ips.find(p=>p.id===(ip?.id||localStorage.getItem(key)))||ips[0]||null;
 if(ip){localStorage.setItem(key,ip.id);[records,files]=await Promise.all([api(path()+'/records'),api(path()+'/files')]);records=records.filter(r=>r.kind.startsWith('ip-'));}else{records=[];files=[];}
 $('#ip-select').innerHTML=ips.length?ips.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join(''):'<option value="">尚未创建 IP</option>';
 if(ip)$('#ip-select').value=ip.id;
 $('#sync').textContent='已读取 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
}
async function boot(){
 try{ctx=await api('context');$('#shell').hidden=false;$('#startup-error').hidden=true;$('#identity').textContent='无需登录 · 当前电脑使用';$('#nav').innerHTML=NAV.map(([key,title],i)=>`<a href="#${key}" data-route="${key}"><span>${String(i+1).padStart(2,'0')}</span><span>${title}</span></a>`).join('');await reload();navigate();}
 catch(e){$('#startup-error').hidden=false;$('#startup-error').textContent=e.message+'\n请重新打开 IP 工作台，再刷新页面。';}
}
$('#ip-select').onchange=async e=>{if(creatorDirty){e.target.value=ip.id;toast('分镜还有修改未保存，请先保存。');return;}ip=ips.find(p=>p.id===e.target.value);search='';status='';showArchived=false;matrixFilters={platform:'',accountId:'',metric:'likes',from:'',to:'',page:1};await guarded(async()=>{await reload();render();});};
$('#menu-toggle').onclick=()=>toggleMenu(!document.body.classList.contains('nav-open'));$('#backdrop').onclick=()=>toggleMenu(false);
function toggleMenu(open){document.body.classList.toggle('nav-open',open);$('#menu-toggle').setAttribute('aria-expanded',String(open));}
function navigate(){if(creatorDirty){window.history.replaceState(null,'','#'+route);toast('分镜还有修改未保存，请先保存。');return;}const key=location.hash.slice(1);route=NAV.some(n=>n[0]===key)?key:'today';search='';status='';showArchived=false;toggleMenu(false);render();}
window.addEventListener('hashchange',navigate);
function modal(title,html){dirty=false;$('#dialog-label').textContent=title;$('#dialog-body').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();$('#dialog').scrollTop=0;}
function closeDialog(){if(saving)return;if(dirty&&!confirm('还有未保存的修改，确定关闭吗？'))return;dirty=false;$('#dialog').close();}
$('#close-dialog').onclick=closeDialog;$('#dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog();});$('#dialog').addEventListener('input',()=>{if($('#record-form')||$('#ip-form'))dirty=true;});
window.addEventListener('beforeunload',e=>{if(dirty||saving||creatorDirty){e.preventDefault();e.returnValue='';}});
async function guarded(fn){try{await fn();}catch(e){if($('#dialog').open){let box=$('#form-error');if(!box){box=document.createElement('p');box.id='form-error';box.setAttribute('role','alert');$('#dialog-body').append(box);}box.textContent=e.message;}else if(e.message.includes('\n')||e.message.length>100)modal('请核对后重试',`<h2>本次操作未完成</h2><div class="note error">${esc(e.message)}</div>`);else toast(e.message);}}
function empty(title,text,actions='',compact=false){return `<div class="empty ${compact?'compact':''}"><h2>${title}</h2><p>${text}</p>${actions}</div>`;}
function sceneImage(key){if(key==='final-check')key='shoots';return `assets/ip-scenes-v1/${key}.jpg`;}
function heading(actions=''){
 const n=NAV.find(n=>n[0]===route);
 return `<section class="page-head illustrated" data-scene="${route}" aria-labelledby="page-title"><img class="head-photo" src="${sceneImage(route)}" alt="" decoding="async" fetchpriority="high"><div class="head-copy"><span class="eyebrow">${esc(ip?.title||'YOUR IP WORKSPACE')} / ${String(NAV.indexOf(n)+1).padStart(2,'0')}</span><h1 id="page-title">${n[1]}</h1><p>${n[2]}</p><div class="actions">${actions}</div></div></section>`;
}
function visualShortcuts(){
 const shortcuts=[['topics','01 / TOPICS','开始选题'],['content','02 / CONTENT','写一条内容'],['shoots','03 / SHOOT','准备拍摄'],['operations','04 / MATRIX','查看账号矩阵']];
 return `<nav class="visual-shortcuts" aria-label="内容工作的四个入口">${shortcuts.map(([key,kicker,title])=>`<a class="visual-shortcut" href="#${key}"><img src="${sceneImage(key)}" alt="" loading="lazy" decoding="async"><span><small>${kicker}</small><b>${title}</b></span><i aria-hidden="true">↗</i></a>`).join('')}</nav>`;
}
function rowsFor(kind){return records.filter(r=>r.kind===kind&&Boolean(r.body.archived)===showArchived&&(!status||r.body.status===status)&&(!search||JSON.stringify([r.title,r.body]).toLowerCase().includes(search.toLowerCase())));}
function rowLink(r){return `<button class="record-link" data-action="view" data-id="${esc(r.id)}">${esc(r.title)}</button>`;}
function relatedTitle(id){const r=byId(id);return r?r.title:'未关联';}
function actionsFor(r){return `${button('view','查看',r.id,'subtle')}${writable()?button('edit','编辑',r.id,'subtle'):''}`;}
function toolbar(kind){const choices=D[kind].fields.find(f=>f.key==='status')?.options||[];return `<div class="toolbar"><input id="search" type="search" placeholder="搜索标题、负责人或内容" aria-label="搜索记录" value="${esc(search)}"><select id="status-filter" aria-label="筛选状态"><option value="">全部状态</option>${choices.map(v=>`<option${status===v?' selected':''}>${esc(v)}</option>`).join('')}</select><label class="archive-toggle"><input id="archived" type="checkbox"${showArchived?' checked':''}>查看已归档</label></div>`;}
function table(kind){const items=rowsFor(kind);if(!items.length)return empty(showArchived?'还没有归档记录':'这里还没有记录',search||status?'没有符合筛选条件的记录，试试清空搜索或更换状态。':`新建第一条${D[kind].name}，保存后即可在这里继续跟进。`,!search&&!status&&!showArchived?add(kind):'');
 const cols={
 'ip-finalcheck':[['作品 / 成片版本',r=>rowLink(r)+`<small>${esc(r.body.cutVersion)}</small>`],['关联稿件',r=>esc(relatedTitle(r.body.contentId))],['核对进度',r=>{const p=checkProgress(r.body.checks);return `<span class="badge ${p.complete?'good':'warm'}">${p.done} / ${p.total} 项已核对</span>`;}],['最近保存',r=>esc(new Date(r.updated_at).toLocaleString('zh-CN'))]],
 'ip-topic':[['选题与受众',r=>rowLink(r)+`<small>${esc(r.body.audience)}</small>`],['状态',r=>badge(r.body.status)],['负责人',r=>esc(r.body.owner||'未指定')],['讨论日期',r=>dateText(r.body.due)]],
 'ip-content':[['稿件',r=>rowLink(r)+`<small>${esc(r.body.format)} · ${esc(r.body.platform)} · 第 ${r.revision} 版</small>`],['审核状态',r=>badge(r.body.status)],['负责人',r=>esc(r.body.owner||'未指定')],['截止日期',r=>dateText(r.body.due)]],
 'ip-shoot':[['拍摄计划',r=>rowLink(r)+`<small>${esc(relatedTitle(r.body.contentId))}</small>`],['时间',r=>dateText(r.body.start)],['地点 / 负责人',r=>esc(r.body.location)+`<small>${esc(r.body.owner)}</small>`],['准备状态',r=>badge(r.body.status)]],
 'ip-task':[['任务',r=>rowLink(r)],['负责人',r=>esc(r.body.owner)],['截止',r=>`<span class="${r.body.due<localDate()&&!['完成','取消'].includes(r.body.status)?'conflict':''}">${dateText(r.body.due)}</span>`],['状态',r=>badge(r.body.status)]],
 'ip-event':[['日程',r=>rowLink(r)],['开始',r=>dateText(r.body.start)],['结束',r=>dateText(r.body.end)],['状态',r=>badge(r.body.status)]],
 'ip-release':[['发布内容',r=>rowLink(r)+`<small>${esc(r.body.platform)} · ${esc(r.body.account)}</small>`],['发布时间',r=>dateText(r.body.publishedAt||r.body.plannedAt)],['状态',r=>badge(r.body.status)],['播放 / 阅读',r=>r.body.views===''||r.body.views===undefined?'未记录':Number(r.body.views).toLocaleString('zh-CN')]],
 'ip-review':[['复盘',r=>rowLink(r)],['日期',r=>dateText(r.body.date)],['负责人',r=>esc(r.body.owner||'未指定')],['行动状态',r=>badge(r.body.status)]],
 'ip-deal':[['合作',r=>rowLink(r)+`<small>${esc(r.body.counterparty)}</small>`],['合同金额',r=>r.body.amount?`${esc(r.body.currency)} ${money(BigInt(cents(r.body.amount)))}`:'未确认'],['交付 / 回款',r=>dateText(r.body.due)+`<small>回款 ${dateText(r.body.paymentDue)}</small>`],['状态',r=>badge(r.body.status)]],
 'ip-profile':[['资料',r=>rowLink(r)+`<small>${esc(r.body.category)}</small>`],['确认状态',r=>badge(r.body.status)],['确认 / 查阅日期',r=>dateText(r.body.verifiedAt)],['附件',r=>r.body.fileId?esc(files.find(f=>f.id===r.body.fileId)?.name||'已关联原件'):'—']]
 }[kind];return `<div class="table-scroll"><table><thead><tr>${cols.map(([c])=>`<th>${c}</th>`).join('')}<th>操作</th></tr></thead><tbody>${items.map(r=>`<tr>${cols.map(([,get])=>`<td>${get(r)}</td>`).join('')}<td class="table-actions">${actionsFor(r)}</td></tr>`).join('')}</tbody></table></div>`;
}
function compactList(items,small,limit=6){return items.length?items.slice(0,limit).map(r=>`<div class="list-row"><div>${rowLink(r)}<small>${esc(small(r))}</small></div>${badge(r.body.status)}</div>`).join(''):empty('暂时没有','有新的安排后，会在这里显示。','',true);}
function renderToday(){
 const tasks=active('ip-task').filter(r=>!['完成','取消'].includes(r.body.status)).sort((a,b)=>a.body.due.localeCompare(b.body.due));
 const approvals=active('ip-content').filter(r=>r.body.status==='待IP审核');
 const upcoming=[...active('ip-event'),...active('ip-shoot')].filter(r=>!['完成','拍摄完成','取消'].includes(r.body.status)&&r.body.end>=localTime()).sort((a,b)=>a.body.start.localeCompare(b.body.start));
 const pending=active('ip-release').filter(r=>r.body.status==='待发布');const overdue=tasks.filter(r=>r.body.due<localDate()).length;
 return heading(`<span class="date-label">${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</span>${add('ip-task','记一件待办')}`)+visualShortcuts()+
 `<section class="kpis">${[[tasks.length,'待跟进任务','schedule'],[approvals.length,'待IP确认稿件','content'],[upcoming.filter(r=>r.body.start.slice(0,10)<=localDate()&&r.body.end.slice(0,10)>=localDate()).length,'今天的日程与拍摄','schedule'],[pending.length,'待发布作品','operations']].map(([num,label,key])=>`<div class="kpi"><strong>${num}</strong><span>${label}</span><a href="#${key}" aria-label="打开${label}">↗</a></div>`).join('')}</section>${overdue?`<div class="note warm">有 ${overdue} 件任务已过截止日期，请确认进度或重新安排。</div>`:''}<div class="dashboard-columns"><div><section class="panel"><div class="panel-head"><h2>接下来要推进的事</h2><a href="#schedule">查看全部 →</a></div><div class="panel-body">${compactList(tasks,r=>`${r.body.owner} · ${r.body.due}`)}</div></section><section class="panel"><div class="panel-head"><h2>内容制作进度</h2><a href="#content">进入创作 →</a></div><div class="panel-body"><div class="steps">${[['topics','选题',active('ip-topic').length],['content','稿件',active('ip-content').length],['shoots','拍摄',active('ip-shoot').length],['final-check','成片核对',active('ip-finalcheck').length],['operations','发布',active('ip-release').filter(r=>r.body.status==='已发布').length]].map(([key,name,n])=>`<a class="step" href="#${key}"><b>${n}</b><span>${name}</span></a>`).join('')}</div><p class="fine">选题确认后转为稿件，再安排拍摄与发布；每一步保留关联。</p></div></section></div><div><section class="panel"><div class="panel-head"><h2>等待 IP 确认</h2><a href="#content">查看稿件 →</a></div><div class="panel-body">${compactList(approvals,r=>`${r.body.owner||'负责人待定'} · 第 ${r.revision} 版`)}</div></section><section class="panel"><div class="panel-head"><h2>接下来的安排</h2><a href="#schedule">打开日历 →</a></div><div class="panel-body">${compactList(upcoming,r=>`${dateText(r.body.start)} · ${r.body.location||'地点待定'}`)}</div></section></div></div>`;
}
function renderCalendar(){
 const [y,m]=calendarMonth.split('-').map(Number),days=new Date(y,m,0).getDate(),offset=(new Date(y,m-1,1).getDay()+6)%7;
 const all=[...active('ip-event'),...active('ip-shoot')].filter(r=>r.body.status!=='取消'&&r.body.start.slice(0,7)<=calendarMonth&&r.body.end.slice(0,7)>=calendarMonth);
 const conflictIds=new Set();for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){if(all[i].body.start<all[j].body.end&&all[j].body.start<all[i].body.end){conflictIds.add(all[i].id);conflictIds.add(all[j].id);}}
 return `<section class="panel"><div class="panel-head"><h2>工作日历</h2><div class="actions"><button data-action="month-prev" aria-label="上个月">‹</button><span>${y} 年 ${m} 月</span><button data-action="month-next" aria-label="下个月">›</button>${button('month-today','本月','','subtle')}</div></div><div class="panel-body"><div class="calendar-week">${['一','二','三','四','五','六','日'].map(d=>`<span>周${d}</span>`).join('')}</div><div class="calendar-days">${'<div class="calendar-day blank"></div>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const d=calendarMonth+'-'+String(i+1).padStart(2,'0'),events=all.filter(r=>r.body.start.slice(0,10)<=d&&r.body.end.slice(0,10)>=d),tasks=active('ip-task').filter(r=>r.body.due===d&&!['完成','取消'].includes(r.body.status));return `<button class="calendar-day ${d===localDate()?'today':''}" data-action="calendar-day" data-day="${d}">${i+1}${events.slice(0,2).map(r=>`<span>${conflictIds.has(r.id)?'⚑ ':''}${esc(r.title)}</span>`).join('')}${tasks.length?`<span>${tasks.length} 件任务到期</span>`:''}${events.length>2?`<span>另有 ${events.length-2} 项</span>`:''}</button>`;}).join('')}</div>${conflictIds.size?'<p class="fine conflict">⚑ 时间重叠提示：日程与拍摄存在重叠，请打开当天记录确认参与人是否冲突。</p>':''}</div></section>`;
}
function money(n){const b=BigInt(n),a=b/100n,c=(b%100n).toString().padStart(2,'0');return a.toLocaleString('zh-CN')+'.'+c;}
function resources(){return `<h2 class="section-title">可选工作提纲 · 附来源</h2><p class="fine">公开方法已查阅，下面是为工作台整理的原创提纲。加入后可编辑；不会作为这个 IP 已确认的事实。</p><div class="resource-grid" style="margin-top:18px">${window.IPResources.map(r=>`<article class="resource"><span class="eyebrow">${esc(r.category)}</span><h3>${esc(r.title)}</h3><p>${esc(r.summary)}</p><div class="actions">${writable()?button('use-template','加入资料库',r.id):''}${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source)} ↗</a>`:'<small>原创清单</small>'}</div></article>`).join('')}</div>`;}
function render(){
 if(!ctx)return;$('#crumb').textContent=NAV.find(n=>n[0]===route)[1];document.querySelectorAll('#nav a').forEach(a=>{a.classList.toggle('active',a.dataset.route===route);if(a.dataset.route===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(!ip){$('#main').innerHTML=heading()+`<section class="panel">${empty('先创建你的 IP 工作空间','填一个你自己辨认的名称即可。资料、稿件和商务都会保存在这个 IP 下，不会预填虚构经历。',writable()?button('new-ip','＋ 新建第一个 IP','','primary'):'请管理员先创建 IP。')}</section>`;return;}
 if(route==='today'){$('#main').innerHTML=renderToday();return;}
 if(route==='radar'||route==='execution'){
  const page=route==='radar'?'daily':'edit-plan',src='/api/p/projects/'+encodeURIComponent(ip.id)+'/creator/app/#page='+page;
  $('#main').innerHTML=`<section class="creator-module-shell"><div class="creator-module-bar"><h1>${route==='radar'?'热点雷达':'分镜执行台'}</h1><span>${esc(ip.title)} · 独立保存</span><a href="${src}" target="_blank" rel="noopener noreferrer">在新标签页展开 ↗</a><a href="/api/p/projects/${encodeURIComponent(ip.id)}/creator/app/#page=settings" target="_blank" rel="noopener noreferrer">模块备份与恢复 ↗</a></div><iframe class="creator-module-frame" title="${route==='radar'?'热点雷达':'分镜执行台'}" src="${src}"></iframe></section>`;return;
 }

 const kind={topics:'ip-topic',content:'ip-content',shoots:'ip-shoot','final-check':'ip-finalcheck',schedule:'ip-task',operations:'ip-release',business:'ip-deal',library:'ip-profile'}[route];
 let actions=add(kind);if(route==='schedule')actions+=add('ip-event','添加日程');if(route==='operations')actions=add('ip-account','添加矩阵账号')+button('matrix-snapshot','记录账号数据')+button('matrix-connection','查看接入进展');if(route==='library')actions+=button('rename-ip','修改 IP 名称');
 let extra='';
 if(route==='final-check')extra='<div class="note">按画面、字幕、声音核对14项。每份核对单对应一个成片版本；勾选后自动保存。更换成片版本或关联稿件后，重新核对。</div>';
 if(route==='business'){const sums={};for(const r of active('ip-deal').filter(r=>r.body.status!=='未合作'&&r.body.amount)){sums[r.body.currency]??=0n;sums[r.body.currency]+=BigInt(cents(r.body.amount))-BigInt(cents(r.body.received||'0'));}extra=`<div class="money-summary">${Object.entries(sums).map(([c,n])=>`<div><span>${esc(c)} 待收款</span><strong>${money(n)}</strong><small>合同金额减累计已收，不含未合作</small></div>`).join('')}</div>`;}
 if(route==='operations')extra=renderMatrix(records,matrixFilters,writable());
 if(route==='content')extra='<div class="note">填写确认人和确认日期，才能把稿件标为已确认。已确认后修改标题或正文，需要重新审核。</div>';
 $('#main').innerHTML=heading(actions)+extra+(route==='schedule'?renderCalendar():'')+(route==='operations'?`<details class="panel release-workflow"><summary>发布登记与运营复盘</summary><div class="panel-body"><div class="actions">${add('ip-release')}${add('ip-review','写复盘')}${button('csv-import','导入发布CSV')}${button('csv-template','发布CSV模板')}</div><p class="fine">登记稿件发布，并跟进运营复盘。</p>${toolbar(kind)}${table(kind)}<h2 class="section-title">复盘与下一步</h2>${table('ip-review')}</div></details>`:toolbar(kind)+table(kind))+(route==='schedule'?`<h2 class="section-title">日程记录</h2>${table('ip-event')}`:'')+(route==='library'?resources():'');
 for(const el of document.querySelectorAll('[data-matrix-filter]'))el.onchange=()=>{matrixFilters[el.dataset.matrixFilter]=el.value;if(el.dataset.matrixFilter==='platform')matrixFilters.accountId='';matrixFilters.page=1;render();};

 $('#search').oninput=e=>{search=e.target.value;const position=e.target.selectionStart;render();const input=$('#search');input.focus();input.setSelectionRange(position,position);};$('#status-filter').onchange=e=>{status=e.target.value;render();};$('#archived').onchange=e=>{showArchived=e.target.checked;render();};
}

function fieldHTML(f,value){
 const v=value??(f.type==='select'?f.options[0]:''),required=f.required?' required':'';
 let input;
 if(f.type==='final-checks')return `<div class="wide"><input type="hidden" name="checks" value="${esc(v||emptyChecks())}">${finalChecksHTML(v||emptyChecks(),{esc,editable:true})}</div>`;
 if(f.type==='textarea')input=`<textarea name="${f.key}" maxlength="100000"${required}>${esc(v)}</textarea>`;
 else if(f.type==='select')input=`<select name="${f.key}"${required}>${f.options.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('')}</select>`;
 else if(['topic','content','file','account'].includes(f.type)){
  const items=f.type==='file'?files:records.filter(r=>r.kind==='ip-'+f.type&&(!r.body.archived||r.id===v));
  input=`<select name="${f.key}"${required}><option value="">${f.required?'请选择':'不关联'}</option>${items.map(r=>`<option value="${esc(r.id)}"${r.id===v?' selected':''}>${esc(r.title||r.name)}</option>`).join('')}</select>`;
 }else{const type=['date','datetime-local','url'].includes(f.type)?f.type:['count','percent','money'].includes(f.type)?'number':'text';input=`<input name="${f.key}" type="${type}" value="${esc(v)}"${required}${['count','percent','money'].includes(f.type)?` min="0" step="${f.type==='count'?'1':f.type==='money'?'0.01':'any'}"${f.type==='percent'?' max="100"':''}`:' maxlength="100000"'}>`;}
 return `<label class="${f.type==='textarea'?'wide':''}"><span>${esc(f.label)}${f.required?' <span class="required">*</span>':''}</span>${input}</label>`;
}
function editor(kind,r=null,seed={}){
 if(!ip)return ipForm();if(!writable())return toast('当前账号只有查看权限');const def=D[kind];if(!def)throw Error('记录类型无效');const initial={...r?.body,...seed};
 modal(`${r?'编辑':'新建'}${def.name}`,`<form id="record-form"><div class="form-grid"><label class="wide"><span>标题 <span class="required">*</span></span><input name="title" required maxlength="500" value="${esc(r?.title||seed.title||'')}"></label>${def.fields.map(f=>fieldHTML(f,initial[f.key])+(kind==='ip-content'&&f.key==='script'?riskPanelHTML(rulebookRecord(records),esc):'')).join('')}${def.fields.some(f=>f.type==='file')?'<label class="wide">或者上传一个新附件（最大32 MiB）<input name="upload" type="file"><small>上传后保留原文件，并随完整IP备份导出。</small></label>':''}</div><p id="form-error" role="alert"></p><div class="form-actions"><small>${r?'保存会生成新版本。':'资料保存到当前 IP：'+esc(ip.title)} · ${r?.visibility==='private'?'仅创建者可见':'工作空间内可见'}</small><div class="actions">${button('download-draft','下载未保存草稿','','subtle')}<button class="primary" type="submit">保存${def.name}</button></div></div></form>`);
 const form=$('#record-form');let uploaded='';
 if(kind==='ip-content')attachRiskPanel(form,rulebookRecord(records),{esc});
 if(kind==='ip-finalcheck'){
  const refreshChecks=()=>{const bits=[...form.querySelectorAll('[data-final-index]')].map(b=>b.checked?'1':'0').join('');form.elements.checks.value=bits;const p=checkProgress(bits);form.querySelector('.review-progress').textContent=`${p.done} / ${p.total} 项已核对`;};
  form.addEventListener('change',e=>{if(e.target.matches('[data-final-index]'))refreshChecks();});
  form.addEventListener('input',e=>{if(r&&['cutVersion','contentId'].includes(e.target.name)&&e.target.value!==(r.body[e.target.name]||'')){form.querySelectorAll('[data-final-index]').forEach(b=>b.checked=false);refreshChecks();}});
 }
 if(kind==='ip-content'&&r&&IPSchema.approved.has(r.body.status))form.addEventListener('input',e=>{if(['title','hook','outline','script','cta'].includes(e.target.name)){form.elements.status.value='待IP审核';form.elements.reviewer.value='';form.elements.reviewedAt.value='';$('#form-error').textContent='稿件表达已改变，本次保存将回到待IP审核。请先保存，再由IP重新确认。';}});
 form.onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('#form-error').textContent='';
  try{const body={...r?.body,...seed};delete body.title;for(const f of def.fields)body[f.key]=String(form.elements[f.key].value).trim();validate(kind,body);
   const file=form.elements.upload?.files[0];if(file){if(file.size>32*1024*1024)throw Error('单个附件最大32 MiB，请分开上传');if(!uploaded){const meta=await api(path()+'/files',{method:'POST',body:{name:file.name,type:file.type||'application/octet-stream',data:await base64(file),visibility:r?.visibility||'team'}});uploaded=meta.id;}body.fileId=uploaded;}
   const payload={title:form.elements.title.value.trim(),kind,body,...(r?{revision:r.revision,visibility:r.visibility}:{visibility:'team'})};
   const saved=await api(path()+'/records'+(r?'/'+r.id:''),{method:r?'PATCH':'POST',body:payload});dirty=false;await reload();view(byId(saved.id));render();toast(def.name+'已保存');
  }catch(err){$('#form-error').textContent=err.message;}finally{saving=false;buttons.forEach(b=>b.disabled=false);}
 };
}
function detailFields(r){return D[r.kind].fields.filter(f=>r.body[f.key]!==''&&r.body[f.key]!==undefined).map(f=>{let v=r.body[f.key];
 if(['content','topic','account'].includes(f.type))v=byId(v)?`<button class="record-link" data-action="view" data-id="${esc(v)}">${esc(relatedTitle(v))} ↗</button>`:'关联记录未找到';
 else if(f.type==='file'){const file=files.find(x=>x.id===v);v=file?`<a href="/api/p/files/${encodeURIComponent(v)}" data-file-id="${esc(v)}">下载原件：${esc(file.name)} ↗</a>`:'关联原件未找到';}
 else if(f.type==='url')v=`<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)} ↗</a>`;
 else if(f.type==='final-checks')v=finalChecksHTML(v,{esc,id:r.id,editable:writable()&&!r.body.archived});
 else if(r.kind==='ip-shoot'&&f.key==='checklist')v=String(v).split('\n').filter(Boolean).map((line,i)=>{const done=/^\s*\[x\]/i.test(line);return `<label class="check-item ${done?'done':''}"><input type="checkbox" data-check-id="${esc(r.id)}" data-check-index="${i}"${done?' checked':''}${!writable()?' disabled':''}><span>${esc(line.replace(/^\s*\[[ x]\]\s*/i,''))}</span></label>`;}).join('');
 else v=esc(v);
 return `<div class="detail-field ${f.type==='textarea'?'wide':''} ${f.key==='script'?'script':''}"><span class="label">${esc(f.label)}</span><div class="value">${v}</div></div>`;
 }).join('');}
function view(r){if(!r)throw Error('记录不存在，请刷新后重试');const def=D[r.kind];let actions=writable()?button('edit','编辑',r.id,'primary'):'';
 if(writable()&&!r.body.archived){if(r.kind==='ip-topic')actions+=button('topic-content','转为稿件',r.id);if(r.kind==='ip-content'){actions+=button('content-shoot','安排拍摄',r.id)+button('content-final','核对成片',r.id)+button('content-release','安排发布',r.id);if(['写作中','需修改'].includes(r.body.status))actions+=button('submit-review','送IP审核',r.id);}if(r.kind==='ip-task'&&r.body.status!=='完成')actions+=button('finish-task','标为完成',r.id);if(r.kind==='ip-review')actions+=button('review-task','把下一步建成任务',r.id);}
 actions+=button('history','历史版本',r.id)+button('export-record','导出文稿',r.id)+(writable()?button('archive',r.body.archived?'恢复记录':'归档',r.id,'subtle'):'');
 modal(def.name,`<h2>${esc(r.title)}</h2><p class="detail-meta">第 ${r.revision} 版 · 更新于 ${esc(new Date(r.updated_at).toLocaleString('zh-CN'))}${r.body.archived?' · 已归档':''}</p><div class="actions">${actions}</div><div class="details-grid">${detailFields(r)}</div>`);
}
async function update(r,body,message){if(saving)return;saving=true;try{const saved=await api(path()+'/records/'+r.id,{method:'PATCH',body:{title:r.title,body,revision:r.revision,visibility:r.visibility}});await reload();render();if($('#dialog').open)view(byId(saved.id));toast(message);return saved;}finally{saving=false;}}
function ipForm(rename=false){if(!writable())return;modal(rename?'修改IP名称':'创建IP工作空间',`<form id="ip-form"><div class="form-grid"><label class="wide"><span>IP名称 / 你习惯的称呼 <span class="required">*</span></span><input name="title" maxlength="80" required value="${rename?esc(ip.title):''}" placeholder="例如：品牌主理人 / 某某的内容工作室"></label><label class="wide">当前目标与备注<textarea name="notes" maxlength="20000" placeholder="可先留空，之后到IP资料库补充定位">${rename?esc(ip.data.notes||''):''}</textarea></label></div><p id="form-error" role="alert"></p><div class="form-actions"><small>每个IP的稿件、日程和合作分别保存。</small><button class="primary">${rename?'保存名称':'创建工作空间'}</button></div></form>`);
 $('#ip-form').onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;const b=e.target.querySelector('button');b.disabled=true;try{const f=new FormData(e.target),p=await api(rename?path():'projects',{method:rename?'PATCH':'POST',body:{title:f.get('title').trim(),notes:f.get('notes').trim(),...(rename?{revision:ip.revision}:{})}});ip=p;dirty=false;$('#dialog').close();await reload();render();toast(rename?'IP名称已修改':'IP工作空间已创建');}catch(err){$('#form-error').textContent=err.message;}finally{saving=false;b.disabled=false;}};
}
function endAfterHour(start){const d=new Date(start);d.setHours(d.getHours()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
async function history(r){const items=await api(path()+'/records/'+r.id+'/versions');modal('历史版本',`<h2>${esc(r.title)}</h2><p class="fine">当前为第 ${r.revision} 版。恢复会保存为一个新版本；稿件恢复后需要重新确认。</p>${items.length?items.map(v=>{const b=typeof v.body==='string'?JSON.parse(v.body):v.body;return `<section class="history-item"><div class="actions"><b>第 ${v.revision} 版</b><small>${esc(dateText(v.created_at))}</small>${writable()?`<button data-action="restore-version" data-id="${esc(r.id)}" data-version="${v.revision}">恢复此版</button>`:''}</div><details><summary>查看内容</summary><pre>${esc(JSON.stringify({title:v.title,body:b},null,2))}</pre></details></section>`;}).join(''):empty('还没有历史版本','每次保存修改时，之前的版本会保留。','',true)}`);}
function download(name,data,type='text/plain;charset=utf-8'){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
const safeName=s=>s.replace(/[\\/:*?"<>|]/g,'_').slice(0,80);
const base64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('文件读取失败'));reader.readAsDataURL(file);});
function exportRecord(r){const text=`# ${r.title}\n\n${D[r.kind].name} · 第 ${r.revision} 版\n\n`+D[r.kind].fields.filter(f=>r.body[f.key]!==''&&r.body[f.key]!==undefined).map(f=>`## ${f.label}\n\n${['topic','content','account'].includes(f.type)?relatedTitle(r.body[f.key]):f.type==='file'?(files.find(x=>x.id===r.body[f.key])?.name||'原件'):r.body[f.key]}\n`).join('\n');download(safeName(r.title)+'.md',text);}
async function backup(){if(!ip)return toast('请先创建IP');toast('正在准备包含原始附件的备份…');const r=await api(path()+'/export',{raw:true});download(safeName(ip.title)+'-'+localDate()+'.zip',await r.blob());toast('备份已生成，请确认文件已保存');}
function help(){modal('使用说明与数据备份',`<h2>从一个选题，走到一次复盘。</h2><div class="note">1. 新建IP，在IP资料库确认定位、经历和素材。\n2. 选题确认后转为稿件，记录审核人和确认日期。\n3. 从稿件安排拍摄；剪辑完成后，在成片核对中逐项勾选，再登记发布。\n4. 填写实际数据和采集时间，把复盘的下一步建成任务。</div><p>每次点击“保存”后，数据写入本机数据库。切换板块前请保存表单；多窗口同时修改会提示版本冲突。</p><h3 class="section-title">IP基础资料备份</h3><p class="fine">包含当前账号可见的基础记录、资料文字和原始附件。热点雷达与分镜执行台使用独立资料目录，请在两个模块上方的“模块备份与恢复”另行导出含原件的完整备份。恢复时新建一个IP，原来的IP保留。备份不含服务运行配置。</p><div class="actions" style="margin:16px 0">${button('backup','导出当前 IP 完整备份','','primary')}${writable()?button('restore-backup','从 ZIP 恢复为新 IP'):''}</div><h3 class="section-title">使用范围</h3><p class="fine">打开即用，无需注册或密码。此版本运行在这台电脑上。本机服务停止后无法继续读写，重新双击 IP 工作台即可恢复。跨电脑协作需要另外部署服务。账号矩阵可管理多平台账号、账号快照、作品累计数据和矩阵任务。平台自动同步尚未接通；目前已有数据为带日期的历史快照，可继续记录新数据。本版未接入自动发帖或AI调用。</p><p class="fine" style="margin-top:15px">公开方法来源在IP资料库中，可打开原文。资料库提纲默认待确认，不会代替IP的真实经历和观点。</p><p id="form-error" role="alert"></p>`);}
function pickFile(accept){return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept=accept;input.onchange=()=>resolve(input.files[0]||null);input.addEventListener('cancel',()=>resolve(null));input.click();});}
async function restoreBackup(){const file=await pickFile('.zip');if(!file)return;if(file.size>160*1024*1024)throw Error('备份压缩文件超过160 MiB，请按IP分开恢复');if(!confirm('将从备份新建一个IP，当前IP保留。继续恢复吗？'))return;toast('正在校验并恢复备份…');const p=await api('ip-import',{method:'POST',body:{data:await base64(file)}});ip=p;await reload();render();$('#dialog').close();toast('已恢复为新IP，原IP仍保留');}
const csvColumns=['作品标题','稿件标题','平台','账号','状态','计划发布时间','实际发布时间','作品链接','采集时间','播放阅读数','点赞','评论','分享','收藏','有效咨询','完播率','数据来源','复盘备注'];
function csvTemplate(){download('发布数据导入模板.csv','\ufeff'+Papa.unparse([csvColumns]),'text/csv;charset=utf-8');toast('已下载CSV表头模板；稿件标题须与工作台中的标题完全一致');}
async function csvImport(){
 if(!writable())throw Error('当前账号为只读');const file=await pickFile('.csv');if(!file)return;if(file.size>5*1024*1024)throw Error('CSV最大5 MiB，请分批导入');const parsed=Papa.parse(await file.text(),{header:true,skipEmptyLines:'greedy',transformHeader:h=>h.replace(/^\ufeff/,'').trim()});if(parsed.errors.length)throw Error('CSV格式错误：'+parsed.errors[0].message);const headers=parsed.meta.fields||[];if(!csvColumns.slice(0,5).every(h=>headers.includes(h)))throw Error('请使用提供的CSV模板，至少保留作品标题、稿件标题、平台、账号和状态列');if(!parsed.data.length||parsed.data.length>500)throw Error('每次请导入1至500条记录');
 const recordsToSave=[],errors=[],seen=new Set();
 for(const [i,row]of parsed.data.entries()){try{const get=k=>String(row[k]??'').trim(),matches=active('ip-content').filter(r=>r.title===get('稿件标题'));if(matches.length!==1)throw Error('稿件标题须唯一匹配，请先新建稿件或调整同名稿件');const b={contentId:matches[0].id,platform:get('平台'),account:get('账号'),status:get('状态'),plannedAt:get('计划发布时间'),publishedAt:get('实际发布时间'),url:get('作品链接'),measuredAt:get('采集时间'),views:get('播放阅读数'),likes:get('点赞'),comments:get('评论'),shares:get('分享'),saves:get('收藏'),leads:get('有效咨询'),completion:get('完播率'),dataSource:get('数据来源'),notes:get('复盘备注')};validate('ip-release',b);if(!get('作品标题'))throw Error('作品标题不能为空');const fingerprint=b.url||[b.contentId,b.platform,b.account,b.plannedAt].join('|');if(seen.has(fingerprint)||active('ip-release').some(r=>(r.body.url||[r.body.contentId,r.body.platform,r.body.account,r.body.plannedAt].join('|'))===fingerprint))throw Error('存在重复发布记录，请在原记录中编辑数据');seen.add(fingerprint);recordsToSave.push({kind:'ip-release',title:get('作品标题'),body:b,visibility:'team'});}catch(e){errors.push(`第 ${i+2} 行：${e.message}`);}}
 if(errors.length)throw Error(errors.slice(0,12).join('\n')+(errors.length>12?`\n另有${errors.length-12}处错误`:'')+'\n本次未导入任何记录。');
 modal('确认导入发布数据',`<h2>已校验 ${recordsToSave.length} 条发布记录</h2><p class="fine">全部校验通过后整批保存，不覆盖已有记录。时间格式为 YYYY-MM-DDTHH:mm。</p><div class="note">${esc(recordsToSave.slice(0,8).map(r=>r.title+' · '+r.body.platform+' · '+r.body.account).join('\n'))}${recordsToSave.length>8?'\n…':''}</div><p id="form-error" role="alert"></p><button id="confirm-import" class="primary">确认导入 ${recordsToSave.length} 条</button>`);
 $('#confirm-import').onclick=()=>guarded(async()=>{if(saving)return;saving=true;$('#confirm-import').disabled=true;try{await api(path()+'/records-batch',{method:'POST',body:{records:recordsToSave}});await reload();render();$('#dialog').close();toast('发布数据已整批导入');}finally{saving=false;if($('#confirm-import'))$('#confirm-import').disabled=false;}});
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action,r=byId(el.dataset.id);guarded(async()=>{
 if(saving)return;
 if(action==='matrix-snapshot')return editor('ip-account-snapshot',null,{accountId:el.dataset.id||active('ip-account')[0]?.id||'',measuredOn:localDate(),sourceMode:'人工记录',scope:'平台主页累计'});
 if(action==='matrix-work')return editor('ip-work-snapshot',null,{accountId:active('ip-account')[0]?.id||'',measuredOn:localDate(),sourceMode:'人工记录',scope:'作品当前累计'});
 if(action==='matrix-connection')return modal('数据接入进展',matrixConnectionInfo());
 if(action==='matrix-page'){matrixFilters.page=Math.max(1,matrixFilters.page+Number(el.dataset.step));return render();}
 if(action==='matrix-task')return editor('ip-task',null,{title:el.dataset.title||'账号矩阵工作',status:'待办',notes:el.dataset.notes||'记录目标账号、要做什么、怎样验收。',templateId:'matrix-task-v1'});
 if(action==='new')return editor(el.dataset.kind);
 if(action==='view')return view(r);
 if(action==='edit')return editor(r.kind,r);
 if(action==='new-ip')return ipForm();
 if(action==='rename-ip')return ipForm(true);
 if(action==='refresh'){if(creatorDirty)return toast('分镜还有修改未保存，请先保存。');await reload();render();return toast('已重新读取本机数据');}
 if(action==='help')return help();if(action==='backup')return backup();if(action==='restore-backup')return restoreBackup();
 if(action==='topic-content'){if(r.body.status!=='已确认')throw Error('请先编辑选题，将状态确认为“已确认”后再转稿件');return editor('ip-content',null,{title:r.title,topicId:r.id,audience:r.body.audience,outline:[r.body.angle,r.body.evidence].filter(Boolean).join('\n\n'),status:'写作中'});}
 if(action==='content-shoot'){const start=localTime();return editor('ip-shoot',null,{title:r.title+' · 拍摄',contentId:r.id,start,end:endAfterHour(start),checklist:IPResources.find(r=>r.id==='shoot-v1').template});}
 if(action==='content-final')return editor('ip-finalcheck',null,{title:r.title,contentId:r.id,checks:emptyChecks()});
 if(action==='content-release')return editor('ip-release',null,{title:r.title,contentId:r.id,platform:r.body.platform,plannedAt:localTime(),status:'待发布'});
 if(action==='submit-review')return update(r,{...r.body,status:'待IP审核'},'已送入IP审核列表');
 if(action==='finish-task')return update(r,{...r.body,status:'完成'},'任务已完成');
 if(action==='archive')return update(r,{...r.body,archived:!r.body.archived},r.body.archived?'记录已恢复':'记录已归档，可在列表切换查看');
 if(action==='review-task')return editor('ip-task',null,{title:r.title+' · 后续行动',contentId:r.body.contentId||'',owner:r.body.owner||'',due:r.body.due||'',notes:r.body.next,status:'待办'});
 if(action==='history')return history(r);
 if(action==='restore-version'){const versions=await api(path()+'/records/'+r.id+'/versions'),v=versions.find(v=>v.revision===Number(el.dataset.version));if(!v)throw Error('历史版本不存在');let b=typeof v.body==='string'?JSON.parse(v.body):{...v.body};if(r.kind==='ip-content')b={...b,status:'待IP审核',reviewer:'',reviewedAt:''};return editor(r.kind,{...r,title:v.title||r.title,body:b});}
 if(action==='export-record')return exportRecord(r);
 if(action==='download-draft'){const form=$('#record-form');if(form)return download('未保存草稿-'+localDate()+'.json',JSON.stringify(Object.fromEntries([...new FormData(form)].filter(([,v])=>typeof v==='string')),null,2),'application/json');}
 if(action==='use-template'){const t=IPResources.find(r=>r.id===el.dataset.id);if(active('ip-profile').some(r=>r.body.templateId===t.id))throw Error('这份提纲已加入当前IP，请在资料列表中编辑');return editor('ip-profile',null,{title:t.title,category:t.category,summary:t.template,sourceUrl:t.url,verifiedAt:localDate(),status:'待确认',templateId:t.id,notes:`${t.summary}\n来源：${t.source}\n参考资料查阅日期：2026-10-31；此日期表示查阅来源，不表示IP已确认内容。`});}
 if(action==='csv-template')return csvTemplate();if(action==='csv-import')return csvImport();
 if(action==='month-prev'||action==='month-next'){let [y,m]=calendarMonth.split('-').map(Number);const d=new Date(y,m-1+(action==='month-next'?1:-1),1);calendarMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;render();return;}
 if(action==='month-today'){calendarMonth=localDate().slice(0,7);return render();}
 if(action==='calendar-day'){const day=el.dataset.day,items=active().filter(r=>['ip-event','ip-shoot'].includes(r.kind)?r.body.start.slice(0,10)<=day&&r.body.end.slice(0,10)>=day:r.kind==='ip-task'&&r.body.due===day);modal(day+' 的安排',`<h2>${day}</h2><div class="panel-body">${compactList(items,r=>r.body.start?dateText(r.body.start)+' · '+(r.body.location||'地点待定'):r.body.owner+' · 任务截止',Infinity)}</div>${writable()?`<button class="primary" data-action="day-event" data-day="${day}">＋ 添加当天日程</button>`:''}`);return;}
 if(action==='day-event')return editor('ip-event',null,{start:el.dataset.day+'T09:00',end:el.dataset.day+'T10:00'});
 });});
document.addEventListener('change',e=>{const box=e.target.closest('[data-final-id]');if(!box)return;guarded(async()=>{const r=byId(box.dataset.finalId);if(saving){box.checked=!box.checked;return;}const bits=[...r.body.checks];bits[Number(box.dataset.finalIndex)]=box.checked?'1':'0';document.querySelectorAll('[data-final-id]').forEach(b=>b.disabled=true);try{await update(r,{...r.body,checks:bits.join('')},'成片核对已保存');}catch(err){box.checked=!box.checked;document.querySelectorAll('[data-final-id]').forEach(b=>b.disabled=false);throw err;}});});
document.addEventListener('change',e=>{const box=e.target.closest('[data-check-id]');if(!box)return;guarded(async()=>{const r=byId(box.dataset.checkId);if(saving){box.checked=!box.checked;return;}const lines=r.body.checklist.split('\n').filter(Boolean),i=Number(box.dataset.checkIndex);lines[i]=(box.checked?'[x] ':'[ ] ')+lines[i].replace(/^\s*\[[ x]\]\s*/i,'');try{await update(r,{...r.body,checklist:lines.join('\n')},'准备清单已保存');}catch(err){box.checked=!box.checked;throw err;}});});
document.addEventListener('click',e=>{const a=e.target.closest('[data-file-id]');if(!a)return;e.preventDefault();guarded(async()=>{const r=await api('files/'+a.dataset.fileId,{raw:true});const meta=files.find(f=>f.id===a.dataset.fileId);download(meta?.name||'原始附件',await r.blob());});});
await boot();
