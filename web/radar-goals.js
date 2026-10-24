/* Shared manual development plan. Scores belong to the actor/team, not an AI assessment. */
((root)=>{
 'use strict';
 const labels=['现实题材','悬疑','情感戏','肢体 / 舞蹈','喜剧','大银幕','古装','商业价值'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const blank=()=>({period:'未来一年',owner:'',reviewDate:'',rubric:'',updatedAt:'',axes:labels.map((label,i)=>({id:'axis-'+i,label,current:null,target:null,evidence:'',action:''}))});
 const sample=rows=>({...blank(),period:'3年目标',axes:rows.map(([label,current,target],i)=>({id:'axis-'+i,label,current,target,evidence:'',action:''}))});
 function validate(value,{complete=false}={}){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('发展目标格式无效');
  const out={};for(const[key,max]of Object.entries({period:100,owner:200,reviewDate:10,rubric:3000,updatedAt:40})){
   if(typeof value[key]!=='string'||value[key].length>max)throw Error('目标资料字段无效：'+key);out[key]=value[key].trim();
  }
  if(out.reviewDate){const d=new Date(out.reviewDate+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(out.reviewDate)||out.reviewDate.startsWith('0000')||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==out.reviewDate)throw Error('复盘日期须为真实日期');}
  if(!Array.isArray(value.axes)||value.axes.length!==8)throw Error('请保留8个发展维度');
  out.axes=value.axes.map((r,i)=>{
   if(!r||r.id!=='axis-'+i)throw Error('发展维度标识无效');const row={id:r.id};
   for(const[key,max]of Object.entries({label:20,evidence:2000,action:2000})){if(typeof r[key]!=='string'||r[key].length>max)throw Error('第'+(i+1)+'维资料过长或格式不正确');row[key]=r[key].trim();}
   if(!row.label)throw Error('请填写第'+(i+1)+'个维度名称');
   for(const k of['current','target']){if(r[k]!==null&&(!Number.isInteger(r[k])||r[k]<0||r[k]>100))throw Error(row.label+'的评分须为0–100整数，未知可留空');row[k]=r[k];}return row;
  });
  if(new Set(out.axes.map(r=>r.label)).size!==8)throw Error('维度名称不能重复');
  if(complete&&(!out.period||!out.owner))throw Error('请填写目标周期和共同设定者');
  if(complete&&!out.axes.some(r=>r.current!==null||r.target!==null))throw Error('至少填写一个当前值或目标值；未知的可继续留空');
  return out;
 }
 function svg(value){const p=validate(value),rows=p.axes,n=8,R=118,cx=170,cy=158,pt=(i,r)=>[cx+r*Math.sin(i/n*2*Math.PI),cy-r*Math.cos(i/n*2*Math.PI)],series=(key,cls)=>{
  const known=rows.filter(r=>r[key]!==null).length;
  if(known===n)return `<polygon points="${rows.map((r,i)=>pt(i,R*r[key]/100).join(',')).join(' ')}" class="${cls}" data-radar-series="${key}"/>`;
  return rows.map((r,i)=>r[key]===null?'':`<circle cx="${pt(i,R*r[key]/100)[0]}" cy="${pt(i,R*r[key]/100)[1]}" r="3" class="${cls}" data-radar-point="${key}"><title>${esc(r.label)}：${r[key]}</title></circle>`).join('');
 };
 return `<svg viewBox="0 0 340 320" class="radar2 manual-radar" role="img" aria-label="${esc(p.period||'发展目标')}，本人或团队自评"><title>本人或团队自评，非客观测评；空值不补零</title>${[1,.75,.5,.25].map(f=>`<polygon points="${rows.map((_,i)=>pt(i,R*f).join(',')).join(' ')}" class="rg"/>`).join('')}${rows.map((_,i)=>`<line x1="${cx}" y1="${cy}" x2="${pt(i,R)[0]}" y2="${pt(i,R)[1]}" class="rg"/>`).join('')}${series('target','rt')}${series('current','rv')}${rows.map((r,i)=>{const[x,y]=pt(i,R+24);return `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="11" class="rel-label">${esc(r.label)}</text>`;}).join('')}</svg>`;
 }
 function form(value){const p=validate(value);return `<form id="radarGoalsForm" class="radar-goals-form" novalidate><p class="small muted">演员与工作室共同填写。分数使用同一套内部口径；未知留空，目标可以低于当前值。</p><div class="radar-meta-fields"><label>目标周期<input name="period" maxlength="100" value="${esc(p.period)}" placeholder="例如：未来一年 / 2027上半年"></label><label>共同设定者<input name="owner" maxlength="200" value="${esc(p.owner)}" placeholder="演员本人、经纪人、表演指导"></label><label>下次复盘日期（可选）<input name="reviewDate" type="date" value="${esc(p.reviewDate)}"></label></div><label>评分口径与取舍（可选）<textarea name="rubric" maxlength="3000" placeholder="例如：按试镜反馈、作品片段和训练记录讨论，分数仅作团队内部比较">${esc(p.rubric)}</textarea></label><details class="radar-help"><summary>目标怎么定？看一个方法</summary><p>① 先定周期；② 本人和团队对照作品、排练与合作反馈填写当前情况；③ 选少数优先方向；④ 每个目标配一项行动和验收依据；⑤ 约定复盘日，再按结果调整。无需每一项都涨分。</p></details><div class="radar-edit-columns"><div><div class="radar-score-heading"><b>发展维度</b><b>现在</b><b>目标</b></div>${p.axes.map((r,i)=>`<article class="radar-axis" data-radar-axis="${i}"><div class="radar-score-row"><input data-radar-field="label" aria-label="第${i+1}维名称" maxlength="20" value="${esc(r.label)}"><input data-radar-field="current" aria-label="${esc(r.label)}当前评分" type="number" min="0" max="100" step="1" placeholder="未评" value="${r.current??''}"><input data-radar-field="target" aria-label="${esc(r.label)}目标评分" type="number" min="0" max="100" step="1" placeholder="待定" value="${r.target??''}"></div><details><summary>依据与下一步行动</summary><label>现在的依据<textarea data-radar-field="evidence" maxlength="2000" placeholder="作品/排练片段、老师或合作方反馈，注明待核实处">${esc(r.evidence)}</textarea></label><label>下一步行动 / 如何验收<textarea data-radar-field="action" maxlength="2000" placeholder="例如：每周排练一场悬疑独白，月底让表演指导对比录像">${esc(r.action)}</textarea></label></details></article>`).join('')}</div><div class="radar-live" id="radarLivePreview">${svg(p)}<p class="small muted">即时预览 · 保存后才写入。未填写的维度不补零。</p></div></div><p id="radarFormError" class="radar-form-error" role="alert"></p></form>`;}
 function read(form){const data=new FormData(form),p=blank();for(const key of['period','owner','reviewDate','rubric'])p[key]=String(data.get(key)||'');p.axes=[...form.querySelectorAll('[data-radar-axis]')].map((el,i)=>{const row={id:'axis-'+i};for(const key of['label','current','target','evidence','action']){const v=el.querySelector('[data-radar-field="'+key+'"]').value;row[key]=['current','target'].includes(key)?v.trim()===''?null:Number(v):v;}return row;});return validate(p);}
 function markdown(value){const p=validate(value);return ['# 我的发展雷达','','> 演员/工作室手动自评，非客观能力或市场测评。未知值保持空白。','','周期：'+p.period,'共同设定者：'+p.owner,'复盘日期：'+(p.reviewDate||'待约定'),'评分口径：'+(p.rubric||'尚未填写'),'更新时间：'+p.updatedAt,'',...p.axes.flatMap(r=>['## '+r.label,'现在：'+(r.current??'未评')+' / 100','目标：'+(r.target??'待定')+' / 100','依据：'+(r.evidence||'待补充'),'下一步行动：'+(r.action||'待约定'),''])].join('\n');}
 root.ActorRadar=Object.freeze({blank,sample,validate,svg,form,read,markdown});
})(globalThis);
