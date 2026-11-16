import {uid,now,text,parse,hash} from './store.mjs';
import {saveBuffer} from './files.mjs';

export function normalizeEditorial(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('请填写编辑思考');
  const lines=(v,label)=>{if(!Array.isArray(v)||v.length<1||v.length>6)throw Error(label+'应为1至6项');return v.map(s=>text(s,1000,true));};
  const priority=text(value.priority,20)||'备选';
  if(!['优先','备选','待补资料'].includes(priority))throw Error('无效的选题优先级');
  const result={judgement:text(value.judgement,2000,true),audience:text(value.audience,500,true),angle:text(value.angle,300,true),opening:text(value.opening,1000),outline:lines(value.outline,'展开思路'),needs:lines(value.needs,'待补依据'),priority,reason:text(value.reason,1000,true)};
  if(value.reviewedAt){const d=new Date(value.reviewedAt);if(!Number.isFinite(d.getTime())||d.getTime()>Date.now()+300000)throw Error('分析时间无效');result.reviewedAt=d.toISOString();}
  if(value.retrospective===true)result.retrospective=true;
  return result;
}
export function dailyRow(store,day){
  const row=store.db.prepare('SELECT * FROM daily_digests WHERE day=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(day);
  if(!row)throw Object.assign(Error('该日期尚无早报'),{statusCode:404});
  return {...row,payload:parse(row.payload)};
}
const conflict=()=>Object.assign(Error('早报已有新版本，请刷新后再保存，避免覆盖其他修改'),{statusCode:409});

// 只追加编辑字段；原事实、时间、其他栏目和原版本均保留，不重放评论或采集任务。
export async function saveDailyEditorial(store,dir,body){
  const prior=dailyRow(store,text(body.day,10,true));
  if(!body.baseDigestId||prior.id!==body.baseDigestId)throw conflict();
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)throw Error('每次补充1至50条编辑思考');
  const payload=structuredClone(prior.payload),seen=new Set();let changed=0;
  for(const item of body.items){
    const n=payload.news.find(n=>n.eventId===item.eventId&&n.sources?.[0]?.url===item.sourceUrl);
    if(!n||seen.has(n.eventId))throw Error('热点不存在、来源不符或条目重复');
    seen.add(n.eventId);const editorial=normalizeEditorial(item.editorial);
    const old=n.editorial&&normalizeEditorial(n.editorial);
    const semantic=e=>{if(!e)return '';const {reviewedAt,retrospective,...content}=e;return JSON.stringify(content);};
    if(semantic(old)===semantic(editorial))continue;
    n.editorial={...editorial,reviewedAt:now(),retrospective:body.retrospective===true||editorial.retrospective===true};changed++;
  }
  if(!changed)return {id:prior.id,day:prior.day,changed:0,duplicate:true};
  if(payload.news.filter(n=>n.editorial?.priority==='优先').length>3)throw Error('每天最多突出3个优先题，请先调整其他条目的优先级');
  const at=now();payload.editorialUpdatedAt=at;payload.previousDigestId=prior.id;
  const raw=await saveBuffer(store,dir,Buffer.from(JSON.stringify(payload,null,2)),'热点早报编辑思考.json');
  return store.transaction(()=>{
    if(dailyRow(store,prior.day).id!==prior.id)throw conflict();
    const id=uid();store.db.prepare('INSERT INTO daily_digests VALUES(?,?,?,?,?,?)').run(id,prior.day,hash(JSON.stringify(payload)),raw.hash,JSON.stringify(payload),at);
    return {id,day:prior.day,changed,duplicate:false};
  });
}
