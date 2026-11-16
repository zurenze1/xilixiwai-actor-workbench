import http from 'node:http';
import {stat,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../web');
const port=Number(process.env.PORT||4890);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.bcmap':'application/octet-stream'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=await realpath(resolve(root,'.'+pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
  const info=await stat(file);if(!info.isFile())throw Error();
  const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
  const range=req.headers.range;
  if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);const start=m?Number(m[1]):-1,end=m?(m[2]?Math.min(Number(m[2]),info.size-1):info.size-1):-1;if(start<0||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});if(req.method==='HEAD')return res.end();return createReadStream(file,{start,end}).pipe(res);}
  res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Xilixiwai demo: http://127.0.0.1:${port}/`));
