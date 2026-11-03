import fs from 'node:fs';
import path from 'node:path';
import {Store} from './store.mjs';
const cell=v=>Array.isArray(v)?v.map(cell).filter(Boolean).join(' '):v&&typeof v==='object'?String(v.text||v.name||v.url||''):String(v??'');
const pick=(r,keys)=>keys.map(k=>cell(r[k]).trim()).find(Boolean)||'';
export function syncCloudCompetitors(store,sources){
 const old=store.get('comments.cloudCreators')||{},next={},prefs=store.get('discovery.creators')||{},research=store.get('comments.competitorResearch')||{};let added=0;
 for(const source of sources.filter(s=>s.type==='competitors'))for(const r of source.records||[]){
  const name=pick(r,['竞品名称','对标账号','名称','博主名称']),raw=pick(r,['抖音主页','主页链接','账号链接','公开主页','核查入口','作品网址']),url=raw.match(/https?:\/\/[^\s<>]+/)?.[0]||'';
  if(!name||!r.record_id)continue;const key=source.tableId+':'+r.record_id;
  let a=old[key]?store.db.prepare('SELECT * FROM accounts WHERE id=?').get(old[key]):null;
  if(!a)a=store.db.prepare("SELECT * FROM accounts WHERE role='对标' AND name=? AND (url=? OR url='')").get(name,url);
  if(!a){a=store.account({name,url,role:'对标'});prefs[a.id]={follow:true};added++;}
  else{const currentIsDouyin=/douyin\.com\//.test(a.url);store.db.prepare('UPDATE accounts SET name=?,url=? WHERE id=?').run(name,currentIsDouyin?a.url:url||a.url,a.id);}
  next[key]=a.id;
  research[a.id]={target:pick(r,['对标对象','IP']),position:pick(r,['内容定位']),relation:pick(r,['关系类型']),reason:pick(r,['入选理由']),difference:pick(r,['差异与限制']),focus:pick(r,['重点拆解项']),priority:pick(r,['研究优先级']),sourceUrl:source.url||'',tableId:source.tableId,recordId:r.record_id};
 }
 for(const id of new Set(Object.values(old)))if(!Object.values(next).includes(id))prefs[id]={...prefs[id],follow:false};
 store.set('comments.cloudCreators',next);store.set('discovery.creators',prefs);store.set('comments.competitorResearch',research);return {added,total:Object.keys(next).length};
}
export function syncCloudDirectory(root){
 const configPath=path.join(root,'feishu','connection.json'),cachePath=path.join(root,'feishu','cache.json');if(!fs.existsSync(configPath)||!fs.existsSync(cachePath))return [];
 const config=JSON.parse(fs.readFileSync(configPath)),cache=JSON.parse(fs.readFileSync(cachePath)),result=[];
 for(const [id,p]of Object.entries(config.projects||{})){if(!/^[a-f0-9-]{36}$/.test(id))continue;const dir=path.join(root,'creator-modules',id);fs.mkdirSync(dir,{recursive:true,mode:0o700});const store=new Store(path.join(dir,'workbench.sqlite'));
  try{const sources=(cache.sources||[]).filter(s=>(!s.projects||s.projects.includes(id))&&s.type==='competitors').map(s=>({...s,records:(s.records||[]).filter(r=>{const target=pick(r,['对标对象','IP']);return !target||target===p.name;})}));if(sources.length)result.push({projectId:id,...store.transaction(()=>syncCloudCompetitors(store,sources)),sourceCapturedAt:cache.lastSuccess});}finally{store.close();}
 }return result;
}
