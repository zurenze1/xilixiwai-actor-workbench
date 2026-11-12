import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill} from '@remotion/renderer';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.resolve(process.argv[2]),format=process.argv[3];
if(!['horizontal','vertical','both'].includes(format))throw Error('导出比例无效');
const data=JSON.parse(fs.readFileSync(input,'utf8'));
const browserExecutable=path.join(root,'node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const emit=(x)=>console.log(JSON.stringify(x));
emit({type:'stage',message:'正在准备画面',progress:0});
const serveUrl=await bundle({entryPoint:path.join(root,'src/index_V3.tsx'),publicDir:path.join(root,'public')});
const ratios=format==='both'?['horizontal','vertical']:[format],files=[];
for(let i=0;i<ratios.length;i++){
 const ratio=ratios[i],id=ratio==='horizontal'?'WorkHorizontal':'WorkVertical';
 const composition=await selectComposition({serveUrl,id,inputProps:{data},browserExecutable});
 const movie=path.join(path.dirname(input),ratio+'.mp4'),poster=path.join(path.dirname(input),ratio+'.png');
 if(fs.existsSync(movie))throw Error('请建立新导出目录，不覆盖原成片');
 await renderMedia({composition,serveUrl,codec:'h264',outputLocation:movie,inputProps:{data},browserExecutable,concurrency:2,pixelFormat:'yuv420p',colorSpace:'bt709',crf:18,overwrite:false,onProgress:({progress})=>emit({type:'progress',ratio,progress:(i+progress)/ratios.length,message:'正在生成'+(ratio==='horizontal'?'横屏':'竖屏')+'视频'})});
 await renderStill({composition,serveUrl,output:poster,inputProps:{data},frame:composition.durationInFrames-1,browserExecutable});
 files.push({ratio,file:movie,poster,width:composition.width,height:composition.height,frames:composition.durationInFrames,fps:composition.fps});
}
fs.writeFileSync(path.join(path.dirname(input),'render-receipt.json'),JSON.stringify({version:'V3',files},null,2));
emit({type:'complete',progress:1,files});
