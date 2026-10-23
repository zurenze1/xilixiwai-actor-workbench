import {KINDS,validateRecord,references,validateRelations} from '../web/social/model.js';
import {fail} from './database.mjs';
export const isSocialKind=kind=>KINDS.includes(kind);

// A batch contains independent records; an error or stale revision rolls back all rows.
export function socialService(store,files){
 function save({pid,studio,user,records,mode='upsert'}){
  if(mode!=='upsert'||!Array.isArray(records)||!records.length||records.length>10000)fail('每次保存1至10000条运营记录；CSV每次最多500行');
  if(Buffer.byteLength(JSON.stringify(records))>20*1024*1024)fail('运营记录清单超过20 MB，请分册备份',413);
  if(store.project(pid,studio,user,true).data.internal!=='social')fail('内容与账号运营记录必须在运营资料空间保存');
  return store.transaction(()=>{
   const existing=store.listRecords(pid,studio,user).filter(r=>isSocialKind(r.kind));
   const allowedFiles=new Map(files.list(pid,studio,user).map(f=>[f.id,f]));
   const touched=new Set(),changes=[];
   for(const raw of records){
    if(!raw||!isSocialKind(raw.kind))fail('运营记录类型无效');
    if(raw.visibility!==undefined&&raw.visibility!=='team')fail('运营业务资料由工作室共享；私人草稿请使用草稿区');
    let body;try{body=validateRecord(raw.kind,raw.body);}catch(e){fail(e.message);}
    if(typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>500)fail('运营记录名称不能为空或过长');
    let old;
    if(raw.id){old=store.record(raw.id,pid,studio,user,true);if(old.kind!==raw.kind||old.body.id!==body.id)fail('不能变更运营记录类型或业务ID');if(raw.revision!==old.revision)fail('运营记录已更新，请重新读取后再保存',409);if(touched.has(old.id))fail('同一批不能重复更新一条记录');touched.add(old.id);}
    for(const ref of references(body)){
     const original=allowedFiles.get(ref.id);
     if(!original||original.visibility!=='team'||['name','type','size','sha256'].some(k=>original[k]!==ref[k]))fail('运营原件必须属于当前资料空间、向团队共享且校验信息一致');
    }
    if(raw.kind==='social-content'&&body.relatedProjectId){const project=store.project(body.relatedProjectId,studio,user);if(project.data.internal)fail('关联项目必须是当前工作室的影视项目');}
    changes.push({...raw,body,title:raw.title.trim(),old});
   }
   const merged=existing.filter(r=>!touched.has(r.id)).concat(changes);
   try{validateRelations(merged);}catch(e){fail(e.message);}
   return changes.map(r=>store.saveRecord({rid:r.old?.id,revision:r.old?.revision,pid,studio,user,kind:r.kind,title:r.title,body:r.body,visibility:'team'}));
  });
 }
 return {save};
}
