import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {archiveName} from '../web/ip/archive-model.mjs';
const exec=promisify(execFile),json=async p=>JSON.parse(await readFile(p,'utf8'));
const kinds={'ip-topic':'选题','ip-content':'文案脚本','ip-shoot':'拍摄准备','ip-task':'任务','ip-event':'日程','ip-profile':'IP资料','ip-review':'复盘','ip-deal':'商务合作','ip-finalcheck':'成片核对','ip-release':'发布登记'};
export function feishuService({dataDir,store,enabled=false,runner=exec,intervalMs=600000}){
 const dir=join(dataDir,'feishu'),configFile=join(dir,'connection.json'),cacheFile=join(dir,'cache.json');
 let running=null,timer=null,debounce=null,closed=false,lastError='',lastAttempt='',exportCount=0;
 const write=async(p,v)=>{await mkdir(dir,{recursive:true,mode:0o700});await writeFile(p+'.tmp',JSON.stringify(v,null,2),{mode:0o600});await rename(p+'.tmp',p);};
 const config=async()=>{if(!enabled)return null;try{const c=await json(configFile);if(!isAbsolute(c.cli||'')||!c.profile||!c.baseToken||!c.projects||!Array.isArray(c.sources))throw Error('连接配置不完整');return c;}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 async function command(c,action,args=[],cwd=dir){
  let result;try{result=await runner(c.cli,['base',action,'--profile',c.profile,'--as','user','--base-token',c.baseToken,...args],{cwd,timeout:120000,maxBuffer:16*1024*1024});}catch(e){result={stdout:e.stdout||''};}
  let value;try{value=JSON.parse(result.stdout);}catch{throw Error('飞书CLI未返回有效结果，请检查本机登录');}
  if(value.manifest_version==='v1'&&value.format==='ndjson')return value;
  if(value.ok!==true)throw Error('飞书操作未完成：'+(value.error?.message||value.error?.type||value.code||'请检查登录和原表权限'));
  return value.data;
 }
 async function list(c,tableId){
  const rows=[];let offset='',pages=0;
  do{if(++pages>100)throw Error('数据超过本次同步范围，已保留上一次快照');const file='read-'+tableId+'-'+pages+'.ndjson';
   try{await command(c,'+record-list',['--table-id',tableId,'--format','ndjson','--limit','2000','--output','./'+file,...(offset?['--offset',String(offset)]:[])]);
    const body=await readFile(join(dir,file),'utf8'),m=await json(join(dir,file.replace(/\.ndjson$/,'')+'.manifest.json'));rows.push(...body.split('\n').filter(Boolean).map(x=>JSON.parse(x)));
    if(m.has_more&&!m.next_offset)throw Error('飞书分页缺少下一页位置，未替换旧快照');offset=m.has_more?m.next_offset:'';
   }finally{await Promise.allSettled([rm(join(dir,file),{force:true}),rm(join(dir,file.replace(/\.ndjson$/,'')+'.manifest.json'),{force:true})]);}
  }while(offset);return rows;
 }
 async function snapshots(c){
  const result=[];
  for(const [pid,p]of Object.entries(c.projects)){
   const project=store.get('SELECT * FROM projects WHERE id=?',pid);if(!project)continue;
   const records=store.all('SELECT * FROM records WHERE project_id=?',pid).filter(r=>kinds[r.kind]);
   for(const r of records){const versions=store.all('SELECT revision,title,body,created_at FROM record_versions WHERE record_id=?',r.id);versions.push({revision:r.revision,title:r.title,body:r.body,created_at:r.updated_at});
    for(const v of versions){const b=JSON.parse(v.body);result.push({'名称':archiveName(v.title||r.title,r.created_at,v.revision),'IP':p.name||project.title,'类型':kinds[r.kind],'版本':'V'+v.revision,'状态':b.status||'','归档状态':b.archived?'已归档':'进行中','负责人':b.owner||'','逐字稿':b.script||'','画面与执行':b.shots||b.checklist||'','关联记录':b.contentId||b.topicId||'','更新时间':v.created_at,'本机记录ID':pid+':'+r.id+':V'+v.revision,'内容JSON':JSON.stringify(b)});}
   }
   const storyboardFile=join(dataDir,'creator-modules',pid,'workbench.sqlite');let exists=true;try{await stat(storyboardFile);}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}if(!exists)continue;
   let db;try{db=new DatabaseSync(storyboardFile,{readOnly:true});
    const versions=db.prepare('SELECT v.*,t.title,t.stage,t.created_at topic_created FROM script_versions v JOIN scripts s ON s.id=v.script_id JOIN topics t ON t.id=s.topic_id ORDER BY v.created_at').all();
    for(const v of versions){const payload=JSON.parse(v.payload);result.push({'名称':archiveName(v.title,v.topic_created,v.number),'IP':p.name||project.title,'类型':'分镜执行','版本':'V'+v.number,'状态':v.label,'归档状态':v.stage==='归档'?'已归档':'固定版本','负责人':'','逐字稿':payload.draft.segments.map(s=>s.narration).join('\n\n'),'画面与执行':payload.draft.segments.map((s,i)=>`${i+1}. ${s.shot||''}\n字幕：${s.subtitle||''}\n声音：${s.audioNote||''}`).join('\n\n'),'关联记录':'','更新时间':v.created_at,'本机记录ID':pid+':分镜:'+v.id,'内容JSON':JSON.stringify(payload)});}
   }finally{db?.close();}
  }return result;
 }
 async function refresh(){if(running)return running;running=(async()=>{
  lastAttempt=new Date().toISOString();try{const c=await config();if(!c)return;await mkdir(dir,{recursive:true,mode:0o700});
   const sources=[];for(const s of c.sources)sources.push({...s,records:await list(c,s.tableId)});
   // Append immutable version rows. Read remote keys each time so retry after a crash is idempotent.
   if(c.productionTable){const remote=await list(c,c.productionTable),keys=new Set(remote.map(r=>r['本机记录ID'])),pending=(await snapshots(c)).filter(r=>!keys.has(r['本机记录ID']));
    for(let i=0;i<pending.length;i+=50)await command(c,'+record-batch-create',['--table-id',c.productionTable,'--json',JSON.stringify({create_records:pending.slice(i,i+50)})]);exportCount=pending.length;
   }
   await write(cacheFile,{lastSuccess:new Date().toISOString(),sources});lastError='';
  }catch(e){lastError=String(e.message||e).slice(0,500);throw e;}
 })().finally(()=>{running=null;});return running;}
 async function state(pid){const c=await config();let cache={sources:[]};try{cache=await json(cacheFile);}catch{}return {configured:!!c?.projects?.[pid],connected:!!c?.projects?.[pid]&&!!cache.lastSuccess,sourceUrl:c?.url||'',operator:c?.operator||'',destination:c?.destination||'',lastSuccess:cache.lastSuccess||'',lastAttempt,lastError,refreshing:!!running,exportCount,project:c?.projects?.[pid]?.name||'',sources:(cache.sources||[]).filter(s=>!s.projects||s.projects.includes(pid)).map(s=>({name:s.name,type:s.type,url:s.url,tableId:s.tableId,records:(c?.projects?.[pid]?s.records:[]).filter(r=>!r.IP||r.IP===c?.projects?.[pid]?.name)}))};}
 function schedule(){if(closed||!enabled)return;clearTimeout(debounce);debounce=setTimeout(()=>refresh().catch(()=>{}),1800);debounce.unref?.();}
 function start(){if(!enabled)return;schedule();timer=setInterval(()=>refresh().catch(()=>{}),intervalMs);timer.unref?.();}
 async function close(){closed=true;clearTimeout(timer);clearTimeout(debounce);await running?.catch(()=>{});}
 return {state,refresh,schedule,start,close};
}
