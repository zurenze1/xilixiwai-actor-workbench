// Rules are the current IP's private source record, never a bundled blacklist.
export const RULEBOOK_TEMPLATE='platform-risk-handbook-v1';
const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const links=line=>[...line.matchAll(/\[((?:[^\[\]]|\[[^\]]*\])+)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>({title:m[1],url:safeUrl(m[2])})).filter(x=>x.url);
export function parseRulebook(markdown){
 const rules=[],guides={抖音:[],小红书:[]};let inLibrary=false,category='',platform='',current=[];
 for(const line of String(markdown||'').split(/\r?\n/)){
  if(line.startsWith('# ')){inLibrary=line.includes('高风险词与表达分类库');category='';current=[];platform=line.includes('抖音专项')?'抖音':line.includes('小红书专项')?'小红书':'';}
  if(inLibrary&&line.startsWith('## ')){category=line.slice(3).trim();current=[];}
  if(inLibrary&&category&&line.startsWith('|')){
   const cells=line.split(/(?<!\\)\|/).slice(1,-1).map(x=>x.trim().replace(/\\\|/g,'|'));
   if(cells.length===3&&cells[0]&&cells[0]!=='检索词 / 表达线索'&&!/^[-: ]+$/.test(cells[0])){
    const rule={category,expression:cells[0],condition:cells[1],advice:cells[2],sources:[]};rules.push(rule);current.push(rule);
   }
  }
  if(inLibrary&&line.startsWith('依据与适用范围：'))for(const r of current)r.sources=links(line);
  if(platform&&line.startsWith('- '))guides[platform].push(line.slice(2));
 }
 return {rules,guides,categories:new Set(rules.map(r=>r.category)).size};
}
const ordinaryRow=r=>/这些不是全网一律禁止|产品名和技术讨论并非|词本身不能证明违规|正常技术或行业讨论/.test(r.condition+' '+r.advice);
const words=r=>r.expression.split(/[、，]/).map(w=>w.replace(/^[“「]|[”」]$/g,'').trim()).filter(w=>w.length>=2&&!w.includes('/'));
export function scanContent(fields,book,platform){
 if(!['抖音','小红书'].includes(platform))throw Error('请选择抖音或小红书');
 const hits=[];
 for(const field of fields){const text=String(field.text||''),lower=text.toLowerCase();
  for(const rule of book.rules){
   if(ordinaryRow(rule))continue;
   const found=words(rule).map(word=>({word,index:lower.indexOf(word.toLowerCase())})).filter(x=>x.index>=0).sort((a,b)=>a.index-b.index);
   if(!found.length)continue;
   const {word,index}=found[0],from=Math.max(0,index-28),to=Math.min(text.length,index+word.length+45);
   hits.push({...rule,field:field.key,label:field.label,word,index,before:text.slice(from,index),after:text.slice(index+word.length,to),platform});
  }
 }
 // This is recall against source phrases, not a semantic platform verdict.
 return {platform,hits,guides:book.guides[platform]||[]};
}
export function rulebookRecord(records){return records.find(r=>r.kind==='ip-profile'&&!r.body.archived&&r.body.templateId===RULEBOOK_TEMPLATE);}
export function riskPanelHTML(record,esc){
 if(!record)return '<section class="risk-panel"><h3>发布前文案检查</h3><p>当前IP尚未载入风险词表。可在IP资料库添加来源规则后检查。</p></section>';
 const book=parseRulebook(record.body.summary),url=safeUrl(record.body.sourceUrl);
 return `<section class="risk-panel" aria-label="发布前文案检查"><div class="risk-panel-head"><div><h3>发布前文案检查</h3><p class="fine">${book.categories} 类 · ${book.rules.length} 组表达 · 规则核验 ${esc(record.body.verifiedAt||'日期未记录')}</p></div>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">飞书原表 ↗</a>`:''}</div><div class="actions"><button type="button" data-risk-platform="抖音">抖音扫描</button><button type="button" data-risk-platform="小红书">小红书扫描</button><span class="fine">输入后自动更新当前平台结果</span></div><div id="risk-results" aria-live="polite"></div><p class="fine">本地词句扫描帮助定位线索，需结合原表条件核对语境；本次检查文字。</p></section>`;
}
export function attachRiskPanel(form,record,{esc}={}){
 if(!record)return;
 const book=parseRulebook(record.body.summary),out=form.querySelector('#risk-results');if(!out)return;
 let platform=form.elements.platform?.value==='小红书'?'小红书':'抖音',timer;
 const fields=()=>[['title','标题'],['hook','标题与开头'],['script','正文 / 逐字稿'],['cta','结尾引导']].map(([key,label])=>({key,label,text:form.elements[key]?.value||''}));
 function render(){
  const result=scanContent(fields(),book,platform);
  form.querySelectorAll('[data-risk-platform]').forEach(b=>{const selected=b.dataset.riskPlatform===platform;b.classList.toggle('primary',selected);b.setAttribute('aria-pressed',String(selected));});
  const hasText=fields().some(f=>f.text.trim());
  if(!book.rules.length){out.innerHTML='<p class="note error">词表未能解析，请核对来源内容；尚未完成扫描。</p>';return;}
  out.innerHTML=`<h4>${platform} · ${!hasText?'等待输入':result.hits.length?`发现 ${result.hits.length} 处待核对线索`:'未命中词表中的表达线索'}</h4>${result.hits.length?`<ol class="risk-hits">${result.hits.map((h,i)=>`<li><div class="risk-hit-title"><strong>${esc(h.category)}</strong><button type="button" class="subtle" data-risk-locate="${i}">定位${esc(h.label)}</button></div><p class="risk-quote">${esc(h.before)}<mark>${esc(h.word)}</mark>${esc(h.after)}</p><p><b>何时有风险：</b>${esc(h.condition)}</p><p><b>处理与例外：</b>${esc(h.advice)}</p><div class="risk-sources">${h.sources.filter(s=>!(/抖音/.test(s.title)&&platform==='小红书')&&!(/小红书/.test(s.title)&&platform==='抖音')).map(s=>`<a target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.title)} ↗</a>`).join('')}</div></li>`).join('')}</ol>`:''}<details class="platform-guide"><summary>${platform}专项核对（来自原表）</summary><ul>${result.guides.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></details>`;
  out.querySelectorAll('[data-risk-locate]').forEach(b=>b.onclick=()=>{const h=result.hits[Number(b.dataset.riskLocate)],el=form.elements[h.field];el.focus();el.setSelectionRange(h.index,h.index+h.word.length);el.scrollIntoView({block:'center',behavior:'smooth'});});
 }
 form.querySelectorAll('[data-risk-platform]').forEach(b=>b.onclick=()=>{clearTimeout(timer);platform=b.dataset.riskPlatform;render();});
 form.addEventListener('input',e=>{if(['title','hook','script','cta'].includes(e.target.name)){clearTimeout(timer);timer=setTimeout(()=>{if(form.isConnected)render();},180);}});
 form.elements.platform?.addEventListener('change',e=>{if(['抖音','小红书'].includes(e.target.value)){platform=e.target.value;render();}});
 render();
}
