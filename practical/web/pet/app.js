(async()=>{
'use strict';
const KEY='rourou-world-v1',$=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>PetSchema.localDate(),now=()=>new Date().toTimeString().slice(0,5),uid=()=>crypto.randomUUID();
const params=new URLSearchParams(location.search),embedded=params.get('embedded')==='1';
const setTheme=t=>{if(['tide','moss','butter'].includes(t))document.documentElement.dataset.theme=t;};
setTheme(params.get('theme')||'tide');
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='workbench:theme')setTheme(e.data.theme);});
document.body.classList.toggle('embedded',embedded);
let S,client,draftTimer,writes=Promise.resolve(),dirty=false,pending=0,busy=false,importing=false,changeVersion=0;
const status=(s,error=false)=>{$('#storageStatus').textContent=s;$('#storageStatus').classList.toggle('error',error);};
const toast=s=>{const e=$('#toast');e.textContent=s;e.classList.add('on');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('on'),2600);};
const failed=e=>{const s='操作未完成：'+(e?.message||'请重试');status(s,true);toast(s);};
const touch=()=>{dirty=true;changeVersion++;};
const draft=(tab=S.tab)=>(S.drafts[tab]??={});
const fval=(name,defaults={})=>({...defaults,...(draft()[name]||{})});
async function save(){
 clearTimeout(draftTimer);draftTimer=0;touch();
 const version=changeVersion,snapshot=PetSchema.validate(S);
 const task=writes.then(()=>client.save(snapshot));writes=task.catch(()=>{});pending++;
 try{await task;if(version===changeVersion)dirty=false;status(dirty?'新修改待保存…':'已保存 · 当前账号的私人肉肉资料');}
 finally{pending--;}
}
function saveDraft(){touch();status('草稿待保存…');clearTimeout(draftTimer);draftTimer=setTimeout(()=>save().catch(failed),400);}
try{
 if(!window.ActorStore||!window.PetSchema)throw new Error('工作台连接尚未就绪，请刷新重试');
 client=await ActorStore.open(KEY,PetSchema.fresh,PetSchema.validate);S=PetSchema.validate(client.state);
}catch(e){failed(e);$('#main').textContent='资料暂未打开，请先确认工作台已登录。原数据不会被空白页面覆盖。';document.querySelectorAll('.storage-actions button,.storage-actions input').forEach(e=>e.disabled=true);return;}
window.addEventListener('beforeunload',e=>{if(dirty||pending||importing){e.preventDefault();e.returnValue='';}});
window.addEventListener('actor-store-conflict',e=>{if(e.detail?.key===KEY)failed(new Error(e.detail.message));});
window.PetModule=Object.freeze({async whenIdle(){if(busy||importing)throw new Error('肉肉正在保存文件，请稍候再切换项目');if(dirty||draftTimer)await save();await writes;if(dirty)throw new Error('肉肉资料尚未保存，请先重试或导出备份');}});
const urls=new Map();
async function fileURL(ref){if(!urls.has(ref.id))urls.set(ref.id,URL.createObjectURL(await ActorStore.getFile(ref.id)));return urls.get(ref.id);}
window.addEventListener('pagehide',()=>{for(const url of urls.values())URL.revokeObjectURL(url);urls.clear();});
async function previews(){const refs=new Map(PetSchema.references(S).map(x=>[x.id,x]));for(const e of document.querySelectorAll('[data-original]')){try{const ref=refs.get(e.dataset.original);if(!ref)continue;const src=await fileURL(ref);if(e.isConnected)e.src=src;}catch(error){if(e.isConnected){e.alt='原件暂不可读取';e.removeAttribute('src');}status('有照片原件暂不可读取，请检查连接或恢复完整备份',true);}}}
const button=(name,a,v='',cls='')=>`<button class="btn sm ${cls}" data-a="${a}" data-v="${esc(v)}">${name}</button>`;
function field(label,form,key,value='',type='text',extra=''){
 const id=form+'-'+key,at=`id="${id}" data-form="${form}" data-key="${key}" ${extra}`;
 const control=type==='textarea'?`<textarea ${at} rows="3" maxlength="10000">${esc(value)}</textarea>`:`<input ${at} type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':''}>`;
 return `<div class="field"><label for="${id}">${label}</label>${control}</div>`;
}
const empty=s=>`<p class="empty">${s}</p>`;
const dayKey=()=>draft('today').date||today();
const day=()=>Object.hasOwn(S.logs,dayKey())?S.logs[dayKey()]:{food:[],water:0,waterLog:[],walk:[],poop:[],care:{}};
const number=(v,name,optional=false)=>{if(optional&&(v==null||v===''))return null;const n=Number(v);if(!String(v??'').trim()||!Number.isFinite(n)||n<=0)throw new Error(name+'请填写大于0的数值');return n;};
const dueRows=()=>S.health.map(h=>({...h,next:PetSchema.nextDue(h)})).filter(h=>h.next).sort((a,b)=>a.next.localeCompare(b.next));
function metric(label,value,unit,goal){return`<div class="metric"><small>${label}</small><strong>${value}<em>${unit}</em></strong><span>${goal?'自定目标 '+goal+unit:'尚未设置目标'}</span>${goal?`<progress value="${Math.min(value,goal)}" max="${goal}" aria-label="${label}"></progress>`:''}</div>`;}
function vToday(){
 const L=day(),P=S.profile,E=fval('entry',{kind:'food',amount:'',t:now(),s:'正常',note:''});
 const events=[];
 for(const[k,unit,prop,title]of[['food','克','g','喂食'],['waterLog','毫升','ml','加水'],['walk','分钟','m','散步'],['poop','','s','便便']])L[k].forEach((x,i)=>events.push({t:x.t,text:title+' '+x[prop]+unit+(x.note?' · '+x.note:''),k,i}));
 const legacyWater=Math.max(0,L.water-L.waterLog.reduce((n,x)=>n+x.ml,0));if(legacyWater)events.push({t:'—',text:'旧版汇总加水 '+legacyWater+' 毫升（原记录无逐条时间）',k:'legacyWater',i:0});
 const careNames={brush:'梳毛',tear:'眼周清洁',teeth:'刷牙'};for(const[k,t]of Object.entries(L.care))events.push({t,text:careNames[k],k:'care',i:k});
 events.sort((a,b)=>a.t.localeCompare(b.t));
 const reminders=dueRows().filter(h=>PetSchema.remaining(h.next)<=14);
 return`<div class="row between"><div><h2>日常陪伴</h2><p class="sub">按实际发生的日期、时间和数量记录，随时查看过去。</p></div><div class="field"><label for="logDate">查看日期</label><input id="logDate" type="date" value="${esc(dayKey())}"></div></div>
 <div class="metrics mt">${metric('喂食',L.food.reduce((n,x)=>n+x.g,0),'克',P.meals&&P.gram?P.meals*P.gram:null)}${metric('加水量',L.water,'毫升',P.water)}${metric('散步',L.walk.length,'次',P.walk)}</div>
 <p class="sub">加水量是向水碗加入的水量，不能直接当成实际饮水量。目标由你填写。</p>
 <div class="grid2 mt"><section class="card"><h3>记一笔</h3><div class="field mt8"><label for="entry-kind">类型</label><select id="entry-kind" data-form="entry" data-key="kind">${[['food','喂食（克）'],['waterLog','加水（毫升）'],['walk','散步（分钟）'],['poop','便便状态']].map(([k,n])=>`<option value="${k}" ${E.kind===k?'selected':''}>${n}</option>`).join('')}</select></div>
 <div class="grid2 mt8">${field('数量（便便可留空）','entry','amount',E.amount,'number')}${field('发生时间','entry','t',E.t,'time')}</div>
 <div class="field mt8"><label for="entry-s">便便状态（仅便便记录使用）</label><select id="entry-s" data-form="entry" data-key="s">${['正常','偏软','稀便','其他 / 待观察'].map(s=>`<option ${s===E.s?'selected':''}>${s}</option>`).join('')}</select></div>${field('备注','entry','note',E.note)}
 ${button('保存这条记录','daily-add','','pri')}
 <h4 class="mt">护理完成记录</h4><p class="sub">使用上方时间；再次点击可撤销本次护理。</p><div class="row mt8">${Object.entries(careNames).map(([k,n])=>button((L.care[k]?'✓ ':'')+n+(L.care[k]?' '+L.care[k]:''),'care-toggle',k,L.care[k]?'selected':'')).join('')}</div></section>
 <section class="card"><h3>${dayKey()} 的记录</h3>${events.length?`<ul class="records">${events.map(x=>`<li><time>${esc(x.t)}</time><span>${esc(x.text)}</span>${button('移除','daily-remove',x.k+':'+x.i)}</li>`).join('')}</ul>`:empty('这一天还没有记录。')}
 ${reminders.length?`<h4 class="mt">按填写日期生成的提醒</h4><ul class="records">${reminders.map(h=>`<li><span>${esc(h.n)} · ${h.next}${PetSchema.remaining(h.next)<0?'（日期已过）':''}</span></li>`).join('')}</ul>${button('查看健康记录','tab','health')}`:''}</section></div>
 <div class="card mt"><h3>留下一张今天</h3><p class="sub">保存照片和一句话，再把同一张照片做成表情包。</p>${button('存进时光机','tab','album','','')} ${button('打开表情工坊','tab','studio')}</div>`;
}
function vProfile(){
 const P=fval('profile',S.profile);
 return`<section class="card"><h2>肉肉档案</h2><p class="sub">首次使用只预填名字和品种；其余由你确认。目标请按实际照护安排填写。</p>
 <div class="grid2 mt">${field('名字','profile','name',P.name)}${field('品种','profile','breed',P.breed)}${field('生日（不知道可留空）','profile','birth',P.birth,'date')}${field('性别 / 绝育情况','profile','sex',P.sex)}${field('目前主粮','profile','food',P.food)}${field('每天计划几顿','profile','meals',P.meals,'number')}${field('每顿计划多少克','profile','gram',P.gram,'number')}${field('每天加水计划（毫升，可留空）','profile','water',P.water,'number')}${field('每天计划散步次数','profile','walk',P.walk,'number')}</div>${field('照护习惯、禁忌和医生交代','profile','notes',P.notes,'textarea')}
 ${button('保存档案','profile-save','','pri')}<p class="sub">体重请在健康记录按实际称重日期录入，不自动判断健康范围。</p></section>`;
}
function weightChart(){
 const w=S.weights.slice().sort((a,b)=>a.d.localeCompare(b.d)).slice(-20);if(!w.length)return empty('还没有称重记录。填入第一笔后显示真实趋势。');
 const min=Math.min(...w.map(x=>x.kg)),max=Math.max(...w.map(x=>x.kg)),span=Math.max(max-min,.2);
 const first=Date.parse(w[0].d),last=Date.parse(w.at(-1).d),x=i=>first===last?280:48+(Date.parse(w[i].d)-first)/(last-first)*460,y=v=>155-(v-min)/span*105;
 return`<svg class="chart" viewBox="0 0 560 195" role="img" aria-label="最近20笔实际体重记录"><path d="${w.map((v,i)=>(i?'L':'M')+x(i)+','+y(v.kg)).join(' ')}" stroke="var(--accent)" stroke-width="3" fill="none"/>${w.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v.kg)}" r="4" fill="var(--accent)"><title>${v.d} · ${v.kg}公斤</title></circle>`).join('')}<text x="10" y="30">${max} kg</text><text x="10" y="168">${min} kg</text><text x="48" y="190">${w[0].d}</text><text x="508" y="190" text-anchor="end">${w.at(-1).d}</text></svg>`;
}
function vHealth(){
 const H=fval('health',{id:'',n:'',last:'',due:'',every:'',note:''}),W=fval('weight',{id:'',d:today(),kg:'',note:''});
 return`<div class="grid2"><section class="card"><h2>健康与日程</h2><p class="sub">填写医生或照护者确认的项目与日期。提醒在本页面显示；不会自动发送通知。</p>
 ${S.health.length?S.health.map(h=>{const d=PetSchema.nextDue(h);return`<article class="record-block"><div class="row between"><b>${esc(h.n)}</b><span class="tag">${h.source==='legacy-unverified'?'旧版待核实':d?'下次 '+d:'未设提醒'}</span></div><p class="sub">${h.last?'最近完成 '+h.last:'未填写完成日期'}${h.every?' · 周期 '+h.every+' 天':''}</p><p>${esc(h.note)}</p>
 <div class="row">${button('编辑 / 核实','health-edit',h.id)}${h.source!=='legacy-unverified'?button('记录完成','health-complete',h.id):''}${button('移除项目','health-remove',h.id)}</div>
 ${h.history.length?`<details class="mt8"><summary>历次完成记录（${h.history.length}）</summary><ul>${h.history.map(x=>`<li>${x.d} · ${esc(x.note)}</li>`).join('')}</ul></details>`:''}</article>`}).join(''):empty('尚未添加健康项目。不会预填任何疫苗或驱虫记录。')}
 <h3 class="mt">${H.id?'编辑项目':'添加项目'}</h3>${field('项目名称','health','n',H.n)}
 <div class="grid2 mt8">${field('最近完成日期（可留空）','health','last',H.last,'date')}${field('下次日期（优先使用，可留空）','health','due',H.due,'date')}${field('周期天数（可留空）','health','every',H.every,'number')}</div>${field('备注 / 医生建议','health','note',H.note,'textarea')}
 <p class="sub">下次日期留空时，使用“最近完成日期＋周期”。核实保存后才参与提醒。</p><div class="row">${button('保存健康项目','health-save','','pri')}${H.id?button('取消编辑','form-clear','health'):''}</div></section>
 <section class="card"><h3>实际体重</h3>${weightChart()}<p class="sub">曲线来自最近20笔记录，按日期排列，不包含推测值。</p>
 <div class="grid2 mt8">${field('称重日期','weight','d',W.d,'date')}${field('体重（公斤）','weight','kg',W.kg,'number')}</div>${field('称重备注','weight','note',W.note)}<div class="row">${button(W.id?'更新称重':'保存称重','weight-save','','pri')}${W.id?button('取消编辑','form-clear','weight'):''}</div>
 <ul class="records">${S.weights.slice().sort((a,b)=>b.d.localeCompare(a.d)).map(w=>`<li><span>${w.d} · ${w.kg} 公斤<br><small>${esc(w.note)}</small></span><div class="row">${button('编辑','weight-edit',w.id)}${button('移除','weight-remove',w.id)}</div></li>`).join('')}</ul></section></div>`;
}
function vBeh(){
 const B=fval('behaviorForm',{id:'',d:today(),b:typeof draft().behavior==='string'?draft().behavior:'',duration:'',context:'',action:''});
 const last7=S.behLog.filter(x=>x.source==='user'&&PetSchema.remaining(x.d)>=-6&&PetSchema.remaining(x.d)<=0);
 return`<div class="grid2"><section class="card"><h2>行为观察</h2><p class="sub">记录看到的行为、前后情境和后续处理，便于回看或交给医生、训练师。</p>
 <div class="grid2 mt8">${field('发生日期','behaviorForm','d',B.d,'date')}${field('持续多久 / 出现频率','behaviorForm','duration',B.duration)}</div>${field('具体看到了什么','behaviorForm','b',B.b,'textarea')}${field('当时的环境 / 发生前后','behaviorForm','context',B.context,'textarea')}${field('你做了什么 / 后续结果','behaviorForm','action',B.action,'textarea')}
 <div class="row">${button(B.id?'更新行为记录':'保存观察','behavior-save','','pri')}${B.id?button('取消编辑','form-clear','behaviorForm'):''}</div>
 <p class="note">这里只记录事实，不自动给出诊断，也不会把关键词匹配包装成分析。</p></section>
 <section class="card"><h3>观察日记</h3><p class="sub">近7天已确认记录 ${last7.length} 条 · 共保留 ${S.behLog.length} 条</p>
 ${S.behLog.length?S.behLog.slice().sort((a,b)=>b.d.localeCompare(a.d)).map(x=>`<article class="record-block"><div class="row between"><b>${x.d}</b>${x.source==='legacy-unverified'?'<span class="tag">旧版待核实</span>':''}</div><p class="pre">${esc(x.b)}</p><p class="sub pre">${esc([x.duration,x.context,x.action].filter(Boolean).join('\n'))}</p><div class="row">${button('编辑 / 核实','behavior-edit',x.id)}${button('移除','behavior-remove',x.id)}</div></article>`).join(''):empty('还没有行为观察。')}</section></div>`;
}
const contactLabels={ownerName:'主人姓名',ownerPhone:'主人联系电话',assistantName:'助理 / 照顾者',assistantPhone:'照顾者电话',hospitalName:'常去医院',hospitalPhone:'常去医院电话',hospitalAddress:'常去医院地址',emergencyName:'急诊医院',emergencyPhone:'急诊电话',emergencyAddress:'急诊地址',careNote:'交接补充说明'};
function vCare(){
 const P=fval('plan',S.carePlan),C={...S.contacts,...(draft().contacts||{})};
 const due=dueRows().filter(h=>S.carePlan.from&&S.carePlan.to&&h.next>=S.carePlan.from&&h.next<=S.carePlan.to);
 const feed=[S.profile.food,S.profile.meals?'每天 '+S.profile.meals+' 顿':'',S.profile.gram?'每顿 '+S.profile.gram+' 克':''].filter(Boolean).join(' · ');
 return`<section class="card noprint"><div class="row between"><div><h2>出差托管</h2><p class="sub">填写实际安排后，生成可打印的交接卡。</p></div>${button('保存并打印交接卡','print','','pri')}</div>
 <div class="grid2 mt">${field('托管开始日期','plan','from',P.from,'date')}${field('托管结束日期','plan','to',P.to,'date')}${field('托管地点','plan','place',P.place)}${field('本次照顾人','plan','carer',P.carer)}</div>${field('每日安排 / 注意事项','plan','instructions',P.instructions,'textarea')}
 <h3 class="mt">联系信息</h3><div class="grid2 mt8">${PetSchema.contactKeys.filter(k=>k!=='careNote').map(k=>`<div class="field"><label for="contact-${k}">${contactLabels[k]}</label><input id="contact-${k}" data-contact="${k}" type="${k.endsWith('Phone')?'tel':'text'}" value="${esc(C[k])}" maxlength="1000"></div>`).join('')}</div>
 <div class="field mt8"><label for="contact-careNote">交接补充说明</label><textarea id="contact-careNote" data-contact="careNote" maxlength="10000" rows="3">${esc(C.careNote)}</textarea></div>${button('保存托管安排和联系信息','care-save','','pri')}</section>
 <section class="handoff mt"><h2>🐾 ${esc(S.profile.name||'肉肉')}托管卡</h2><p>${S.carePlan.from||'开始日期未填'} 至 ${S.carePlan.to||'结束日期未填'}</p>
 <div class="hgrid mt"><div><h4>本次托管</h4><p class="pre">${esc([S.carePlan.place,S.carePlan.carer].filter(Boolean).join(' · ')||'未填写')}</p><p class="pre">${esc(S.carePlan.instructions||'日常安排未填写')}</p></div><div><h4>吃饭与日常</h4><p>${esc(feed||'饮食安排未填写')}</p><p>${S.profile.water?'每天加水计划 '+S.profile.water+' 毫升':'加水计划未填写'}</p><p>${S.profile.walk?'每天计划散步 '+S.profile.walk+' 次':'散步计划未填写'}</p><p class="pre">${esc(S.profile.notes)}</p></div>
 <div><h4>联系信息</h4>${[['主人','ownerName','ownerPhone'],['照顾者','assistantName','assistantPhone'],['常去医院','hospitalName','hospitalPhone','hospitalAddress'],['急诊医院','emergencyName','emergencyPhone','emergencyAddress']].map(([n,...ks])=>`<p class="pre">${n}：${esc(ks.map(k=>S.contacts[k]).filter(Boolean).join(' · ')||'未填写')}</p>`).join('')}</div>
 <div><h4>托管期间到期的项目</h4>${due.length?due.map(h=>`<p>${esc(h.n)} · ${h.next}</p>`).join(''):'<p>暂无符合本次日期的已确认提醒。</p>'}<p class="pre">${esc(S.contacts.careNote)}</p></div></div>
 <p class="small muted">生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})} · 仅含已保存内容</p></section>`;
}
function vAlbum(){
 const A=draft(),edit=A.editPhoto;
 return`<section class="card"><h2>时光机</h2><p class="sub">保存原照片、实际日期和一句话。选择照片可以直接进入表情工坊。</p><div class="grid2 mt8"><div class="field"><label for="photoCaption">这组照片的一句话</label><input id="photoCaption" value="${esc(A.photoCaption||'')}" maxlength="5000"></div><div class="field"><label for="photoDate">照片日期</label><input id="photoDate" type="date" value="${esc(A.photoDate||today())}"></div></div>
 <label class="btn pri mt8">添加照片原件<input type="file" id="ph" multiple accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><p class="sub">JPG / PNG / WebP / GIF；保留上传原件。GIF生成表情包时导出静态PNG。</p></section>
 ${edit?`<section class="card mt"><h3>编辑照片说明</h3>${field('一句话','editPhoto','c',edit.c)}${field('照片日期','editPhoto','d',edit.d,'date')}<div class="row">${button('保存说明','photo-save','','pri')}${button('取消','form-clear','editPhoto')}</div></section>`:''}
 <div class="album mt">${S.photos.slice().sort((a,b)=>b.d.localeCompare(a.d)).map(p=>`<article class="ph"><img ${p.file?`data-original="${esc(p.file.id)}"`:`src="${p.src}"`} alt="${esc(p.c||'肉肉的照片')}" loading="lazy"><div><p class="pre">${esc(p.c)}</p><small>${esc(p.d)}</small><small>${p.file?'原件 · '+esc(p.file.name):'旧版照片副本，无法恢复上传前原件'}</small><div class="file-actions">${button('做成表情包','photo-sticker',p.id,'pri')}${button('编辑说明','photo-edit',p.id)}${button(p.file?'下载原件':'下载副本','photo-download',p.id)}${button('移除','photo-remove',p.id)}</div></div></article>`).join('')}</div>${!S.photos.length?empty('还没有照片。存下第一张，就能在这里按日期找回。'):''}`;
}
function vStudio(){
 const P=S.photos.find(x=>x.id===S.studio.photoId);
 return`<div class="grid2"><section class="card"><h2>表情工坊</h2><p class="sub">使用时光机保存的同一张照片，加字并导出720×720 PNG。原照片保持原样。</p>
 ${S.photos.length?`<div class="field mt"><label for="studio-photoId">选择照片</label><select id="studio-photoId" data-studio="photoId"><option value="">请选择时光机照片</option>${S.photos.map(p=>`<option value="${esc(p.id)}" ${P?.id===p.id?'selected':''}>${esc(p.d+' · '+(p.c||p.file?.name||'照片'))}</option>`).join('')}</select></div>
 <div class="field mt8"><label for="studio-caption">表情文字（建议24字以内）</label><textarea id="studio-caption" data-studio="caption" rows="2" maxlength="100">${esc(S.studio.caption)}</textarea></div>
 <div class="grid2 mt8"><div class="field"><label for="studio-layout">排版</label><select id="studio-layout" data-studio="layout">${[['bottom','文字在下'],['top','文字在上'],['square','叠在照片上']].map(([k,n])=>`<option value="${k}" ${S.studio.layout===k?'selected':''}>${n}</option>`).join('')}</select></div><div class="field"><label for="studio-background">背景色</label><input id="studio-background" data-studio="background" type="color" value="${S.studio.background}"></div></div>
 <div class="row mt">${button('导出PNG表情包','sticker-export','','pri')}${button('回时光机','tab','album')}</div>`:`<p class="empty">先在时光机保存一张照片。</p>${button('去存照片','tab','album','','pri')}`}</section>
 <section class="card"><h3>导出预览</h3><canvas id="stickerCanvas" width="720" height="720" aria-label="表情包预览"></canvas><p id="stickerStatus" class="sub">${P?'正在生成预览…':'选择照片后显示预览。'}</p></section></div>`;
}
function notes(){
 const rows=S.notes[S.tab]||[];
 return`<section class="card mt notes noprint"><h3>本页补充记录与附件</h3><p class="sub">可以保存疫苗本、体检报告或交接资料原件。</p><div class="field mt8"><label for="noteIn">记录草稿</label><textarea id="noteIn" rows="3" maxlength="100000">${esc(draft().note||'')}</textarea></div><div class="row mt8"><label class="btn sm">添加附件原件<input type="file" id="noteFile" multiple hidden></label>${button('保存文字记录','note-save','','pri')}</div>
 <ul class="records">${rows.map((n,i)=>`<li><span class="pre">${n.attachment&&/^image\/(png|jpeg|webp|gif)$/.test(n.attachment.type)?`<img class="file-preview" data-original="${esc(n.attachment.id)}" alt="附件">`:n.img?`<img class="file-preview" src="${n.img}" alt="旧版缩略图">`:''}${esc(n.text)}<small class="muted"> · ${esc(n.at)}</small>${n.file&&!n.attachment?'<small> · 旧版原件未存入，可重新导入</small>':''}</span><div class="row">${n.attachment?button('下载原件','file-download',n.attachment.id):''}${button('移除','note-remove',i)}</div></li>`).join('')}</ul></section>`;
}
const TABS=[['today','🐾 日常陪伴'],['profile','📖 肉肉档案'],['health','💉 健康记录'],['beh','✍ 行为观察'],['care','🧳 出差托管'],['album','📷 时光机'],['studio','☺ 表情工坊']];
const VIEWS={today:vToday,profile:vProfile,health:vHealth,beh:vBeh,care:vCare,album:vAlbum,studio:vStudio};
function render(){
 const weight=S.weights.slice().sort((a,b)=>b.d.localeCompare(a.d))[0],P=S.profile;
 $('#badges').innerHTML=`<span class="badge">${esc(P.breed||'品种未填')}</span><span class="badge">生日 ${P.birth||'未填写'}</span><span class="badge">${weight?weight.kg+' 公斤 · '+weight.d:'体重未记录'}</span>`;
 $('#tabs').innerHTML=TABS.map(([k,n])=>`<button data-a="tab" data-v="${k}" class="${S.tab===k?'on':''}" aria-current="${S.tab===k?'page':'false'}">${n}</button>`).join('');
 $('#main').innerHTML=(S.legacyNotice?`<div class="legacy-banner noprint">已保留旧版导入资料。旧版健康、行为记录可能含示例，核实保存后再作为真实记录使用。${button('已知晓','legacy-dismiss')}</div>`:'')+VIEWS[S.tab]()+notes();
 previews();if(S.tab==='studio')drawSticker().catch(e=>{if($('#stickerStatus'))$('#stickerStatus').textContent=e.message;});
 if(embedded)parent.postMessage({type:'pet:tab',tab:S.tab},location.origin);
}
let drawing=0;
async function drawSticker(target){
 const run=++drawing,photo=S.photos.find(x=>x.id===S.studio.photoId),options={...S.studio};
 if(!photo){if($('#stickerStatus'))$('#stickerStatus').textContent='先选择一张照片。';return null;}
 const src=photo.file?await fileURL(photo.file):photo.src,canvas=target||document.createElement('canvas');
 await PetSticker.draw(canvas,src,options);
 if(!target&&run===drawing&&S.tab==='studio'){
  const visible=$('#stickerCanvas');if(visible){visible.width=720;visible.height=720;visible.getContext('2d').drawImage(canvas,0,0);$('#stickerStatus').textContent='720 × 720 PNG · '+(photo.file?'使用已保存照片原件':'使用旧版照片副本');}
 }
 return canvas;
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}

function validDate(value,label,actual=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw new Error(label+'请填写有效日期');
 if(actual&&value>today())throw new Error(label+'不能晚于今天');return value;
}
function deleteRecord(rows,id){const i=rows.findIndex(x=>x.id===id);if(i<0)throw new Error('记录已不存在，请刷新');rows.splice(i,1);}
async function saveCare(){
 S.carePlan={...S.carePlan,...(draft('care').plan||{})};S.contacts={...S.contacts,...(draft('care').contacts||{})};
 const checked=PetSchema.validate(S);S.carePlan=checked.carePlan;delete draft('care').plan;delete draft('care').contacts;await save();
}
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.form){const name=el.dataset.form;draft()[name]={...(draft()[name]||{}),[el.dataset.key]:el.value};}
 else if(el.dataset.contact)(draft('care').contacts??={})[el.dataset.contact]=el.value;
 else if(el.dataset.studio){S.studio[el.dataset.studio]=el.value;drawSticker().catch(error=>{if($('#stickerStatus'))$('#stickerStatus').textContent=error.message;});}
 else if(el.id==='noteIn')draft().note=el.value;
 else if(el.id==='photoCaption')draft('album').photoCaption=el.value;
 else if(el.id==='photoDate')draft('album').photoDate=el.value;
 else return;
 saveDraft();
});
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-a]');if(!el)return;
 if(busy||importing){toast('正在保存，请稍候再操作');return;}
 const a=el.dataset.a,v=el.dataset.v;busy=true;el.disabled=true;
 try{
 switch(a){
 case'tab':{const old=S.tab;S.tab=v;try{await save();}catch(error){S.tab=old;throw error;}render();break;}
 case'legacy-dismiss':S.legacyNotice=false;await save();render();break;
 case'profile-save':{
  const P=fval('profile',S.profile);if(!P.name.trim())throw new Error('请填写名字');if(P.birth)validDate(P.birth,'生日',true);
  for(const k of ['meals','gram','water','walk'])P[k]=number(P[k],k==='gram'?'每顿克数':k==='water'?'加水计划':'次数',true);
  for(const k of ['meals','walk'])if(P[k]!==null&&!Number.isInteger(P[k]))throw new Error('每天次数请填写整数');
  S.profile=P;delete draft().profile;await save();render();toast('档案已保存');break;
 }
 case'daily-add':{
  const d=validDate(dayKey(),'记录日期',true),E=fval('entry',{kind:'food',amount:'',t:now(),s:'正常',note:''});
  if(!['food','waterLog','walk','poop'].includes(E.kind))throw new Error('请选择记录类型');
  const L=S.logs[d]??={food:[],water:0,waterLog:[],walk:[],poop:[],care:{}},item={t:E.t,note:E.note||''};
  if(E.kind==='poop')item.s=E.s;else item[{food:'g',waterLog:'ml',walk:'m'}[E.kind]]=number(E.amount,'数量');
  L[E.kind].push(item);if(E.kind==='waterLog')L.water+=item.ml;
  draft().entry={kind:E.kind,amount:'',t:now(),s:E.s,note:''};await save();render();toast('已保存实际记录');break;
 }
 case'care-toggle':{
  const d=validDate(dayKey(),'护理日期',true),L=S.logs[d]??={food:[],water:0,waterLog:[],walk:[],poop:[],care:{}};
  if(L.care[v])delete L.care[v];else L.care[v]=fval('entry',{t:now()}).t;
  await save();render();break;
 }
 case'daily-remove':{
  if(!confirm('移除这一条记录？'))break;
  const [kind,index]=v.split(':'),L=S.logs[dayKey()];if(!L)throw new Error('记录已不存在');
  if(kind==='care')delete L.care[index];else if(kind==='legacyWater')L.water=L.waterLog.reduce((n,x)=>n+x.ml,0);else{const removed=L[kind].splice(Number(index),1)[0];if(kind==='waterLog')L.water=Math.max(0,L.water-(removed?.ml||0));}
  await save();render();break;
 }
 case'health-edit':{
  const h=S.health.find(x=>x.id===v);if(!h)throw new Error('项目已不存在');
  draft().health=Object.fromEntries(['id','n','last','due','every','note'].map(k=>[k,String(h[k]??'')]));await save();render();$('#health-n').focus();break;
 }
 case'health-save':{
  const H=fval('health',{id:'',n:'',last:'',due:'',every:'',note:''});if(!H.n.trim())throw new Error('请填写项目名称');
  if(H.last)validDate(H.last,'最近完成日期',true);if(H.due)validDate(H.due,'下次日期');
  const every=number(H.every,'周期',true);if(every!==null&&!Number.isInteger(every))throw new Error('周期请填写整数天');
  if(every&&!H.last&&!H.due)throw new Error('按周期提醒需填写最近完成日期，或直接填写下次日期');
  const old=S.health.find(x=>x.id===H.id),history=[...(old?.history||[])];
  for(const d of [old?.last,H.last].filter(Boolean))if(!history.some(x=>x.d===d))history.push({d,note:old?.last===d?old.note:H.note});
  const value={id:H.id||uid(),ic:old?.ic||'📋',n:H.n.trim(),last:H.last,due:H.due,every,note:H.note,source:'user',history};
  if(old)Object.assign(old,value);else S.health.push(value);delete draft().health;await save();render();toast('已保存，提醒按所填日期计算');break;
 }
 case'health-complete':{
  const h=S.health.find(x=>x.id===v);if(!h)throw new Error('项目已不存在');
  const d=prompt('实际完成日期（YYYY-MM-DD）',today());if(d===null)break;validDate(d,'完成日期',true);
  if(h.last&&d<h.last)throw new Error('这次日期早于最近完成日期，请使用编辑项目核对历史');
  if(h.last&&!h.history.some(x=>x.d===h.last))h.history.push({d:h.last,note:h.note});
  if(!h.history.some(x=>x.d===d))h.history.push({d,note:h.note});h.last=d;h.due='';h.source='user';await save();render();toast(h.every?'已保存完成记录并重算提醒':'已保存完成记录；单次提醒已清除');break;
 }
 case'health-remove':if(confirm('移除此健康项目和其完成历史？建议先导出备份。')){deleteRecord(S.health,v);if(draft().health?.id===v)delete draft().health;await save();render();}break;
 case'weight-edit':{const w=S.weights.find(x=>x.id===v);if(!w)throw new Error('称重记录已不存在');draft().weight=Object.fromEntries(Object.entries(w).map(([k,x])=>[k,String(x)]));await save();render();break;}
 case'weight-save':{
  const W=fval('weight',{id:'',d:today(),kg:'',note:''});validDate(W.d,'称重日期',true);const kg=number(W.kg,'体重'),old=S.weights.find(x=>x.id===W.id),value={id:W.id||uid(),d:W.d,kg,note:W.note};
  if(old)Object.assign(old,value);else S.weights.push(value);delete draft().weight;await save();render();toast('已保存称重');break;
 }
 case'weight-remove':if(confirm('移除此称重记录？')){deleteRecord(S.weights,v);if(draft().weight?.id===v)delete draft().weight;await save();render();}break;
 case'behavior-edit':{
  const b=S.behLog.find(x=>x.id===v);if(!b)throw new Error('观察已不存在');
  draft().behaviorForm=Object.fromEntries(['id','d','b','duration','context','action'].map(k=>[k,String(b[k]??'')]));await save();render();break;
 }
 case'behavior-save':{
  const B=fval('behaviorForm',{id:'',d:today(),b:typeof draft().behavior==='string'?draft().behavior:'',duration:'',context:'',action:''});if(!B.b.trim())throw new Error('先填写看到了什么');validDate(B.d,'发生日期',true);
  const old=S.behLog.find(x=>x.id===B.id),value={...B,id:B.id||uid(),b:B.b.trim(),source:'user'};if(old)Object.assign(old,value);else S.behLog.push(value);
  delete draft().behaviorForm;delete draft().behavior;await save();render();toast('观察已保存');break;
 }
 case'behavior-remove':if(confirm('移除此行为观察？')){deleteRecord(S.behLog,v);if(draft().behaviorForm?.id===v)delete draft().behaviorForm;delete draft().behavior;await save();render();}break;
 case'care-save':await saveCare();render();toast('托管安排已保存');break;
 case'print':await saveCare();render();window.print();break;
 case'form-clear':delete draft()[v];await save();render();break;
 case'photo-edit':{
  const p=S.photos.find(x=>x.id===v);if(!p)throw new Error('照片不存在');draft().editPhoto={id:p.id,c:p.c,d:/^\d{4}-\d{2}-\d{2}$/.test(p.d)?p.d:''};await save();render();break;
 }
 case'photo-save':{
  const E=draft().editPhoto,p=S.photos.find(x=>x.id===E?.id);if(!p)throw new Error('照片不存在');validDate(E.d,'照片日期',true);p.c=E.c;p.d=E.d;delete draft().editPhoto;await save();render();toast('照片说明已更新');break;
 }
 case'photo-sticker':if(!S.photos.some(x=>x.id===v))throw new Error('照片不存在');S.studio.photoId=v;S.tab='studio';await save();render();break;
 case'photo-download':{const p=S.photos.find(x=>x.id===v);if(!p)throw new Error('照片不存在');if(p.file)await ActorStore.downloadFile(p.file.id);else download(await(await fetch(p.src)).blob(),'肉肉旧版照片副本.png');break;}
 case'photo-remove':if(confirm('从时光机移除此照片？已导出的备份保留，服务器原件不在此操作中永久删除。')){deleteRecord(S.photos,v);if(S.studio.photoId===v)S.studio.photoId='';if(draft().editPhoto?.id===v)delete draft().editPhoto;await save();render();}break;
 case'sticker-export':{
  if(!S.photos.some(x=>x.id===S.studio.photoId))throw new Error('先选择一张照片');
  await save();const canvas=await drawSticker(document.createElement('canvas'));if(!canvas)throw new Error('照片预览尚未就绪');
  download(await PetSticker.png(canvas),'肉肉表情-'+today()+'.png');toast('已生成PNG，请在下载列表查看');break;
 }
 case'note-save':{
  const t=draft().note?.trim();if(!t)throw new Error('先填写记录');(S.notes[S.tab]??=[]).push({at:new Date().toLocaleString('zh-CN',{hour12:false}),text:t});draft().note='';await save();render();toast('补充记录已保存');break;
 }
 case'note-remove':if(confirm('移除此条补充记录？')){S.notes[S.tab].splice(Number(v),1);await save();render();}break;
 case'file-download':await ActorStore.downloadFile(v);break;
 case'backup':{
  clearTimeout(draftTimer);draftTimer=0;await writes;const doc=await PetBackup.export(S);download(new Blob([JSON.stringify(doc)],{type:'application/json'}),'肉肉完整备份-'+today()+'.json');toast('已生成包含当前草稿和原件的备份');break;
 }
 case'retry':await save();render();toast('已重新保存');break;
 case'reload':{
  if(!confirm('重新读取会替换本页未保存内容。需要保留时，请先取消并导出完整备份。继续？'))break;
  clearTimeout(draftTimer);draftTimer=0;await writes;await client.reload();S=PetSchema.validate(client.state);dirty=false;render();status('已读取当前账号保存记录');break;
 }
 }
 }catch(error){failed(error);}
 finally{busy=false;if(el.isConnected)el.disabled=false;}
});
async function checkImage(file){
 if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('照片请选择 JPG、PNG、WebP 或 GIF');
 if(file.size>32*1024*1024)throw new Error('单个原件不能超过32 MB');
 const u=URL.createObjectURL(file),img=new Image();try{img.src=u;await img.decode();if(img.naturalWidth*img.naturalHeight>64000000)throw new Error('图片像素过大，请换用较小照片，原文件不会改动');}finally{URL.revokeObjectURL(u);}
}
document.addEventListener('change',async e=>{
 const el=e.target;
 if(el.id==='logDate'){
  try{validDate(el.value,'查看日期');draft('today').date=el.value;await save();render();}catch(error){failed(error);}return;
 }
 if(!['noteFile','ph','petBackup'].includes(el.id)||!el.files?.length)return;
 if(busy||importing){el.value='';toast('正在保存，请稍候再选择文件');return;}
 importing=true;const files=[...el.files],mode=el.id,tab=S.tab;status('正在校验并保存原件…');
 try{
  clearTimeout(draftTimer);draftTimer=0;await writes;
  if(mode==='petBackup'){
   if(files[0].size>240*1024*1024)throw new Error('备份文件过大，最多240 MB');
   const doc=JSON.parse(await files[0].text()),checked=await PetBackup.validate(doc);
   if(!confirm('已校验肉肉备份：'+checked.pet.photos.length+' 张照片、'+checked.files.length+' 份原件。将替换当前账号的肉肉资料。建议先导出当前备份。继续？')){status('已取消恢复，当前记录保留');return;}
   await PetBackup.restore(doc,client);await client.reload();S=PetSchema.validate(client.state);dirty=false;render();status('肉肉资料与原件已恢复');toast('恢复完成');return;
  }
  if(mode==='ph')validDate(draft(tab).photoDate||today(),'照片日期',true);
  const staged=[];
  for(const file of files){if(file.size>32*1024*1024)throw new Error('单个原件不能超过32 MB');if(mode==='ph')await checkImage(file);staged.push({file,ref:await ActorStore.putFile(file)});}
  for(const{file,ref}of staged){
   if(mode==='ph')S.photos.push({id:uid(),file:ref,c:draft(tab).photoCaption?.trim()||file.name,d:draft(tab).photoDate||today()});
   else(S.notes[tab]??=[]).push({at:new Date().toLocaleString('zh-CN',{hour12:false}),text:file.name,attachment:ref});
  }
  await save();render();toast('已保存 '+staged.length+' 份原件');
 }catch(error){failed(error);}
 finally{importing=false;if(el.isConnected)el.value='';}
});
render();status('已打开当前账号的肉肉资料 · 草稿自动保存');
})();
