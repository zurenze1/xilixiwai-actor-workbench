import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {categories,practical,demoStages,demoExtras,stageRoutes} from '../web/guide/content.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..'),OUT=resolve(ROOT,'web/guide/catalog.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
function initializer(source,name){
 const match=new RegExp('\\bconst\\s+'+name+'\\s*=').exec(source);if(!match)throw Error('指南找不到源码定义：'+name);
 const start=match.index+match[0].length;let depth=0,quote='',escape=false,lineComment=false,blockComment=false;
 for(let i=start;i<source.length;i++){const c=source[i],n=source[i+1];if(lineComment){if(c==='\n')lineComment=false;continue;}if(blockComment){if(c==='*'&&n==='/'){blockComment=false;i++;}continue;}if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}if(c==='/'&&n==='/'){lineComment=true;i++;continue;}if(c==='/'&&n==='*'){blockComment=true;i++;continue;}if(['"',"'",'`'].includes(c)){quote=c;continue;}if(['{','[','('].includes(c))depth++;if(['}',']',')'].includes(c))depth--;if(c===';'&&depth===0)return source.slice(start,i).trim();}
 throw Error('源码定义不完整：'+name);
}
function evaluate(expression,context={}){return vm.runInNewContext('('+expression+')',context,{timeout:1500});}
async function sourcePaths(directory){const entries=await readdir(resolve(ROOT,directory),{withFileTypes:true}),paths=[];for(const e of entries){if(e.isDirectory()&&!['assets','vendor','node_modules'].includes(e.name))paths.push(...await sourcePaths(directory+'/'+e.name));else if(e.isFile()&&/\.(?:m?js|html|css)$/.test(e.name))paths.push(directory+'/'+e.name);}return paths;}
function fallback(name,kinds,mod){const first=mod[kinds[0]],fields=first?.fields?.filter(f=>f.required).slice(0,4).map(f=>f.label)||[];return{icon:'folder',category:'team',kinds,lead:'从本板块的真实表单开始，逐项填写并保存。',curated:false,steps:[{title:'点哪里',body:'在侧栏打开「'+name+'」，选择当前页面提供的新增或编辑入口。'},{title:'怎么填',body:fields.length?'先填写：'+fields.join('、')+'；下方列出源码中实际存在的字段。':'按页面的实际字段填写；没有资料的项目先保持未知。'},{title:'如何保存',body:'点击页面的保存按钮，确认保存成功，再刷新核对。'},{title:'保存 / 输出',body:'以页面当前提供的导出入口为准；精细操作说明待补写。'}]};}
export async function buildUsageGuide(){
 const paths=[...await sourcePaths('web'),...await sourcePaths('practical/web')].sort(),contents=await Promise.all(paths.map(p=>readFile(resolve(ROOT,p),'utf8'))),byPath=Object.fromEntries(paths.map((p,i)=>[p,contents[i]]));
 const demoApp=byPath['web/app.js'],demoData=byPath['web/data.js'],practicalApp=byPath['practical/web/app.js'],formsCode=byPath['practical/web/forms.js'],sourceFiles=paths.map((path,i)=>({path,sha256:hash(contents[i])}));
 const demoContext={window:{}};vm.runInNewContext(demoData,demoContext,{timeout:1500});const data=demoContext.window.DEMO;if(!Array.isArray(data?.stations)||data.stations.length!==8)throw Error('指南要求真实八阶段定义');
 const pages=evaluate(initializer(demoApp,'PAGES')),nav=evaluate(initializer(practicalApp,'NAV')),names=evaluate(initializer(demoApp,'PAGE_NAME'),{D:data}),crumbs=evaluate(initializer(demoApp,'CRUMB'),{D:data});
 const formsContext={};vm.runInNewContext(formsCode,formsContext,{timeout:1500});const MOD=formsContext.ActorForms?.MOD;if(!MOD)throw Error('指南找不到 ActorForms.MOD');
 const practicalCards=nav.map(([route,name])=>{const authored=practical[route]||fallback(name,MOD[route]?[route]:[],MOD);return{id:'practical-'+route,mode:'practical',name,route,...authored,fields:(authored.kinds||[]).filter(k=>MOD[k]).map(k=>({kind:k,name:MOD[k].name,fields:MOD[k].fields.map(f=>({key:f.key,label:f.label,type:f.type,required:f.required,options:f.options||[]}))}))};});
 const stages=data.stations.map((station,index)=>({index,id:station.id,no:station.no,name:station.name,title:station.title,output:station.out,route:stageRoutes[index],demoCard:'demo-stage-'+index,practicalCard:'practical-'+stageRoutes[index]}));
 const demoCards=data.stations.map((station,index)=>({id:'demo-stage-'+index,mode:'demo',name:station.title,page:index,stage:index,...demoStages[index],output:station.out,fields:[]}));
 for(const[key,page]of Object.entries(pages)){const [icon,category,lead]=demoExtras[key]||['folder','team','打开当前板块，按页面入口填写、保存并核对结果。'];let label=names(key);if(label===key){const matched=/<b>([^<]+)<\/b>/.exec(crumbs[key]?.()||'')||new RegExp('CRUMB\\.'+key+'\\s*=.*?<b>([^<]+)</b>').exec(demoApp);if(matched)label=matched[1];}demoCards.push({id:'demo-page-'+key,mode:'demo',key,page,name:label,icon,category,lead,curated:Boolean(demoExtras[key]),fields:[],steps:[{title:'点哪里',body:'侧栏打开「'+label+'」。'},{title:'怎么填',body:lead},{title:'如何保存',body:key==='guide'?'这里是说明页，无需保存。':'按页面提供的保存入口确认，留意错误和未保存提示。'},{title:'保存 / 输出',body:key==='rourou'?'照片原件和完整备份在肉肉板块中导出。':'使用当前页面的导出入口；完整备份可保留原件，文字导出只包含文字。'}]});}
 const sourceHash=hash(sourceFiles.map(s=>s.path+'\0'+s.sha256).join('\n')),body={version:1,sourceHash,sourceFiles,categories,stages,cards:[...practicalCards,...demoCards],notes:{generated:'功能目录、阶段和手工表单字段由当前本地源码提取。已核对各模块前端代码和样式；不包含后台、密钥或用户资料。',curated:'精细操作说明由人工编写；新增板块先生成基础操作卡，仍需核对完整步骤。'}};
 const contentHash=hash(JSON.stringify(body));let previous;try{previous=JSON.parse(await readFile(OUT,'utf8'));}catch{}
 const catalog={...body,contentHash,generatedAt:previous?.sourceHash===sourceHash&&previous?.contentHash===contentHash?previous.generatedAt:new Date().toISOString()};const output=JSON.stringify(catalog,null,2)+'\n';await mkdir(dirname(OUT),{recursive:true});if(await readFile(OUT,'utf8').catch(()=>null)!==output)await writeFile(OUT,output);return catalog;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const c=await buildUsageGuide();console.log(JSON.stringify({cards:c.cards.length,stages:c.stages.length,sourceHash:c.sourceHash,generatedAt:c.generatedAt}));}
