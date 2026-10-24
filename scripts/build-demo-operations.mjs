import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'web/demo-operations'),sources=[];
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const [kind,files] of Object.entries({business:['index.html','style.css','model.js','app.js'],social:['index.html','style.css','model.js','app.js','backup.js','importer.js']})){
 await mkdir(path.join(out,kind),{recursive:true});
 for(const file of files){const source='practical/web/'+kind+'/'+file,raw=await readFile(path.join(root,source),'utf8');let value=raw;
  if(file==='index.html')value=value.replace('</head>','<script src="../../scene-art.js?v=20261024-unique6" defer></script></head>').replace('<link rel="stylesheet" href="../themes/tide.css">','<link rel="stylesheet" href="../demo.css">').replace('<script src="../bridge.js" defer></script>','<script type="module" src="../bridge.js"></script>').replace('../vendor/papaparse.min.js','../papaparse.min.js').replace(/<link rel="stylesheet" href="\/demo\/editorial-theme\.css[^>]*>/,'').replace(/<script src="\/demo\/scene-art\.js[^>]*><\/script>/,'').replace('工作室经营</h1>','工作室经营与自有品牌</h1>').replace('连接经营资料…','读取本机演示资料…').replace('连接运营资料…','读取本机演示资料…').replace('经营资料由工作室管理员单独管理。','这里是可编辑的本机演示台账，初始人物、主体与金额均为虚构。').replace('作品与账号保存在工作室长期空间，切换影视项目仍可查看。','作品与账号保存在本浏览器独立演示空间，切换影视项目仍可查看。');
  if(file==='app.js')value=value.replaceAll('经营私有资料','本机经营演示资料').replaceAll('已连接 · 经营私有资料','已载入 · 本机经营演示资料').replaceAll('已连接工作室长期运营空间','已载入本机运营演示空间').replaceAll('服务器最新正式记录','本机最新正式记录').replaceAll('服务器的最新正式记录','本机的最新正式记录').replaceAll('团队可查看','本机可查看').replaceAll('团队才能查看','本机正式台账才会更新').replaceAll('团队可见引用','正式台账可见引用').replaceAll('当前账号不能访问经营资料；请由工作室管理员打开','本机演示上下文尚未就绪').replaceAll('请确认主工作台已登录，并由工作室管理员进入','请刷新后重试；本页不需要账号');
  if(file==='importer.js')value=value.replace("else if(key==='sourceName')b.source.name=value;else if(key==='sourceNotes')b.source.notes=value;","else if(key==='sourceName'){if(b.source)b.source.name=value;}else if(key==='sourceNotes'){if(b.source)b.source.notes=value;}");
  await writeFile(path.join(out,kind,file),value);sources.push({source,output:'web/demo-operations/'+kind+'/'+file,sourceSha256:sha(raw),outputSha256:sha(value)});
 }
}
await copyFile(path.join(root,'practical/web/vendor/papaparse.min.js'),path.join(out,'papaparse.min.js'));
await copyFile(path.join(root,'node_modules/papaparse/LICENSE'),path.join(out,'PAPAPARSE-LICENSE.txt'));
let previous;try{previous=JSON.parse(await readFile(path.join(out,'sources.json'),'utf8'));}catch{}
const generatedAt=JSON.stringify(previous?.sources)===JSON.stringify(sources)?previous.generatedAt:new Date().toISOString();
await writeFile(path.join(out,'sources.json'),JSON.stringify({generatedAt,purpose:'实战经营及运营模块原样复用；差异仅本机演示桥接、主题、真实边界文案。',sources},null,2));
console.log('完整经营/运营演示模块已构建：'+sources.length+'个源文件镜像');
