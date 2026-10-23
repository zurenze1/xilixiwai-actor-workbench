// Unknown times reserve the whole day and are labelled as potential conflicts.
export function timeRange(event) {
 const match=(event.time||'').match(/^(\d{1,2}):(\d{2})\s*[-–—~～至]\s*(\d{1,2}):(\d{2})$/);
 if(!match)return {start:0,end:1440,unknown:true};
 const [,h,m,H,M]=match.map(Number);
 if(h>23||H>23||m>59||M>59)throw Error('时间应为有效的 HH:mm–HH:mm');
 const start=h*60+m,end=H*60+M;
 if(start===end)throw Error('开始和结束时间不能相同');
 return {start,end:end<start?end+1440:end,unknown:false};
}
export function scheduleDays(events,count) {
 const blocks=events.filter(e=>e.t!=='rest').flatMap(e=>{
   const range=timeRange(e),blocks=[];
   for(let d=e.a;d<=e.b;d++)blocks.push({event:e,start:(d-1)*1440+range.start,end:(d-1)*1440+range.end,unknown:range.unknown});
   return blocks;
 });
 return Array.from({length:count},(_,i)=>{
   const d=i+1,start=i*1440,end=d*1440;
   const active=blocks.filter(b=>b.start<end&&b.end>start),list=events.filter(e=>d>=e.a&&d<=e.b||active.some(b=>b.event.id===e.id));
   let clash=false,potential=false;
   for(let a=0;a<active.length;a++)for(let b=a+1;b<active.length;b++)if(active[a].event.id!==active[b].event.id&&Math.max(active[a].start,active[b].start,start)<Math.min(active[a].end,active[b].end,end)){clash=true;if(active[a].unknown||active[b].unknown)potential=true;}
   return {d,list,clash,potential,work:active.length>0,rest:active.length===0};
 });
}
