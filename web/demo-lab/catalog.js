(function(root){
'use strict';
const F=root.ActorForms.F;
const extra={
 company:{name:'公司与工作室',fields:[F('name','主体名称','text',true),F('kind','主体类型','select',true,['影视工作室','公司','个人','其他']),F('registrationNo','登记编号'),F('jurisdiction','登记地区'),F('contact','对接人'),F('note','合作边界与备注','textarea')]},
 finance:{name:'收支与纳税准备',fields:[F('entity','所属主体','text',true),F('counterparty','往来方','text',true),F('direction','收支方向','select',true,['收入','支出']),F('currency','币种','select',true,['CNY','USD','EUR','HKD','GBP']),F('amount','事项金额（元）','money',true),F('due','预计收付日期','date'),F('status','台账进度','select',true,['待确认','待收付','已记录收付','待会计核验']),F('taxPeriod','税务资料期间（如 2026-Q4）'),F('accountant','确认会计'),F('note','分期、凭据与待核验问题','textarea')]},
 asset:{name:'资产管理',fields:[F('entity','所属主体','text',true),F('name','资产名称','text',true),F('serial','资产编号'),F('category','资产分类'),F('purchased','购置日期','date'),F('currency','币种','select',true,['CNY','USD','EUR','HKD','GBP']),F('cost','购置成本（元）','money'),F('location','存放位置'),F('holder','保管人'),F('status','资产状态','select',true,['在库','借出','维修','待盘点','已处置']),F('note','领用、归还与盘点说明','textarea')]},
 brand:{name:'品牌与产业',fields:[F('entity','权利所属主体','text',true),F('name','品牌或权利名称','text',true),F('rightsType','权利类型','select',true,['商标','著作权','授权使用','其他']),F('registrationNo','权利编号'),F('territory','适用地域与用途'),F('start','权利开始日期','date'),F('end','权利截止日期','date'),F('channel','渠道与对接人'),F('note','SKU、库存与合作计划','textarea')]},
 'social-account':{name:'内容账号',fields:[F('platform','平台','select',true,['抖音','小红书','B站','微博','视频号','其他平台']),F('name','账号名称','text',true),F('accountKey','平台账号标识','text',true),F('profileUrl','账号主页','url'),F('manager','负责人'),F('notes','定位、更新节奏与备注','textarea')]},
 'social-content':{name:'内容作品',fields:[F('category','内容分类','text',true),F('goal','创作目标','textarea'),F('description','脚本、素材与版本说明','textarea'),F('owner','负责人'),F('reviewer','审核人'),F('status','制作状态','select',true,['选题','制作中','待审核','已完成','暂缓']),F('dueAt','预计交付时间','datetime-local'),F('url','人工发布后的作品链接','url')]},
 'social-metric':{name:'作品表现',fields:[F('work','对应作品','text',true),F('platform','平台','select',true,['抖音','小红书','B站','微博','视频号','其他平台']),F('account','账号','text',true),F('asOf','数据截止时间','datetime-local',true),F('basis','统计口径','select',true,['累计快照','区间数据']),F('periodStart','区间起点（区间数据必填）','datetime-local'),F('views','播放量（未知留空）','count'),F('likes','点赞（未知留空）','count'),F('comments','评论（未知留空）','count'),F('shares','分享（未知留空）','count'),F('followers','账号粉丝总数（未知留空）','count'),F('source','数据来源与口径说明','textarea',true)]}
};
const groups=[{name:'一部戏的全过程',keys:['evaluation','contract','scene','dance','task','event','meeting','review','work']},{name:'团队与个人',keys:['message','right','knowledge','brief','goal','travel','health','crisis','charity']},{name:'经营与品牌',keys:['company','finance','asset','brand']},{name:'内容与账号',keys:['social-content','social-account','social-metric']}];
const MOD={...root.ActorForms.MOD,...extra};
const samples={
 evaluation:['《逆光来信》合作邀约',{counterparty:'晨屿影业（虚构）',role:'林知夏',fit:'人物目标清晰；试拍与训练可衔接。待确认导演与制作团队资料。',start:'2027-03-01',end:'2027-04-20',amount:'CNY 360,000（虚构报价，未签约）',status:'评估中',notes:'补充导演作品、制作履历、完整剧本；邀请经纪人与本人一起评估。'}],
 contract:['《逆光来信》合同交接清单',{counterparty:'晨屿影业（虚构）',scope:'角色表演与约定场次宣传；声音克隆、数字替身与训练用途单独书面授权。',start:'2027-03-01',end:'2027-04-20',payment:'签约、开机、杀青三个节点；具体金额由合同确认。',status:'待审核',notes:'确认加班、补拍、宣发范围与原件归档；此条非法律意见。'}],
 scene:['第 12 场：窗边的来信',{scene:'第 12 场 · 咖啡店 · 黄昏',objective:'让姐姐留下来听完信的最后一句。',obstacle:'姐姐一直避开视线；自己不愿暴露恐惧。',subtext:'“咖啡凉了”其实是在争取她再坐一分钟。',emotion:'克制 → 试探 → 短暂失控 → 收住。',action:'先移开杯子，再抬眼；读到名字时停两拍。',alternatives:'A：轻声念信，以停顿蓄力。B：先开玩笑，再突然认真。排练比较导演反馈。',notes:'不把每个情绪都做成表情；重点观察对手反应。'}],
 task:['补齐试拍资料',{owner:'小禾（虚构经纪）',due:'2027-02-20',status:'进行中',notes:'收齐完整剧本、导演履历与拍摄档期。完成标准：三项资料都有出处并经本人看过。'}],
 event:['围读与角色讨论',{start:'2027-03-04T14:00',end:'2027-03-04T16:00',location:'排练室 A（虚构）',owner:'把子肉、导演、编剧',status:'已确认',notes:'带剧本和第 12 场 A/B 笔记；提前 20 分钟到。'}],
 meeting:['围读会确认事项',{date:'2027-03-04',participants:'把子肉、小禾、导演（均为虚构示例）',notes:'讨论第 12 场与第 21 场。动作处理有两种方案，仍需试排。',decisions:'先录两版排练样片，现场对照。',actions:'小禾安排试排；把子肉补两版潜台词笔记。'}],
 knowledge:['拍摄日常见问题：原件如何交接',{category:'资料归档',question:'导演反馈、试排视频与最终选择如何一起保留？',answer:'视频按场次命名；记录时间码、反馈原话与选择理由；确认授权后再对外使用。',source:'团队自定流程（虚构）',status:'可复用'}],
 message:['观众留言：这场停顿很打动我',{source:'演示留言池（虚构）',url:'',text:'窗边那一停我看懂了，她其实是害怕姐姐走。',category:'作品反馈',tone:'真诚、轻松，不替角色下唯一结论',reply:'谢谢你认真看到那个停顿。也很想听听你对那封信的理解。',status:'待审核',reviewer:'小禾',publishedUrl:''}],
 right:['角色排练片段授权检查',{subject:'把子肉 / 晨屿影业（虚构）',asset:'试排视频、角色肖像与声音',scope:'团队内部讨论，不对外发布，不用于模型训练。',territory:'仅项目团队；不得转授权',start:'2027-03-01',end:'2027-05-01',evidence:'待取得制片方书面许可',status:'待法务',notes:'生成内容、声音克隆与商业投放另行确认，不因持有原件自动取得授权。'}],
 review:['《逆光来信》杀青复盘',{date:'2027-04-22',goal:'让第 12 场克制而有张力；完成 A/B 表演方案比较。',evidence:'虚构示例：两版试排笔记齐全；导演选择 A 的停顿与 B 的视线处理。',learned:'有效：先明确目的再排动作。不足：最后一句节奏仍偏快。',next:'下个项目保留读本录音；每周练一次听与反应。'}],
 work:['《逆光来信》角色档案',{role:'林知夏；主演（虚构）',date:'2027-04-20',url:'',evidence:'虚构练习项目，无真实播出与观众数据。',notes:'成长：更重视对手反应。待提升：重场戏后的情绪恢复。'}],
 dance:['第 21 场：舞蹈叙事训练',{date:'2027-03-06',theme:'从封闭走向信任，表现犹豫与打开。',music:'0:00–0:24 慢拍；0:24–0:48 加入重拍。',segments:'A 段收手与侧身；B 段向前一步；结尾保留呼吸。',observations:'00:18 重心变化是否表达犹豫？00:31 与对手的视线是否衔接？',teacher:'动作纠正与身体安全由专业老师判断，本记录只提供观察问题。',next:'带两个结尾版本请老师和导演判断。'}],
 brief:['行业资料核验练习',{sector:'影视',url:'https://example.invalid/research-demo',date:'2027-02-18',facts:'这是虚构的资料整理练习，不代表已采集或核验任何新闻。实际使用时替换为可访问原始来源。',inspiration:'尝试以角色排练日记串起拍前准备与作品讨论。',status:'未核实'}],
 goal:['2027 春季：表演与训练计划',{period:'2027-Q1',goal:'完成一个有细致人物弧线的项目，同时保持规律训练。',measure:'每个重点场次留一张表演卡；每月一次训练复盘。',owner:'把子肉与团队（虚构）',due:'2027-03-31',status:'执行中',notes:'最终取舍由本人和团队决定；此处可以随阶段目标调整。'}],
 travel:['围读前一天行程',{date:'2027-03-03',from:'上海（虚构）',to:'杭州（虚构）',booking:'待选高铁与住宿；不填身份证或票务密码。',contact:'团队联络人小禾（虚构）',status:'待确认',notes:'先核对通告，再订交通；出发前查真实天气与运营信息。'}],
 health:['训练后恢复记录',{date:'2027-03-06',type:'训练恢复',notes:'虚构体验：训练后记录休息与个人感受，不填写真实健康资料。',next:'2027-03-08',source:'如需诊疗，请以专业医生建议为准。'}],
 crisis:['公开沟通：片段误读待核实',{url:'https://example.invalid/signal-demo',facts:'虚构情境：流传片段缺少前后语境，尚无完整原片。',unknown:'最早出处、完整上下文、授权状态待核实。',draft:'我们正在核实完整情况；请以可核验资料为准，避免传播未经确认的信息。',reviewer:'团队负责人（虚构）',status:'核验中',publishedUrl:''}],
 charity:['社区阅读活动核验',{partner:'向光阅读项目（虚构机构）',verification:'虚构练习：需核对公开登记、负责人、执行报告；尚未真实核验。',commitment:'先讨论阅读分享，不作未经审核的捐赠承诺。',owner:'小禾（虚构）',due:'2027-05-01',status:'核验中',evidence:'待补原始资料与公开报告。'}],
 company:['向光影视工作室 · 主体卡',{name:'向光影视工作室（虚构）',kind:'影视工作室',registrationNo:'示例，无真实工商编号',jurisdiction:'上海（虚构设定）',contact:'小禾（虚构）',note:'用于练习区分经营主体、经纪合作方与品牌权利人；非工商查询结果。'}],
 finance:['《逆光来信》首期回款准备',{entity:'向光影视工作室（虚构）',counterparty:'晨屿影业（虚构）',direction:'收入',currency:'CNY',amount:'120000.00',due:'2027-03-01',status:'待会计核验',taxPeriod:'2027-Q1',accountant:'待指定',note:'虚构金额。补合同、回款凭据与会计确认；不是实际收款或税务申报。'}],
 asset:['排练用相机',{entity:'向光影视工作室（虚构）',name:'排练记录相机（虚构）',serial:'DEMO-CAM-001',category:'拍摄设备',purchased:'2027-02-01',currency:'CNY',cost:'6800.00',location:'排练室设备柜',holder:'小禾（虚构）',status:'借出',note:'借给角色排练组，预计围读后归还；实际领用需签收凭证。'}],
 brand:['向光日常 · 品牌权利卡',{entity:'向光影视工作室（虚构）',name:'向光日常（虚构品牌）',rightsType:'其他',registrationNo:'未申请，仅示例名称',territory:'计划仅团队内部概念讨论',start:'',end:'',channel:'线下阅读活动（拟）',note:'先核对商标及名称可用性，再讨论商品、库存和商业渠道。'}],
 'social-account':['把子肉的排练日记 · 账号卡',{platform:'小红书',name:'把子肉的排练日记（虚构）',accountKey:'demo-rehearsal',profileUrl:'',manager:'小禾（虚构）',notes:'每周一次排练片段与角色笔记；发布前核对授权。未连接真实平台。'}],
 'social-content':['一封信的三种读法',{category:'角色排练日记',goal:'让观众感受同一句台词在不同目的下的变化。',description:'虚构脚本：先展示一句原台词，再并排写三种潜台词。素材版本：竖屏 30 秒预览、封面草图、发布文案。',owner:'小禾（虚构）',reviewer:'把子肉',status:'待审核',dueAt:'2027-03-10T18:00',url:''}],
 'social-metric':['排练日记 · 一次虚构快照',{work:'一封信的三种读法（虚构）',platform:'小红书',account:'把子肉的排练日记（虚构）',asOf:'2027-03-12T18:00',basis:'累计快照',periodStart:'',views:'12800',likes:'840',comments:'76',shares:'',followers:'',source:'完全虚构的演示数据；分享与粉丝未提供，保持空白。不同平台或不同时间快照不直接相加。'}]
};
root.DemoCatalog=Object.freeze({MOD,groups,samples,extra});
})(globalThis);
