/* Shared browser/server contract. Counts absent at the source remain null. */
export const KINDS = ['social-account','social-content','social-release','social-metric','social-followers','social-plan'];
export const PLATFORMS = {douyin:'抖音',xiaohongshu:'小红书',bilibili:'B站',weibo:'微博',weixin:'视频号',kuaishou:'快手',youtube:'YouTube',other:'其他平台'};
export const RELEASE_STATUSES = ['计划中','待审核','待发布','已发布','失败','已下架'];
export const CONTENT_STATUSES = ['选题','制作中','待审核','已完成','暂缓'];
export const COUNT_FIELDS = ['views','impressions','likes','comments','shares','saves','coins','danmaku','attributedFollows'];
export const METRIC_FIELDS = [...COUNT_FIELDS,'avgWatchSeconds','completionRate'];
export const FIELD_LABELS = {views:'播放量',impressions:'曝光量',likes:'点赞',comments:'评论',shares:'分享',saves:'收藏',coins:'投币',danmaku:'弹幕',attributedFollows:'平台归因涨粉',avgWatchSeconds:'平均观看秒数',completionRate:'完播率 %',totalFollowers:'粉丝总数',newFollowers:'新增关注',unfollows:'取消关注',reportedNet:'平台报告净增'};
export const MAX_FILE = 32*1024*1024;
const fail = message => {throw Error(message);};
const obj = (v,label='资料') => {if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail(label+'格式错误');return v;};
const str = (v,label,max=2000,required=false) => {if(typeof v!=='string'||v.length>max||(required&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(label+'为空或长度/格式不正确');return v;};
const id = (v,label='业务ID') => {str(v,label,120,true);if(!/^[a-zA-Z0-9_-]+$/.test(v))fail(label+'格式错误');return v;};
const choice=(v,choices,label)=>{if(!choices.includes(v))fail(label+'不在允许范围');return v;};
const date=(v,label,optional=false)=>{if(optional&&v==='')return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v)))fail(label+'须为完整时间和时区');if(Number(v.slice(11,13))>23||Number(v.slice(14,16))>59||Number(v.slice(17,19))>59)fail(label+'时分秒不正确');const day=v.slice(0,10),ymd=day.split('-').map(Number);if(new Date(Date.UTC(ymd[0],ymd[1]-1,ymd[2])).toISOString().slice(0,10)!==day)fail(label+'日期不存在');return v;};
const day=(v,label,optional=false)=>{if(optional&&v==='')return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail(label+'日期不正确');return v;};
const url=(v,label)=>{str(v,label,2000);if(v){let u;try{u=new URL(v);}catch{fail(label+'格式不正确');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail(label+'只支持不含密码的 http/https 链接');}return v;};
const num=(v,label,{signed=false,float=false,max=Number.MAX_SAFE_INTEGER}={})=>{if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||(!float&&!Number.isSafeInteger(v))||(!signed&&v<0)||Math.abs(v)>max)fail(label+'须为有效数字，未知请留空');return v;};
function safeTree(v,depth=0){if(depth>20)fail('资料层级过深');if(Array.isArray(v)){if(v.length>10000)fail('单条资料项目过多');v.forEach(x=>safeTree(x,depth+1));}else if(v&&typeof v==='object'){obj(v);for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('资料含保留字段');safeTree(x,depth+1);}}}
export function fileMeta(v){obj(v,'原件');id(v.id,'原件ID');str(v.name,'原件名',300,true);str(v.type,'原件类型',200,true);num(v.size,'原件大小',{max:MAX_FILE});if(v.size===null||!/^[a-f0-9]{64}$/.test(v.sha256))fail('原件大小或校验值无效');return v;}
function source(v){obj(v,'来源');choice(v.kind,['manual','csv','api'],'来源类型');str(v.name,'来源说明',300,true);str(v.notes??'','来源备注',2000);if(v.file)fileMeta(v.file);return v;}
function base(b){safeTree(b);obj(b);id(b.id);if(typeof b.archived!=='boolean')fail('归档状态无效');if(b.importSource)source(b.importSource);if(JSON.stringify(b).length>500000)fail('单条资料过大，请拆分保存');}
export function validateRecord(kind,input){
 const b=structuredClone(input);base(b);if(!KINDS.includes(kind))fail('未知运营记录类型');
 if(kind==='social-account'){
  choice(b.platform,Object.keys(PLATFORMS),'平台');str(b.name,'账号名称',160,true);str(b.accountKey,'平台账号标识',200,true);url(b.profileUrl,'账号主页');str(b.manager,'负责人',120);str(b.notes,'备注',5000);
 }else if(kind==='social-content'){
  str(b.title,'作品标题',200,true);str(b.category,'内容分类',100,true);str(b.goal,'创作目标',2000);str(b.description,'脚本/说明',20000);str(b.owner,'负责人',120);str(b.reviewer,'审核人',120);choice(b.status,CONTENT_STATUSES,'制作状态');str(b.relatedProjectId,'关联影视项目',200);date(b.dueAt,'交付时间',true);
  if(!Array.isArray(b.assets)||b.assets.length>100)fail('单作品最多100个版本/素材');const seen=new Set();for(const a of b.assets){obj(a);id(a.id,'版本ID');if(seen.has(a.id))fail('作品版本ID重复');seen.add(a.id);choice(a.kind,['母片','剪辑','封面','文案','其他'],'素材类型');str(a.label,'版本名称',200,true);str(a.location,'原件位置',2000);str(a.notes,'版本备注',5000);str(a.rights,'授权/使用范围',2000);if(a.file)fileMeta(a.file);if(!a.file&&!a.location&&!a.notes)fail('版本须有原件、位置或文案');}
 }else if(kind==='social-release'){
  id(b.contentId,'所属作品');id(b.accountId,'发布账号');if(b.versionId)id(b.versionId,'发布版本');if(b.coverAssetId)id(b.coverAssetId,'封面版本');str(b.title,'平台标题',300,true);str(b.caption,'平台文案',20000);choice(b.status,RELEASE_STATUSES,'发布状态');date(b.plannedAt,'计划发布时间',true);date(b.publishedAt,'实际发布时间',true);url(b.url,'作品链接');str(b.postId,'平台作品ID',300);str(b.notes,'发布记录',5000);if(['已发布','已下架'].includes(b.status)&&(!b.publishedAt||(!b.url&&!b.postId)))fail('已发布作品须填写实际发布时间及作品链接或平台ID');
 }else if(kind==='social-metric'){
  id(b.releaseId,'所属发布记录');date(b.asOf,'数据截止时间');choice(b.basis,['cumulative','period'],'数据口径');date(b.periodStart,'区间起点',b.basis==='cumulative');if(b.basis==='cumulative'&&b.periodStart)fail('累计数据无需区间起点');if(b.basis==='period'&&Date.parse(b.periodStart)>=Date.parse(b.asOf))fail('区间起点须早于截止时间');obj(b.metrics,'指标');for(const key of METRIC_FIELDS)num(b.metrics[key],FIELD_LABELS[key],{float:!COUNT_FIELDS.includes(key),max:key==='completionRate'?100:Number.MAX_SAFE_INTEGER});if(METRIC_FIELDS.every(k=>b.metrics[k]===null))fail('至少填写一项作品指标');choice(b.precision,['exact','approximate'],'数据精度');source(b.source);if(typeof b.attributionConfirmed!=='boolean')fail('归因确认格式错误');str(b.attributionEvidence,'平台归因依据',2000);if(b.metrics.attributedFollows!==null&&(!b.attributionConfirmed||!b.attributionEvidence.trim()))fail('单条视频涨粉须有平台明确归因及依据');
 }else if(kind==='social-followers'){
  id(b.accountId,'所属账号');date(b.asOf,'数据截止时间');date(b.periodStart,'涨跌区间起点',true);for(const k of ['totalFollowers','newFollowers','unfollows'])num(b[k],FIELD_LABELS[k]);num(b.reportedNet,FIELD_LABELS.reportedNet,{signed:true});if([b.totalFollowers,b.newFollowers,b.unfollows,b.reportedNet].every(v=>v===null))fail('至少填写一项粉丝指标');if([b.newFollowers,b.unfollows,b.reportedNet].some(v=>v!==null)&&(!b.periodStart||Date.parse(b.periodStart)>=Date.parse(b.asOf)))fail('新增/取关/净增须填写早于截止时间的统计区间起点');if(b.newFollowers!==null&&b.unfollows!==null&&b.reportedNet!==null&&b.reportedNet!==b.newFollowers-b.unfollows)fail('净增与同区间新增减取关不一致');choice(b.precision,['exact','approximate'],'数据精度');source(b.source);
 }else if(kind==='social-plan'){
  str(b.title,'复盘名称',200,true);if(b.accountId)id(b.accountId,'复盘账号');day(b.startDate,'复盘开始日期');day(b.endDate,'复盘结束日期');if(b.startDate>b.endDate)fail('复盘开始须不晚于结束');str(b.findings,'数据发现',12000);str(b.decisions,'后续决策',12000);if(!Array.isArray(b.actions)||b.actions.length>100)fail('最多100项行动');const seen=new Set();for(const a of b.actions){obj(a);id(a.id,'行动ID');if(seen.has(a.id))fail('行动ID重复');seen.add(a.id);str(a.text,'行动内容',2000,true);str(a.owner,'行动负责人',120,true);day(a.dueDate,'行动截止日期');choice(a.status,['待办','进行中','已完成'],'行动状态');}
 }
 return b;
}
export function references(body){const out=[];function walk(v){if(!v||typeof v!=='object')return;if(!Array.isArray(v)&&typeof v.id==='string'&&'sha256'in v){fileMeta(v);out.push(v);return;}Object.values(v).forEach(walk);}walk(body);return out;}
export function snapshotKey(kind,b){if(kind==='social-account')return [kind,b.platform,b.accountKey.trim()].join('|');if(kind==='social-release'&&b.accountId&&(b.postId||b.url))return [kind,b.accountId,b.postId?'id:'+b.postId.trim():'url:'+b.url].join('|');if(kind==='social-metric')return [kind,b.releaseId,new Date(b.asOf).toISOString(),b.basis,b.periodStart?new Date(b.periodStart).toISOString():''].join('|');if(kind==='social-followers')return [kind,b.accountId,new Date(b.asOf).toISOString()].join('|');return kind+'|'+b.id;}
export function validateRelations(records){
 if(!Array.isArray(records))fail('运营记录列表格式错误');const maps=Object.fromEntries(KINDS.map(k=>[k,new Map()])),keys=new Set();
 for(const r of records){if(!KINDS.includes(r.kind))continue;const b=validateRecord(r.kind,r.body);if(maps[r.kind].has(b.id))fail('业务ID重复：'+b.id);maps[r.kind].set(b.id,b);const key=['social-metric','social-followers'].includes(r.kind)?snapshotKey(r.kind,b):r.kind+'|'+b.id;if(keys.has(key))fail('同账号/作品同一时刻存在重复快照');keys.add(key);}
 const get=(k,i,label)=>{const b=maps[k].get(i);if(!b)fail(label+'引用不存在');return b;};
 for(const b of maps['social-release'].values()){const c=get('social-content',b.contentId,'发布作品');get('social-account',b.accountId,'发布账号');for(const k of ['versionId','coverAssetId'])if(b[k]&&!c.assets.some(a=>a.id===b[k]))fail('发布版本不属于该作品');}
 for(const b of maps['social-metric'].values()){const r=get('social-release',b.releaseId,'指标所属发布');if(r.publishedAt&&Date.parse(b.asOf)<Date.parse(r.publishedAt))fail('作品指标截止时间早于实际发布');}
 for(const b of maps['social-followers'].values())get('social-account',b.accountId,'粉丝所属账号');
 for(const b of maps['social-plan'].values())if(b.accountId)get('social-account',b.accountId,'复盘账号');
 return true;
}
export const uid=()=>crypto.randomUUID();
export function emptyBody(kind){const common={id:uid(),archived:false};const source={kind:'manual',name:'',notes:''};return {...common,...({
 'social-account':{platform:'douyin',name:'',accountKey:'',profileUrl:'',manager:'',notes:''},
 'social-content':{title:'',category:'日常',goal:'',description:'',owner:'',reviewer:'',status:'选题',relatedProjectId:'',dueAt:'',assets:[]},
 'social-release':{contentId:'',accountId:'',versionId:'',coverAssetId:'',title:'',caption:'',status:'计划中',plannedAt:'',publishedAt:'',url:'',postId:'',notes:''},
 'social-metric':{releaseId:'',asOf:'',basis:'cumulative',periodStart:'',metrics:Object.fromEntries(METRIC_FIELDS.map(k=>[k,null])),precision:'exact',source,attributionConfirmed:false,attributionEvidence:''},
 'social-followers':{accountId:'',asOf:'',periodStart:'',totalFollowers:null,newFollowers:null,unfollows:null,reportedNet:null,precision:'exact',source},
 'social-plan':{title:'',accountId:'',startDate:'',endDate:'',findings:'',decisions:'',actions:[]}
 })[kind]};}
export function latestSnapshots(records,kind,{basis='cumulative'}={}){const map=new Map();for(const r of records.filter(r=>r.kind===kind&&!r.body.archived)){const b=r.body;if(kind==='social-metric'&&b.basis!==basis)continue;const key=kind==='social-metric'?b.releaseId:b.accountId,old=map.get(key);if(!old||Date.parse(b.asOf)>Date.parse(old.asOf))map.set(key,b);}return [...map.values()];}
export function followerChange(rows,accountId){const list=rows.filter(b=>!b.archived&&b.accountId===accountId).sort((a,b)=>Date.parse(a.asOf)-Date.parse(b.asOf)),last=list.at(-1);if(!last)return null;const base={asOf:last.asOf,approximate:last.precision==='approximate'};if(last.reportedNet!==null)return {...base,value:last.reportedNet,start:last.periodStart,method:'平台报告'};if(last.newFollowers!==null&&last.unfollows!==null)return {...base,value:last.newFollowers-last.unfollows,start:last.periodStart,method:'新增减取关'};if(last.totalFollowers===null)return null;const before=list.slice(0,-1).reverse().find(b=>b.totalFollowers!==null);return before?{...base,value:last.totalFollowers-before.totalFollowers,start:before.asOf,method:'总数快照差',approximate:base.approximate||before.precision==='approximate'}:null;}
export function comparableDelta(rows,field){const sorted=rows.filter(b=>!b.archived&&b.basis==='cumulative').sort((a,b)=>Date.parse(a.asOf)-Date.parse(b.asOf));if(sorted.length<2)return null;const [a,b]=sorted.slice(-2);if(a.releaseId!==b.releaseId||a.metrics[field]===null||b.metrics[field]===null)return null;return {value:b.metrics[field]-a.metrics[field],start:a.asOf,end:b.asOf,approximate:a.precision==='approximate'||b.precision==='approximate'};}
export function metricSummary(records,releaseIds,field){const latest=latestSnapshots(records,'social-metric').filter(b=>releaseIds.includes(b.releaseId)),known=latest.filter(b=>b.metrics[field]!==null),value=known.length?known.reduce((n,b)=>n+b.metrics[field],0):null,overflow=value!==null&&COUNT_FIELDS.includes(field)&&!Number.isSafeInteger(value);return {value:overflow?null:value,known:known.length,total:releaseIds.length,approximate:known.some(b=>b.precision==='approximate'),...(overflow?{overflow:true}:{})};}
