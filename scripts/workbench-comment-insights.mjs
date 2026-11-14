// Publish a reviewed, privacy-safe daily interpretation to the existing local records.
// No collection, model call, platform sending, or cloud sync is performed here.
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createDatabase} from '../practical/server/database.mjs';
import '../practical/web/ip/schema.js';
const text=(v,name,max=80000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(name+'为空或过长');return v.trim();};
const web=v=>{if(!v)return '';const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('来源链接无效');return u.href;};
export function prepareInsights(input){
 const date=text(input.date,'解读日期',10);if(!globalThis.IPSchema.day(date))throw Error('请提供真实解读日期');
 if(!Array.isArray(input.candidates)||input.candidates.length>3)throw Error('每次最多3个有新证据的候选题');
 const summary=text(input.summary,'摘要',500),content=text(input.content,'解读正文'),sourceUrl=web(input.sourceUrl);
 const prepared=[{kind:'ip-profile',title:`评论选题解读 · ${date}`,body:{category:'工作方法',summary:content,audience:summary,sourceUrl,verifiedAt:date,status:'待确认',notes:'观众评论是选题信号，未经核实的说法不作为事实结论。解读与候选均可编辑。',templateId:'comment-insights-'+date}}];
 for(const candidate of input.candidates){const title=text(candidate.title,'候选标题',500),key=createHash('sha256').update(title).digest('hex').slice(0,16);prepared.push({kind:'ip-topic',title,body:{audience:text(candidate.audience,'适用观众',500),question:text(candidate.question,'观众问题'),angle:text(candidate.angle,'切入角度'),evidence:text(candidate.evidence,'原话与作品依据'),sourceUrl:web(candidate.sourceUrl),owner:'',due:'',status:'待讨论',notes:text(candidate.needsVerification,'待核事项'),templateId:`comment-topic-${date}-${key}`}});}
 for(const r of prepared)globalThis.IPSchema.validate(r.kind,r.body);
 return prepared;
}
export function publishInsights(store,{pid,studio,user,input}){
 const prepared=prepareInsights(input);store.project(pid,studio,user,true);
 return store.transaction(()=>{
  const existing=store.listRecords(pid,studio,user),result=[];
  for(const item of prepared){const old=existing.find(r=>r.kind===item.kind&&r.body.templateId===item.body.templateId);if(old){result.push({id:old.id,kind:old.kind,created:false});continue;}
   const saved=store.saveRecord({pid,studio,user,...item,visibility:'private'});existing.push(saved);result.push({id:saved.id,kind:saved.kind,created:true});
  }return result;
 });
}
async function main(){
 const args=process.argv.slice(2),arg=key=>{const i=args.indexOf(key);if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw Error('必须明确指定 '+key);return args[i+1];};
 const root=resolve(arg('--root')),pid=arg('--project'),file=resolve(arg('--file'));
 await stat(resolve(root,'workbench.sqlite'));if((await stat(file)).size>1024*1024)throw Error('解读文件超过1MB');
 const input=JSON.parse(await readFile(file,'utf8'));prepareInsights(input);
 const secret=process.env.PRACTICAL_SECRET||await readFile(resolve(root,'master.secret'),'utf8'),store=createDatabase(root,secret);
 try{const user=store.get("SELECT value FROM settings WHERE key='local_owner'")?.value,p=store.get('SELECT * FROM projects WHERE id=? AND archived=0',pid);if(!p||!user)throw Error('未找到活动IP或本机所有者');const records=publishInsights(store,{pid,studio:p.studio_id,user,input});console.log(JSON.stringify({projectId:pid,date:input.date,created:records.filter(r=>r.created).length,retained:records.filter(r=>!r.created).length,records},null,2));}finally{store.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
