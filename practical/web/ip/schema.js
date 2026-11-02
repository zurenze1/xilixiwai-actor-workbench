(function(root){
  'use strict';
  const f=(key,label,type='text',required=false,options)=>({key,label,type,required,options});
  const D={
    'ip-topic':{name:'选题',route:'topics',fields:[f('audience','给谁看','text',true),f('question','解决什么问题','textarea',true),f('angle','这次从哪个角度讲','textarea'),f('evidence','案例、原话与事实依据','textarea'),f('sourceUrl','参考来源','url'),f('owner','负责人'),f('due','讨论日期','date'),f('status','状态','select',true,['待讨论','已确认','搁置']),f('notes','讨论反馈','textarea')]},
    'ip-content':{name:'稿件',route:'content',fields:[f('topicId','关联选题','topic'),f('format','内容形式','select',true,['口播','采访','图文','长文章','直播提纲']),f('platform','计划平台','select',true,['抖音','视频号','小红书','B站','公众号','YouTube','其他']),f('audience','目标受众'),f('hook','标题与开头','textarea'),f('outline','结构与证据','textarea'),f('script','正文 / 逐字稿','textarea',true),f('cta','希望观众接下来做什么'),f('owner','负责人'),f('due','稿件截止','date'),f('status','状态','select',true,['写作中','待IP审核','需修改','已确认','已拍摄','已发布']),f('reviewer','确认人'),f('reviewedAt','确认日期','date'),f('reviewNote','IP反馈与修改意见','textarea')]},
    'ip-shoot':{name:'拍摄计划',route:'shoots',fields:[f('contentId','关联稿件','content',true),f('start','开始时间','datetime-local',true),f('end','结束时间','datetime-local',true),f('location','拍摄地点','text',true),f('owner','拍摄负责人','text',true),f('shots','镜头 / 采访问题（每行一项）','textarea'),f('checklist','准备清单（每行一项，用 [x] 标记完成）','textarea'),f('materials','素材位置 / 文件夹说明','textarea'),f('status','状态','select',true,['待准备','待拍摄','拍摄完成','取消']),f('notes','现场反馈与补拍事项','textarea')]},
    'ip-task':{name:'任务',route:'schedule',fields:[f('contentId','关联稿件','content'),f('owner','负责人','text',true),f('due','截止日期','date',true),f('status','状态','select',true,['待办','进行中','待审核','完成','取消']),f('notes','做什么、怎样算完成','textarea',true)]},
    'ip-event':{name:'日程',route:'schedule',fields:[f('start','开始时间','datetime-local',true),f('end','结束时间','datetime-local',true),f('location','地点'),f('owner','参与人'),f('status','状态','select',true,['待确认','已确认','完成','取消']),f('notes','准备事项 / 会议决定','textarea')]},
    'ip-release':{name:'发布与数据',route:'operations',fields:[f('contentId','关联稿件','content',true),f('platform','发布平台','select',true,['抖音','视频号','小红书','B站','公众号','YouTube','其他']),f('account','账号名称','text',true),f('plannedAt','计划发布时间','datetime-local'),f('publishedAt','实际发布时间','datetime-local'),f('url','作品链接','url'),f('status','状态','select',true,['待发布','已发布','取消']),f('measuredAt','数据采集时间','datetime-local'),f('views','播放 / 阅读数','count'),f('likes','点赞','count'),f('comments','评论','count'),f('shares','分享','count'),f('saves','收藏','count'),f('leads','有效咨询数','count'),f('completion','完播率（%，平台有此指标时填）','percent'),f('dataSource','数据来源与统计口径'),f('notes','有效片段、流失位置与观众反馈','textarea')]},
    'ip-account':{name:'矩阵账号',route:'operations',fields:[f('platform','平台','select',true,['抖音','小红书','视频号','B站','公众号','YouTube','其他']),f('handle','平台账号ID','text',true),f('profileUrl','账号主页','url',true),f('notes','定位、分工与备注','textarea')]},
    'ip-account-snapshot':{name:'账号数据快照',route:'operations',fields:[f('accountId','所属账号','account',true),f('measuredOn','采集日期','date',true),f('followers','粉丝数','count'),f('followersDisplay','平台粉丝原显示（例如206.7万）'),f('dataSource','数据来源','text',true),f('sourceUrl','数据来源链接','url',true),f('sourceMode','采集方式','select',true,['人工记录','历史资料']),f('scope','统计口径','select',true,['平台主页累计']),f('notes','近似值、差异与使用说明','textarea')]},
    'ip-work-snapshot':{name:'作品数据快照',route:'operations',fields:[f('accountId','所属账号','account',true),f('url','作品链接','url',true),f('publishedOn','作品发布日期（未知则留空）','date'),f('measuredOn','采集日期','date',true),f('views','累计播放 / 阅读','count'),f('viewsDisplay','播放 / 阅读原显示'),f('likes','累计点赞','count'),f('likesDisplay','点赞原显示'),f('comments','累计评论','count'),f('shares','累计分享','count'),f('saves','累计收藏','count'),f('dataSource','数据来源与指标口径','text',true),f('sourceMode','采集方式','select',true,['人工记录','历史资料']),f('scope','统计口径','select',true,['作品当前累计']),f('notes','指标近似值与说明','textarea')]},
    'ip-review':{name:'运营复盘',route:'operations',fields:[f('contentId','关联稿件','content'),f('date','复盘日期','date',true),f('goal','原定目标','textarea',true),f('evidence','实际结果与证据','textarea',true),f('learned','哪些有效、哪些还不确定','textarea'),f('next','下次只改什么','textarea',true),f('owner','负责人'),f('due','行动截止','date'),f('status','状态','select',true,['待行动','已落实'])]},
    'ip-deal':{name:'商务合作',route:'business',fields:[f('counterparty','合作方','text',true),f('contact','工作联系人'),f('scope','交付内容与验收标准','textarea',true),f('currency','币种','select',true,['CNY','USD','HKD','EUR']),f('amount','合同金额','money'),f('received','累计已收','money'),f('due','交付截止','date'),f('paymentDue','约定回款日期','date'),f('status','状态','select',true,['洽谈中','待签约','执行中','待验收','待回款','已结清','未合作']),f('owner','负责人'),f('fileId','合同 / 需求附件','file'),f('notes','付款节点、授权范围与下一步','textarea')]},
    'ip-profile':{name:'IP资料',route:'library',fields:[f('category','分类','select',true,['IP定位','个人经历','观点故事','产品服务','常见问题','素材授权','工作方法']),f('summary','内容','textarea',true),f('audience','适用受众 / 场景'),f('sourceUrl','来源链接','url'),f('verifiedAt','确认 / 查阅日期','date'),f('status','状态','select',true,['待确认','已确认','可复用','已过期']),f('fileId','照片、视频或文档原件','file'),f('notes','使用边界、出处与待确认项','textarea')]}
  };
  D['ip-finalcheck']={name:'成片核对单',route:'final-check',fields:[f('contentId','关联稿件（可稍后补充）','content'),f('cutVersion','成片文件名 / 剪辑版本','text',true),f('checks','成片核对','final-checks',true),f('notes','发现的问题与处理记录','textarea')]};
  const approved=new Set(['已确认','已拍摄','已发布']);
  function day(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&!s.startsWith('0000');}
  function cents(s){if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(s)))throw Error('金额须为非负数，最多两位小数和十位整数');const [a,b='']=String(s).split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
  function validate(kind,b){
    const def=D[kind];if(!def)throw Error('IP记录类型无效');
    if(!b||typeof b!=='object'||Array.isArray(b))throw Error('记录格式无效');
    const allowed=new Set([...def.fields.map(f=>f.key),'archived','templateId']);
    for(const [k,v]of Object.entries(b)){if(!allowed.has(k))throw Error('不支持的字段：'+k);if(k==='archived'){if(typeof v!=='boolean')throw Error('归档状态无效');continue;}if(typeof v!=='string'||v.length>100000)throw Error('字段格式无效或过长');}
    for(const x of def.fields){const v=b[x.key]??'';if(!v.trim()){if(x.required)throw Error(x.label+'不能为空');continue;}
      if(x.type==='select'&&!x.options.includes(v))throw Error(x.label+'不在允许范围');
      if(x.type==='date'&&!day(v))throw Error(x.label+'须为真实日期');
      if(x.type==='datetime-local'){const m=v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);if(!m||!day(m[1])||+m[2]>23||+m[3]>59)throw Error(x.label+'须为真实日期和时间');}
      if(x.type==='url'){let u;try{u=new URL(v);}catch{throw Error(x.label+'无效');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error(x.label+'须为不含凭据的HTTP/HTTPS链接');}
      if(x.type==='count'&&(!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))))throw Error(x.label+'须为非负整数');
      if(x.type==='percent'&&(!/^\d+(?:\.\d+)?$/.test(v)||Number(v)>100))throw Error(x.label+'须在0到100之间');
      if(x.type==='money')cents(v);
    }
    if(kind==='ip-finalcheck'&&!/^[01]{14}$/.test(b.checks||''))throw Error('成片核对需要完整的14项勾选状态');
    if(b.start&&b.end&&b.end<=b.start)throw Error('结束时间须晚于开始时间');
    if(kind==='ip-content'&&approved.has(b.status)&&(!b.reviewer?.trim()||!b.reviewedAt))throw Error('确认稿件前请填写确认人和确认日期');
    if(kind==='ip-release'&&b.status==='已发布'&&(!b.publishedAt||!b.url))throw Error('已发布作品需要实际发布时间和作品链接');
    if(kind==='ip-release'&&['views','likes','comments','shares','saves','leads','completion'].some(k=>b[k]!==''&&b[k]!==undefined)&&(!b.measuredAt||!b.dataSource?.trim()))throw Error('填写数据时请记录采集时间和数据来源');
    if(['ip-account-snapshot','ip-work-snapshot'].includes(kind)&&b.measuredOn&&b.publishedOn&&b.publishedOn>b.measuredOn)throw Error('发布日期不能晚于采集日期');
    if(kind==='ip-account-snapshot'&&(b.followers===undefined||b.followers===''))throw Error('请填写粉丝数；缺失时不要用0代替');
    if(kind==='ip-deal'){if(b.received&&!b.amount)throw Error('填写已收金额前请填写合同金额');if(b.amount&&b.received&&cents(b.received)>cents(b.amount))throw Error('累计已收不能超过合同金额');if(b.status==='已结清'&&(!b.amount||cents(b.amount)!==cents(b.received||'0')))throw Error('已结清需要金额与实收相符');}
    return b;
  }
  root.IPSchema=Object.freeze({D,kinds:Object.keys(D),validate,cents,day,approved});
})(globalThis);
