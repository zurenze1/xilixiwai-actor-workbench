import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'web/demo-previs'),sources=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
await mkdir(path.join(out,'vendor'),{recursive:true});
for(const file of ['index.html','style.css','schema.js','player.js','export.js','app.js','vendor/gsap.min.js']){
 const source='practical/web/previs/'+file,raw=await readFile(path.join(root,source),'utf8');let value=raw;
 if(file==='index.html')value=value.replace('<link rel="stylesheet" href="../themes/tide.css">','<link rel="stylesheet" href="demo.css">').replace('<script src="../bridge.js" defer></script>','<script src="bridge.js" defer></script>').replace(/<script src="\/demo\/scene-art\.js[^>]*><\/script>/,'<script src="../scene-art.js?v=20261024-cinematic2" defer></script>').replace(/<script src="\/demo\/gallery-effects\.js[^>]*><\/script>/,'').replace(/<link rel="stylesheet" href="\/demo\/editorial-theme\.css[^>]*>/,'').replace(/  <details class="note visual-preview">[\s\S]*?<\/details>\n/,'').replace('连接项目…','读取本机演示方案…').replace('图片只使用当前项目的附件。','图片只使用当前演示方案的本机附件。').replace('原件由项目附件保存。','原件真实保存在本浏览器的独立演示空间。');
 if(file==='app.js')value=value.replace('flush:whenIdle,getState:','flush:whenIdle,whenIdle,getState:').replaceAll('重新读取服务端版本','重新读取本机保存版本').replaceAll('工作台存储连接未就绪，请从主工作台进入或重新载入','本机演示存储尚未就绪，请刷新重试');
 await writeFile(path.join(out,file),value);sources.push({source,output:'web/demo-previs/'+file,sourceSha256:hash(raw),outputSha256:hash(value)});
}
let previous;try{previous=JSON.parse(await readFile(path.join(out,'sources.json'),'utf8'));}catch{}
const generatedAt=JSON.stringify(previous?.sources)===JSON.stringify(sources)?previous.generatedAt:new Date().toISOString();
await writeFile(path.join(out,'sources.json'),JSON.stringify({generatedAt,purpose:'完整复用实战预演界面、校验器、播放器与导出；差异仅独立本机演示桥、首次虚构资料、提示和父页面等待接口。',sources},null,2));
console.log('完整造型与分镜演示已构建：'+sources.length+'个源文件镜像');
