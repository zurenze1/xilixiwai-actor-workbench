import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
export function publicAddress(ip) {
 if(isIP(ip)===4){const [a,b,c]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
 if(isIP(ip)===6)return /^[23]/i.test(ip)&&!/^2001:0?db8:/i.test(ip);
 return false;
}
// Resolve once, validate every result, then pin the actual TLS connection to that IP.
// The original hostname remains the certificate/SNI target. Redirects are never followed.
export async function publicFetch(input,{method='GET',headers={},body,signal}={}) {
 const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password)throw Error('模型接口必须使用HTTPS');
 const addresses=await lookup(url.hostname,{all:true,verbatim:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('模型地址解析到非公网地址，已拒绝连接');
 const selected=addresses[0];
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method,headers,signal,agent:false,lookup:(hostname,options,callback)=>options.all?callback(null,[selected]):callback(null,selected.address,selected.family)},response=>{
   const chunks=[];let size=0;
   response.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024){response.destroy();reject(Error('模型返回过大，请缩短输入'));}else chunks.push(chunk);});
   response.on('end',()=>{try{resolve(new Response([204,205,304].includes(response.statusCode)?null:Buffer.concat(chunks),{status:response.statusCode,headers:{'Content-Type':response.headers['content-type']||'application/json'}}));}catch{reject(Error('模型返回了无效响应'));}});
   response.on('error',()=>reject(Error('模型响应中断，请稍后重试')));
  });
  request.on('error',error=>reject(Error(error.name==='AbortError'?'模型请求超时或已取消':'模型连接未成功，请核对网络和服务地址')));if(body)request.write(body);request.end();
 });
}
