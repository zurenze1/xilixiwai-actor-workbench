import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import mammoth from 'mammoth';
import {Readability} from '@mozilla/readability';
import {parseHTML} from 'linkedom';
import {publicFetch} from '../../server/public-fetch.mjs';
import {id,hash,now,fail} from './database.mjs';
export const MAX_FILE=32*1024*1024;
export function fileService(store,dataDir){
 const root=join(dataDir,'originals');
 const meta=r=>({id:r.id,name:r.name,type:r.type,size:r.size,sha256:r.sha256,projectId:r.project_id,visibility:r.visibility,createdAt:r.created_at});
 async function put({pid,studio,user,name,type,bytes,visibility='team'}){
  store.project(pid,studio,user,true);if(bytes instanceof Uint8Array&&!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);if(!Buffer.isBuffer(bytes)||bytes.length>MAX_FILE)fail('单个文件最多32 MB',413);if(!name||name.length>500)fail('文件名无效');if(!['team','private'].includes(visibility))fail('附件可见范围无效');if(!/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(type||''))type='application/octet-stream';
  const fileId='file-'+id(),path=join(root,fileId);await mkdir(root,{recursive:true,mode:0o700});
  try{await writeFile(path,bytes,{mode:0o600,flag:'wx'});return store.transaction(()=>{const p=store.project(pid,studio,user,true);if(p.data.internal)visibility='private';store.run('INSERT INTO files VALUES(?,?,?,?,?,?,?,?,?,?,?)',fileId,studio,pid,user,visibility,name,type||'application/octet-stream',bytes.length,hash(bytes),path,now());store.audit(studio,user,'file.upload',fileId,{name,size:bytes.length},pid);return meta(store.get('SELECT * FROM files WHERE id=?',fileId));});}catch(e){if(e.code!=='EEXIST')await unlink(path).catch(()=>{});throw e;}
 }
 function entry(fid,studio,user){const row=store.get("SELECT * FROM files WHERE id=? AND studio_id=? AND (visibility='team' OR owner_id=?)",fid,studio,user);if(!row)fail('附件不存在或无权查看',404);store.project(row.project_id,studio,user);return row;}
 async function get(fid,studio,user){const row=entry(fid,studio,user);const bytes=await readFile(row.path);if(hash(bytes)!==row.sha256)fail('原件校验失败，已阻止返回损坏内容',409);return {meta:meta(row),bytes};}
 function list(pid,studio,user){store.project(pid,studio,user);return store.all("SELECT * FROM files WHERE project_id=? AND studio_id=? AND (visibility='team' OR owner_id=?) ORDER BY created_at DESC",pid,studio,user).map(meta);}
 return {put,get,entry,list,meta};
}
export async function extract(bytes,name,type){
 let text='',metadata={format:'text'};
 if(/\.docx$/i.test(name)){const result=await mammoth.extractRawText({buffer:bytes});text=result.value;metadata={format:'docx',messages:result.messages.map(m=>m.message)};}
 else if(/\.pdf$/i.test(name)||type==='application/pdf'){
  const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdf.getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false,disableFontFace:true}),document=await loading.promise;
  if(document.numPages>500)fail('PDF超过500页，请分册导入',413);const pages=[];
  try{for(let i=1;i<=document.numPages;i++){const page=await document.getPage(i),content=await page.getTextContent();pages.push('[第'+i+'页]\n'+content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''));}text=pages.join('\n\n');metadata={format:'pdf',pages:document.numPages,ocrRequired:text.replace(/\[第\d+页\]/g,'').trim().length<30};}finally{await loading.destroy();}
 }
 else if(/^text\//.test(type)||/\.(txt|md|csv|json|srt|vtt)$/i.test(name)){text=bytes.toString('utf8').replace(/^\uFEFF/,'');}
 else return {text:'',metadata:{format:'binary',needsTranscript:true}};
 if(text.length>1_200_000)fail('文本超过120万字符，请分册处理',413);return {text,metadata};
}
export async function fetchSource(url){
 const parsed=new URL(url);if(parsed.protocol!=='https:')fail('资料来源需要公开HTTPS链接');
 const response=await publicFetch(parsed.href,{headers:{Accept:'text/html,application/rss+xml,application/xml,text/plain'},signal:AbortSignal.timeout(25000)});
 if(response.status>=300&&response.status<400)fail('链接发生跳转，请填写浏览器中的最终公开地址');if(!response.ok)fail('来源暂不可读取（HTTP '+response.status+'）');
 const contentType=response.headers.get('content-type')||'',raw=await response.text();if(!/html|xml|text/.test(contentType))fail('此来源不是可读取文字网页，请上传原文件');
 if(/xml|rss/.test(contentType)||/^\s*<\?xml/.test(raw)){
  const {document}=parseHTML(raw);const entries=[...document.querySelectorAll('item,entry')].slice(0,100);const text=entries.map((e,i)=>[i+1+'. '+(e.querySelector('title')?.textContent||''),e.querySelector('pubDate,updated,published')?.textContent||'',e.querySelector('description,summary,content')?.textContent||'',e.querySelector('link')?.getAttribute('href')||e.querySelector('link')?.textContent||''].join('\n')).join('\n\n');return {name:document.querySelector('channel>title,feed>title')?.textContent||parsed.hostname,text,sourceUrl:parsed.href,metadata:{format:'rss',fetchedAt:now(),verified:false,entryCount:entries.length}};
 }
 const {document}=parseHTML(raw);const article=new Readability(document,{charThreshold:100}).parse();const text=article?.textContent?.trim()||document.body?.textContent?.trim();if(!text||text.length<30)fail('未提取到可用文字，可能需要登录或网页不允许读取；请手动导入有权使用的资料');if(text.length>1_200_000)fail('网页文字超过120万字符，请分段导入',413);return {name:article?.title||parsed.hostname,text,sourceUrl:parsed.href,metadata:{format:'web',fetchedAt:now(),verified:false}};
}
