import '../web/ip/schema.js';
import {fail} from './database.mjs';
export const IP_KINDS=globalThis.IPSchema.kinds;
export function validateIPReferences(kind,body,{store,pid,studio,user,old,title}){
  if(!IP_KINDS.includes(kind))return;
  for(const [field,target]of [['topicId','ip-topic'],['contentId','ip-content']])if(body[field]){
    const r=store.record(body[field],pid,studio,user);
    if(r.kind!==target)fail('关联的'+(field==='topicId'?'选题':'稿件')+'类型不正确');
    if(field==='contentId'&&((kind==='ip-shoot'&&body.status==='拍摄完成')||(kind==='ip-release'&&body.status==='已发布'))&&!globalThis.IPSchema.approved.has(r.body.status))fail('请先完成关联稿件的IP确认，再登记拍摄完成或实际发布');
  }
  if(kind==='ip-release'&&body.url&&store.listRecords(pid,studio,user,'ip-release').some(r=>r.id!==old?.id&&!r.body.archived&&r.body.url===body.url))fail('这个作品链接已有发布记录，请在原记录中更新数据');
  if(kind==='ip-content'&&old&&globalThis.IPSchema.approved.has(body.status)&&['hook','outline','script','cta'].some(k=>(old.body[k]||'')!==(body[k]||'')))fail('正文或表达已修改，请将状态改回待IP审核后重新确认');
  if(kind==='ip-content'&&old&&title!==undefined&&title!==old.title&&globalThis.IPSchema.approved.has(body.status))fail('标题已修改，请将状态改回待IP审核后重新确认');
}
