export const AREAS = [
  {id:'home', name:'今日工作', mark:'01', views:[['today','今日工作','待办、进行中的项目与下一步']]},
  {id:'discover', name:'热点早报', mark:'02', views:[['daily','全部','保留全部栏目与对应日期'],['people','人物','每日10位不同人物'],['culture','时尚界','品牌、秀场与时尚行业'],['apparel','服装','款式、面料、工艺与穿着'],['ai','AI','为创作寻找新方法'],['finance','财经','宏观、产业、企业与社会民生'],['comments','竞品评论洞察','按日期查看竞品高赞评论和观众在讨论的问题'],['othernews','其他','保留暂未映射的历史资料'],['hot','选题判断','判断角度并转成项目'],['refs','参考拆解','记录观察、假设和可迁移方法'],['events','公开活动','有出处的公告与日程']]},
  {id:'create', name:'项目创作', mark:'03', views:[['board','项目列表','按制作进度继续项目'],['topics','当前项目','素材、脚本分镜、提案、审稿和发布']]},
  {id:'assets', name:'素材库', mark:'04', views:[['assets','搜索全部素材','同时检索资料与已归集原件'],['materials','视频素材','参考片段、处理素材和动效'],['library','资料与证据','出处、原文和证据片段'],['transcripts','音视频逐字稿','本机转写或导入已有字幕']]},
  {id:'works', name:'我的作品', mark:'05', views:[['videos','完整作品','按作品归组，清晰度收在同一版本'],['process','制作过程','试剪、样片和试听']]},
  {id:'publish', name:'发布复盘', mark:'06', views:[['review','作品复盘','真实后台数据、复盘和下一步'],['calendar','发布排期','计划与实际发布分开记录']]},
  {id:'edit-plan', name:'分镜执行台', mark:'07', views:[['edit-plan','分镜执行台','在线脚本、分镜与素材执行计划']]},
  {id:'comment-inbox', name:'评论回复箱', mark:'08', views:[['comment-inbox','评论回复箱','本人评论、待审核回复与处理进度']]},
];
export const UTILITIES = [
  ['guide','使用说明','从一个真实项目开始'],['settings','设置与备份','连接、时区和恢复'],['ips','账号与IP','自己的账号和实际服务IP'],['tasks','采集任务','真实进度与失败重试'],['subscriptions','RSS设置','订阅源和站内简报'],['allarchive','原始档案','原目录与来源追溯'],['recycle','回收站','恢复移出的内容']
];
export const VIEW_ALIASES:Record<string,string> = {features:'guide',archive:'assets',assistant:'board',delivery:'board',multipost:'board'};
export const ALL_VIEWS = [...AREAS.flatMap(a=>a.views),...UTILITIES];
export function resolveView(id:string|null|undefined){const v=id&&VIEW_ALIASES[id]||id;return ALL_VIEWS.some(x=>x[0]===v)?v!:'today';}
export const viewTitle = (id:string)=>ALL_VIEWS.find(v=>v[0]===id)?.[1]||id;
export const areaFor = (id:string)=>AREAS.find(a=>a.views.some(v=>v[0]===id));
