(function(root){
'use strict';
function wrap(ctx,text,width){
 const lines=[];let line='';for(const c of Array.from(text)){if(c==='\n'){lines.push(line);line='';continue;}if(ctx.measureText(line+c).width>width&&line){lines.push(line);line=c;}else line+=c;}if(line)lines.push(line);return lines;
}
async function draw(canvas,photo,options){
 const img=new Image();img.decoding='async';img.src=photo;
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('这张图片暂不能解码，请换用 JPG、PNG 或 WebP 照片'));if(img.complete&&img.naturalWidth)resolve();});
 if(img.naturalWidth*img.naturalHeight>64000000)throw new Error('图片像素过大，请先换用较小照片；原件仍保留');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器不支持图片导出');
 canvas.width=720;canvas.height=720;ctx.fillStyle=options.background;ctx.fillRect(0,0,720,720);
 const caption=(options.caption||'').trim(),layout=options.layout||'bottom';
 let y=0,h=720;if(caption&&layout!=='square'){h=540;if(layout==='top')y=180;}
 const scale=Math.min(720/img.naturalWidth,h/img.naturalHeight);
 const w=img.naturalWidth*scale,ih=img.naturalHeight*scale;
 ctx.drawImage(img,(720-w)/2,y+(h-ih)/2,w,ih);
 if(caption){
  let size=52,lines;
  do{ctx.font='700 '+size+'px system-ui, "PingFang SC", sans-serif';lines=wrap(ctx,caption,656);size-=2;}while(lines.length>3&&size>=24);
  if(lines.length>3)throw new Error('表情文字太长，请缩短到能放下三行');
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const lh=(size+2)*1.22,cy=layout==='top'?90:layout==='bottom'?630:650-(lines.length-1)*lh/2;
  lines.forEach((line,i)=>{const ty=cy+(i-(lines.length-1)/2)*lh;if(layout==='square'){ctx.strokeStyle='#ffffff';ctx.lineWidth=8;ctx.strokeText(line,360,ty);}ctx.fillStyle='#302a26';ctx.fillText(line,360,ty);});
 }
 return canvas;
}
async function png(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG生成失败，请重试')),'image/png'));}
root.PetSticker=Object.freeze({draw,png,wrap});
})(typeof window!=='undefined'?window:globalThis);
