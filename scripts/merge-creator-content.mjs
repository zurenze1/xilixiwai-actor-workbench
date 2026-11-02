import {DatabaseSync} from 'node:sqlite';
import {constants} from 'node:fs';
import {copyFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../practical/modules/creator-workbench/server/store.mjs';
import {fileHash} from '../practical/modules/creator-workbench/server/files.mjs';

const safeSettings=['collection.curation','collection.lastCleanup','discovery.media','discovery.collector','discovery.creators','discovery.lastDelivery','operationsContext','studio.conversations','studio.lastImport','studio.videos','workspace.appearance','workspace.archiveProgress','workspace.audit','workspace.editPlanUrl'];
const quote=s=>'"'+s.replaceAll('"','""')+'"';
// Run against an isolated target first. Existing business rows are never replaced.
// Credentials, model configuration, timers and workspace identity are not imported.
export async function mergeCreatorContent({source,target,snapshot,onProgress=()=>{}}){
 if(path.resolve(source)===path.resolve(target))throw Error('源与目标必须分开');
 const src=new DatabaseSync(snapshot||path.join(source,'workbench.sqlite'),{readOnly:true}),dst=new Store(path.join(target,'workbench.sqlite'));
 try{
  if(src.prepare("SELECT value FROM settings WHERE key='schemaVersion'").get()?.value!==JSON.stringify(dst.get('schemaVersion')))throw Error('数据库版本不同，未合并');
  const tables=src.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name).filter(t=>t!=='settings'&&!t.startsWith('source_search'));
  const additions={},existing={},seedDates=[];
  for(const table of tables){
   const cols=src.prepare('PRAGMA table_info('+quote(table)+')').all(),other=dst.db.prepare('PRAGMA table_info('+quote(table)+')').all();
   if(JSON.stringify(cols.map(c=>[c.name,c.type,c.pk]))!==JSON.stringify(other.map(c=>[c.name,c.type,c.pk])))throw Error('结构不一致：'+table);
   const pk=cols.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);if(!pk.length)throw Error('缺少主键：'+table);
   const key=r=>JSON.stringify(pk.map(k=>r[k])),prior=new Map(dst.db.prepare('SELECT * FROM '+quote(table)).all().map(r=>[key(r),r]));
   existing[table]=prior;additions[table]=[];
   for(const row of src.prepare('SELECT * FROM '+quote(table)).all()){
    const old=prior.get(key(row));if(!old){additions[table].push(row);continue;}
    const diff=Object.keys(row).filter(k=>row[k]!==old[k]);
    if(table==='metric_defs'&&diff.length===1&&diff[0]==='created_at'){seedDates.push(key(row));continue;}
    if(diff.length)throw Error('已有内容冲突，未覆盖：'+table+'（'+diff.join('、')+'）');
   }
  }
  if(additions.jobs?.some(r=>['排队','处理中','等待重试'].includes(r.status)))throw Error('源库有未结束任务，先停止写入再迁移');
  const settings=Object.fromEntries(safeSettings.flatMap(k=>{const r=src.prepare('SELECT value FROM settings WHERE key=?').get(k);return r&&!dst.db.prepare('SELECT key FROM settings WHERE key=?').get(k)?[[k,r.value]]:[];}));
  const blobs=src.prepare('SELECT * FROM blobs ORDER BY hash').all();let bytes=0,copied=0;await mkdir(path.join(target,'blobs'),{recursive:true,mode:0o700});
  for(let i=0;i<blobs.length;i++){
   const b=blobs[i];if(!/^[a-f0-9]{64}$/.test(b.hash))throw Error('原件哈希无效');
   const to=path.join(target,'blobs',b.hash);let present=false;try{await stat(to);present=true;}catch(e){if(e.code!=='ENOENT')throw e;}
   if(!present){await copyFile(path.join(source,'blobs',b.hash),to,constants.COPYFILE_EXCL|constants.COPYFILE_FICLONE);copied++;}
   const actual=await fileHash(to);if(actual.hash!==b.hash||actual.size!==b.size)throw Error('原件字节校验失败：'+b.hash);
   bytes+=actual.size;if(i%100===0||i===blobs.length-1)onProgress({verified:i+1,total:blobs.length,bytes,copied});
  }
  dst.transaction(()=>{
   dst.db.exec('PRAGMA defer_foreign_keys=ON');
   for(const [table,rows]of Object.entries(additions)){
    if(!rows.length)continue;const cols=Object.keys(rows[0]),insert=dst.db.prepare('INSERT INTO '+quote(table)+'('+cols.map(quote).join(',')+') VALUES('+cols.map(()=>'?').join(',')+')');
    for(const r of rows)insert.run(...cols.map(k=>r[k]));
   }
   for(const [k,v]of Object.entries(settings))dst.db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(k,v);
   if(dst.db.prepare('PRAGMA foreign_key_check').all().length)throw Error('关联校验失败，已回滚');
  });
  for(const [table,prior]of Object.entries(existing)){
   const cols=dst.db.prepare('PRAGMA table_info('+quote(table)+')').all().filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
   const current=new Map(dst.db.prepare('SELECT * FROM '+quote(table)).all().map(r=>[JSON.stringify(cols.map(k=>r[k])),r]));
   for(const [k,r]of prior)if(JSON.stringify(current.get(k))!==JSON.stringify(r))throw Error('目标原有行改变：'+table);
  }
  for(const r of dst.db.prepare('SELECT id FROM sources').all())dst.reindex(r.id);
  if(dst.db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('数据库完整性检查失败');
  return {added:Object.fromEntries(Object.entries(additions).map(([t,r])=>[t,r.length])),verifiedFiles:blobs.length,verifiedBytes:bytes,copiedFiles:copied,retainedMetricSeedDates:seedDates.length,importedSettingKeys:Object.keys(settings),existingTargetRowsUnchanged:true,credentialsCopied:false};
 }finally{src.close();dst.close();}
}
