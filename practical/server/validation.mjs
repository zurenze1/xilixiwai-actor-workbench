import '../../web/radar-goals.js';
import '../web/pet/schema.js';
import '../web/previs/schema.js';
import {validate as businessValidate,references as businessReferences} from '../web/business/model.js';
import {fail} from './database.mjs';
import {KINDS as socialKinds,validateRecord as validateSocialRecord} from '../web/social/model.js';
import '../web/forms.js';
const pet=globalThis.PetSchema,previs=globalThis.PrevisSchema;
export function validateModule(key,input,allowedFiles=[]){
 let state,refs;try{if(key==='rourou-world-v1'){state=pet.validate(input);refs=pet.references(state);}else if(key==='previs-v1'){state=previs.validate(input);refs=state.files;}else if(key==='business-v1'){state=businessValidate(input);refs=businessReferences(state);}else if(key==='social-v1'){validateRecord('module',{state:input});if(JSON.stringify(input).length>100000)fail('运营草稿过长，请将历史保存为独立记录');state=structuredClone(input);refs=[];}else fail('模块类型无效');}catch(e){fail(e.message);}
 const allowed=new Map(allowedFiles.map(f=>[f.id,f]));for(const ref of refs){const original=allowed.get(ref.id);if(!original||['name','type','size','sha256'].some(k=>original[k]!==ref[k]))fail('模块引用的原件不在当前资料空间，或校验信息不一致');}return state;
}
export function validateRecord(kind,body){
 if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2_000_000)fail('记录内容无效或过长');
 const walk=(v,depth=0)=>{if(depth>24)fail('记录嵌套过深');if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('记录字段名无效');walk(x,depth+1);}};walk(body);
 if(socialKinds.includes(kind)){try{return validateSocialRecord(kind,body);}catch(e){fail(e.message);}}
 try{globalThis.ActorForms.validate(kind,body);}catch(e){fail(e.message);}
 if(kind==='goal'&&body.radar!==undefined){try{globalThis.ActorRadar.validate(body.radar,{complete:true});}catch(e){fail(e.message);}}
 if(kind==='event'&&body.start&&body.end&&body.end<body.start)fail('结束时间不能早于开始时间');
 if(['message','crisis'].includes(kind)&&['已批准','已人工发布'].includes(body.status)&&!body.reviewer?.trim())fail('批准或发布前需要审核人');
 if(['message','crisis'].includes(kind)&&body.status==='已人工发布'&&!/^https:\/\//.test(body.publishedUrl||''))fail('请填写人工发布后的HTTPS链接');
 return body;
}
export function verifyReport(body,documents){
 const sources=new Map(documents.map(d=>[d.id,d]));
 const verify=(entry,quote)=>{const doc=sources.get(entry.sourceId);let matched=false,from=0,to=doc?.text?.length||0;if(doc&&typeof quote==='string'&&quote.trim()){const lines=doc.text.split(/\r\n|\r|\n/);if(entry.lineStart!==undefined||entry.lineEnd!==undefined){if(Number.isInteger(entry.lineStart)&&Number.isInteger(entry.lineEnd)&&entry.lineStart>=1&&entry.lineEnd>=entry.lineStart&&entry.lineEnd<=lines.length){const excerpt=lines.slice(entry.lineStart-1,entry.lineEnd).join('\n');matched=excerpt.includes(quote.replace(/\r\n|\r/g,'\n'));}}else matched=doc.text.includes(quote);}entry.citationVerified=matched;if(entry.kind==='fact'&&!matched){entry.kind='unknown';entry.originalKind='fact';}};
 for(const section of body.sections||[])for(const entry of section.items||[])verify(entry,entry.quote);
 for(const entry of body.revisions||[])verify(entry,entry.original);return body;
}
