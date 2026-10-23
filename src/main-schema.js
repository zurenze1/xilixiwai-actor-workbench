import {z} from 'zod';
const bools=z.record(z.string(),z.boolean());
const text=z.string().max(1000000);
const texts=z.record(z.string(),text);
const knownFolders=['take','read','line','role','dance','prev','comic','shoot','promo','deal','review'];
const file=z.object({name:z.string().max(1000),size:z.union([z.string(),z.number()]),at:z.string(),text:text.optional(),img:z.string().regex(/^data:image\/(jpeg|png|webp|gif);base64,/).optional(),file:z.object({id:z.string(),name:z.string(),type:z.string(),size:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).optional()}).passthrough();
const review=z.object({status:z.enum(['adopt','modify','reject','discuss']),who:z.string(),text,at:z.string()});
export const mainSchema=z.object({
 theme:z.enum(['tide','butter','moss']).optional(),st:z.number().int().min(0).max(7).optional(),
 folder:z.array(z.enum(knownFolders)).max(11).optional(),
 reviews:z.record(z.string(),z.array(review)).optional(),files:z.record(z.string(),z.array(file)).optional(),
 archives:z.array(z.object({title:z.string(),at:z.string(),snap:z.string().optional()}).passthrough()).max(200).optional(),
 userEvents:z.array(z.object({id:z.string().regex(/^[A-Za-z0-9_-]+$/),n:z.string(),t:z.enum(['shoot','promo','film','biz','variety','train','fan','rest']),a:z.number().int().min(1).max(31),b:z.number().int().min(1).max(31),time:z.string(),note:z.string()}).refine(v=>v.a<=v.b)).optional(),
 tasks:z.array(z.object({id:z.union([z.string(),z.number()]).optional(),col:z.number().int().min(0).max(2)}).passthrough()).optional(),
 tab:texts.optional(),ran:bools.optional(),seen:bools.optional(),checks:bools.optional(),
 adopt:z.number().int().min(0).max(2).nullable().optional(),
 formDrafts:z.record(z.string(),z.record(z.string(),z.union([z.string(),z.boolean()]))).optional(),
 bioEdits:texts.optional(),replyEdits:texts.optional(),
 hiddenEv:bools.optional(),evDone:bools.optional(),todayDone:bools.optional(),submitted:bools.optional(),pack:bools.optional(),
 packAdd:z.record(z.string(),z.array(text)).optional(),selfAns:texts.optional(),
 meals:z.array(z.object({t:z.string(),n:z.string(),k:z.number().finite().nonnegative()})).optional(),
 cycle:z.object({lastStart:z.number().finite(),len:z.number().int().min(1).max(365),dur:z.number().int().min(1).max(60)}).optional(),
 sym:z.record(z.string(),z.array(text)).optional(),inv:z.record(z.string(),z.enum(['yes','no'])).optional(),
 selDay:z.number().int().min(1).max(31).optional(),offer:z.number().int().min(0).max(2).optional(),
 wts:z.object({role:z.number().min(0).max(50),dir:z.number().min(0).max(50),team:z.number().min(0).max(50),sched:z.number().min(0).max(50),fee:z.number().min(0).max(50)}).optional(),
 userWorks:z.array(z.object({title:z.string(),year:z.string(),role:z.string(),genre:z.string(),note:z.string()})).optional(),
 projectInfo:z.object({director:z.string(),producer:z.string(),team:z.string(),notes:z.string()}).optional()
}).passthrough();
export function validateMain(raw,fresh) {
 const inspect=(x,depth=0)=>{if(depth>60)throw Error('资料层级过深');if(x&&typeof x==='object')for(const [k,v]of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(k))throw Error('资料含有无效字段');inspect(v,depth+1);}};inspect(raw);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('工作台状态必须是对象');
 const defaults=fresh();
 for(const [key,value] of Object.entries(defaults)) {
  if(raw[key]===undefined||value===null)continue;
  if(Array.isArray(value)){if(!Array.isArray(raw[key]))throw Error(key+'应为列表');}
  else if(typeof value==='object'){if(!raw[key]||typeof raw[key]!=='object'||Array.isArray(raw[key]))throw Error(key+'应为对象');}
  else if(typeof raw[key]!==typeof value)throw Error(key+'类型不正确');
 }
 for(const key of ['home','trip','body','charity','fans','deals','crisis','portfolio','brief','cycleOn','scopeTried'])if(raw[key]!==undefined&&typeof raw[key]!=='boolean')throw Error(key+'应为开关');
 const result=mainSchema.safeParse(raw);if(!result.success)throw Error('工作台资料校验失败：'+result.error.issues.map(i=>i.path.join('.')+' '+i.message).slice(0,3).join('；'));
 return {...defaults,formDrafts:{},bioEdits:{},replyEdits:{},userWorks:[],projectInfo:{director:'',producer:'',team:'',notes:''},...result.data};
}
