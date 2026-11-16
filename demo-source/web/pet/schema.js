(function(root){
'use strict';
const TABS=['today','profile','health','beh','care','album','studio'];
const CONTACTS=['ownerName','ownerPhone','assistantName','assistantPhone','hospitalName','hospitalPhone','hospitalAddress','emergencyName','emergencyPhone','emergencyAddress','careNote'];
const fail=(p,m)=>{throw new Error('肉肉资料校验失败：'+p+m)};
const obj=(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail(p,'应为对象');if(Object.keys(v).some(k=>['__proto__','prototype','constructor'].includes(k)))fail(p,'字段无效');return v};
const text=(v,p,max=20000)=>{if(typeof v!=='string'||v.length>max)fail(p,'文字无效或过长');return v};
const num=(v,p,max=1000000)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)fail(p,'数值无效');return v};
const nullable=(v,p,max)=>v==null||v===''?null:num(v,p,max);
const list=(v,p,f,max=10000)=>{if(!Array.isArray(v)||v.length>max)fail(p,'列表无效或过长');return v.map((x,i)=>f(x,p+'['+i+']'))};
const date=(v,p)=>{text(v,p,10);const d=new Date(v+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==v)fail(p,'日期无效');return v};
const optionalDate=(v,p)=>v?date(v,p):'';
const time=(v,p)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(text(v,p,5)))fail(p,'时间无效');return v};
const image=(v,p)=>{if(!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(text(v,p,50000000)))fail(p,'旧版照片无效');return v};
function fileRef(v,p){
 obj(v,p);const id=text(v.id,p+'.id',200),sha256=text(v.sha256,p+'.sha256',64),size=num(v.size,p+'.size',Number.MAX_SAFE_INTEGER);
 if(!/^file-[A-Za-z0-9-]+$/.test(id)||!/^[a-f0-9]{64}$/i.test(sha256)||!Number.isSafeInteger(size))fail(p,'原件编号或校验值无效');
 return{id,name:text(v.name,p+'.name',1000),type:text(v.type||'',p+'.type',200),size,sha256:sha256.toLowerCase()};
}
const source=(v,legacy)=>legacy?'legacy-unverified':v==='legacy-unverified'?v:'user';
function fresh(){
 return{schemaVersion:3,tab:'today',profile:{name:'肉肉',breed:'马尔济斯',birth:'',sex:'',food:'',meals:null,gram:null,water:null,walk:null,notes:''},
 weights:[],logs:{},health:[],behLog:[],photos:[],notes:{},contacts:Object.fromEntries(CONTACTS.map(k=>[k,''])),carePlan:{from:'',to:'',place:'',carer:'',instructions:''},
 studio:{photoId:'',caption:'',layout:'bottom',background:'#fff7ed'},drafts:{},legacyNotice:false};
}
function validate(raw){
 obj(raw,'资料');if(raw.schemaVersion!==undefined&&![1,2,3].includes(raw.schemaVersion))fail('版本','不受支持');
 const out=fresh(),legacy=raw.schemaVersion!==3;
 out.legacyNotice=raw.legacyNotice===true||legacy;
 if(raw.tab!==undefined){const tab=raw.tab==='breed'?'profile':raw.tab;if(!TABS.includes(tab))fail('页面','无效');out.tab=tab;}
 if(raw.profile!==undefined){
  const v=obj(raw.profile,'档案'),p=out.profile;
  for(const k of ['name','breed','sex','food','notes'])if(v[k]!==undefined)p[k]=text(v[k],'档案.'+k,k==='notes'?10000:1000);
  p.birth=optionalDate(v.birth,'生日');
  for(const k of ['meals','gram','water','walk'])p[k]=nullable(v[k],'目标.'+k,100000);
 }
 if(raw.weights!==undefined)out.weights=list(raw.weights,'体重',(x,p)=>{obj(x,p);const kg=num(x.kg,p+'.kg',2000);if(kg===0)fail(p,'体重须大于0');return{id:text(x.id,p+'.id',200),d:date(x.d,p+'.d'),kg,note:text(x.note||'',p+'.note',10000)}});
 if(new Set(out.weights.map(x=>x.id)).size!==out.weights.length)fail('体重','编号重复');
 if(raw.logs!==undefined){
  obj(raw.logs,'日常');if(Object.keys(raw.logs).length>10000)fail('日常','日期过多');
  for(const [d,v]of Object.entries(raw.logs)){
   date(d,'日常日期');obj(v,d);const care={};obj(v.care||{},'护理');
   for(const k of ['brush','tear','teeth'])if(v.care?.[k]!=null)care[k]=time(v.care[k],k);
   const timed=(a,p,field)=>list(a||[],p,(x,q)=>{obj(x,q);return{t:time(x.t,q),[field]:num(x[field],q),note:text(x.note||'',q+'.note',5000)}});
   out.logs[d]={food:timed(v.food,'喂食','g'),water:num(v.water??0,'加水'),waterLog:timed(v.waterLog,'加水记录','ml'),walk:timed(v.walk,'散步','m'),poop:list(v.poop||[],'便便',(x,p)=>{obj(x,p);return{t:time(x.t,p),s:text(x.s,p,100),note:text(x.note||'',p,5000)}}),care};
  }
 }
 if(raw.health!==undefined&&!(legacy&&raw.health===null))out.health=list(raw.health,'健康',(x,p)=>{
  obj(x,p);const every=nullable(x.every,p+'.every',36500);if(every!==null&&(!Number.isInteger(every)||every<1))fail(p,'周期须为正整数天');
  return{id:text(x.id,p+'.id',200),ic:text(x.ic||'📋',p+'.ic',20),n:text(x.n,p+'.n',1000),last:optionalDate(x.last,p+'.last'),due:optionalDate(x.due,p+'.due'),every,note:text(x.note||'',p+'.note',10000),source:source(x.source,legacy),history:list(x.history||[],p+'.history',(h,q)=>{obj(h,q);return{d:date(h.d,q),note:text(h.note||'',q,10000)}})};
 },1000);
 if(new Set(out.health.map(x=>x.id)).size!==out.health.length)fail('健康','编号重复');
 if(raw.behLog!==undefined&&!(legacy&&raw.behLog===null))out.behLog=list(raw.behLog,'行为',(x,p)=>{obj(x,p);return{id:text(x.id||'legacy-'+p,p+'.id',200),d:date(x.d,p+'.d'),b:text(x.b,p+'.b',10000),duration:text(x.duration||'',p+'.duration',1000),context:text(x.context||'',p+'.context',10000),action:text(x.action||'',p+'.action',10000),source:source(x.source,legacy)}});
 if(new Set(out.behLog.map(x=>x.id)).size!==out.behLog.length)fail('行为','编号重复');
 if(raw.photos!==undefined)out.photos=list(raw.photos,'照片',(x,p)=>{obj(x,p);const v={id:text(x.id||'legacy-photo-'+p,p+'.id',200),c:text(x.c||'',p+'.c',10000),d:text(x.d||'',p+'.d',100)};
  if(x.file!=null)v.file=fileRef(x.file,p+'.file');if(x.src)v.src=image(x.src,p+'.src');if(!v.file&&!v.src)fail(p,'缺少照片');return v;
 });
 if(new Set(out.photos.map(x=>x.id)).size!==out.photos.length)fail('照片','编号重复');
 if(raw.notes!==undefined){obj(raw.notes,'笔记');for(const[tab,entries]of Object.entries(raw.notes)){const t=tab==='breed'?'profile':tab;if(!TABS.includes(t))fail('笔记分类','无效');
  const a=list(entries,'笔记.'+tab,(x,p)=>{obj(x,p);const v={at:text(x.at||'',p,100),text:text(x.text||'',p,100000)};if(x.attachment!=null)v.attachment=fileRef(x.attachment,p);if(x.file===true)v.file=true;if(x.img)v.img=image(x.img,p);return v;});
  out.notes[t]=(out.notes[t]||[]).concat(a);
 }}
 if(raw.contacts!==undefined){obj(raw.contacts,'联系');for(const k of CONTACTS)if(raw.contacts[k]!==undefined)out.contacts[k]=text(raw.contacts[k],k,k==='careNote'?10000:1000);}
 if(raw.carePlan!==undefined){obj(raw.carePlan,'托管');for(const k of ['from','to'])out.carePlan[k]=optionalDate(raw.carePlan[k],k);for(const k of ['place','carer','instructions'])out.carePlan[k]=text(raw.carePlan[k]||'',k,10000);
 if(out.carePlan.from&&out.carePlan.to&&out.carePlan.to<out.carePlan.from)fail('托管','结束日期早于开始日期');}
 if(raw.studio!==undefined){const v=obj(raw.studio,'表情');out.studio={photoId:text(v.photoId||'','选中照片',200),caption:text(v.caption||'','表情文字',300),layout:['bottom','top','square'].includes(v.layout)?v.layout:'bottom',background:/^#[a-f0-9]{6}$/i.test(v.background)?v.background:'#fff7ed'};}
 const draftValue=(v,p,depth=0)=>{if(typeof v==='string')return text(v,p,100000);if(depth>3)fail(p,'草稿层级过深');obj(v,p);if(Object.keys(v).length>100)fail(p,'草稿字段过多');return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,draftValue(x,p+'.'+k,depth+1)]));};
 if(raw.drafts!==undefined){obj(raw.drafts,'草稿');for(const[t,v]of Object.entries(raw.drafts)){const k=t==='breed'?'profile':t;if(!TABS.includes(k))fail('草稿分类','无效');out.drafts[k]={...(out.drafts[k]||{}),...draftValue(v,'草稿.'+k)};}}
 if(out.drafts.today?.date)date(out.drafts.today.date,'草稿查看日期');
 if(out.drafts.album?.photoDate)date(out.drafts.album.photoDate,'草稿照片日期');
 return out;
}
function references(state){
 const result=new Map();const add=f=>{const ref=fileRef(f,'原件');const old=result.get(ref.id);if(old&&['name','type','size','sha256'].some(k=>old[k]!==ref[k]))fail('原件','同一编号说明冲突');result.set(ref.id,ref);};
 for(const p of state.photos||[])if(p.file)add(p.file);for(const rows of Object.values(state.notes||{}))for(const n of rows)if(n.attachment)add(n.attachment);
 return[...result.values()];
}
function localDate(d=new Date()){return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function nextDue(h){if(h.source==='legacy-unverified')return'';if(h.due)return h.due;if(h.last&&h.every){const d=new Date(h.last+'T12:00:00');d.setDate(d.getDate()+h.every);return localDate(d);}return'';}
function remaining(d,today=localDate()){return Math.round((new Date(d+'T00:00:00Z')-new Date(today+'T00:00:00Z'))/86400000);}
root.PetSchema=Object.freeze({validate,fresh,references,contactKeys:Object.freeze(CONTACTS),tabs:Object.freeze(TABS),localDate,nextDue,remaining});
})(typeof window!=='undefined'?window:globalThis);
