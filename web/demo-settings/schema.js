(function(root){'use strict';
const fail=message=>{throw Error(message);},plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function shape(v,keys,label){if(!plain(v))fail(label+'格式无效');for(const key of Object.keys(v))if(!keys.includes(key))fail(label+'不接受密钥、密码或额外字段');}
function text(v,max,required=false){return typeof v==='string'&&v.length<=max&&(!required||v.trim())&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);}
const id=v=>text(v,200,true)&&/^[A-Za-z0-9_-]+$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
function validate(input){shape(input,['version','active','members','connections','invites','activity','passwordDrills'],'配置演练');if(input.version!==1||!Array.isArray(input.members)||!Array.isArray(input.connections)||!Array.isArray(input.invites)||!Array.isArray(input.activity))fail('配置演练格式不正确');const s=structuredClone(input);if(s.members.length>100||s.connections.length>100||s.invites.length>100||s.activity.length>500)fail('演练记录过多');const ids=new Set();
 for(const m of s.members){shape(m,['id','name','role'],'成员');if(!id(m.id)||ids.has(m.id)||!['owner','editor','viewer'].includes(m.role)||!text(m.name,100,true))fail('成员资料无效');ids.add(m.id);}
 if(s.members.filter(m=>m.role==='owner').length!==1||!ids.has(s.active))fail('必须保留一位管理员和当前身份');const connectionIds=new Set();
 for(const c of s.connections){shape(c,['id','name','provider','model','baseUrl','visibility','owner','purpose','checked','revision'],'模型配置');if(!id(c.id)||connectionIds.has(c.id)||!text(c.name,100,true)||!['deepseek','openai','anthropic','compatible','codex','claude-code'].includes(c.provider)||!text(c.model,300,true)||!text(c.baseUrl,2000)||!['team','private'].includes(c.visibility)||!ids.has(c.owner)||!text(c.purpose,2000)||!Number.isSafeInteger(c.revision)||c.revision<1||typeof c.checked!=='boolean')fail('连接配置字段无效');connectionIds.add(c.id);if(c.baseUrl){let u;try{u=new URL(c.baseUrl);}catch{fail('连接地址无效');}if(u.protocol!=='https:'||u.username||u.password||[...u.searchParams.keys()].some(k=>/^(?:api[-_]?key|key|access[-_]?token|token|secret|password|authorization)$/i.test(k)))fail('连接地址须为不含凭据或密钥参数的HTTPS链接');}}
 const invitationIds=new Set();for(const inv of s.invites){shape(inv,['id','name','role','accepted'],'邀请');if(!id(inv.id)||invitationIds.has(inv.id)||!text(inv.name,100,true)||!['editor','viewer'].includes(inv.role)||typeof inv.accepted!=='boolean')fail('邀请演练资料无效');invitationIds.add(inv.id);}
 const eventIds=new Set();for(const event of s.activity){shape(event,['id','text','at','who'],'操作记录');if(!id(event.id)||eventIds.has(event.id)||!text(event.text,2000,true)||!text(event.who,100,true)||!text(event.at,50,true)||!Number.isFinite(Date.parse(event.at)))fail('操作记录格式无效');eventIds.add(event.id);}
 if(!Number.isSafeInteger(s.passwordDrills)||s.passwordDrills<0)fail('演练次数无效');return s;
}
root.DemoSettingsSchema=Object.freeze({validate});
})(globalThis);
