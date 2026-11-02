import {DatabaseSync} from 'node:sqlite';
import {constants} from 'node:fs';
import {mkdir,copyFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from '../practical/modules/creator-workbench/server/store.mjs';
import {fileHash} from '../practical/modules/creator-workbench/server/files.mjs';
import {config} from '../practical/modules/creator-workbench/server/config.mjs';
// A one-time independent copy. Never merges over an existing creative database.
export async function copyCreatorContent({source,target,snapshot}){
 await mkdir(target,{recursive:true,mode:0o700});
 try{await stat(path.join(target,'workbench.sqlite'));throw Error('目标已有创作数据库，未覆盖；请选择新的副本目录。');}catch(e){if(e.code!=='ENOENT')throw e;}
 const src=new DatabaseSync(snapshot||path.join(source,'workbench.sqlite'),{readOnly:true}),cfg=config(['--data',target]),dst=new Store(cfg.db);
 const names=['accounts','topics','topic_history','sources','source_versions','topic_sources','evidence','scripts','script_versions','feeds','feed_runs','hot_events','hot_items','hot_observations','briefs','deliveries','ref_works','ref_topics','daily_digests','creator_checks','comment_observations','public_events','public_event_versions','ip_profiles','opportunities'];
 try{
  const rows=Object.fromEntries(names.map(t=>[t,src.prepare('SELECT * FROM '+t).all()]));
  rows.archive_assets=src.prepare('SELECT * FROM archive_assets WHERE source_id IS NOT NULL').all();
  const settings={};for(const key of ['discovery.media','discovery.collector','discovery.creators','discovery.lastDelivery','workspace.editPlanUrl']){const r=src.prepare('SELECT value FROM settings WHERE key=?').get(key);if(r)settings[key]=JSON.parse(r.value);}
  const available=new Map(src.prepare('SELECT * FROM blobs').all().map(b=>[b.hash,b])),required=new Set();
  function hashes(v){if(typeof v==='string'){if(available.has(v))required.add(v);else if(/^[\[{]/.test(v))try{hashes(JSON.parse(v));}catch{}}else if(Array.isArray(v))v.forEach(hashes);else if(v&&typeof v==='object')Object.values(v).forEach(hashes);}
  hashes(rows);hashes(settings);let bytes=0;
  for(const h of required){const from=path.join(source,'blobs',h),to=path.join(target,'blobs',h);try{await copyFile(from,to,constants.COPYFILE_FICLONE);}catch{await copyFile(from,to);}const actual=await fileHash(to);if(actual.hash!==h||actual.size!==available.get(h).size)throw Error('复制原件校验失败：'+h);bytes+=actual.size;}
  dst.db.exec('PRAGMA foreign_keys=OFF');
  dst.transaction(()=>{rows.blobs=[...required].map(h=>available.get(h));for(const [table,list]of Object.entries(rows)){if(!list.length)continue;const keys=Object.keys(list[0]),insert=dst.db.prepare('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')');for(const r of list)insert.run(...keys.map(k=>r[k]));}for(const [k,v]of Object.entries(settings))dst.set(k,v);dst.set('uiTimezone',Intl.DateTimeFormat().resolvedOptions().timeZone);dst.set('discovery.automation',{linked:false,note:'从原工作台复制的历史资料；未复制或启用第二个定时任务。'});});
  for(const r of rows.sources)dst.reindex(r.id);
  dst.db.exec('PRAGMA foreign_keys=ON');if(dst.db.prepare('PRAGMA foreign_key_check').all().length)throw Error('副本关联校验失败');
  for(const name of ['ui-execution-background.jpg'])try{await copyFile(path.join(source,name),path.join(target,name),constants.COPYFILE_FICLONE);}catch(e){if(e.code!=='ENOENT')throw e;}
  const report={copiedAt:new Date().toISOString(),tables:Object.fromEntries(Object.entries(rows).map(([t,r])=>[t,r.length])),originalFiles:required.size,bytes,sourceUntouched:true,credentialsCopied:false};await writeFile(path.join(target,'copy-receipt.json'),JSON.stringify(report,null,2));return report;
 }finally{src.close();dst.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const a=process.argv.slice(2),get=k=>a[a.indexOf(k)+1];if(!a.includes('--source')||!a.includes('--target'))throw Error('使用 --source 原资料目录 --target 新副本目录 [--snapshot 一致数据库快照]');console.log(JSON.stringify(await copyCreatorContent({source:get('--source'),target:get('--target'),snapshot:a.includes('--snapshot')?get('--snapshot'):undefined}),null,2));}
