(function(root){
'use strict';
const F=(key,label,type='text',required=false,options)=>({key,label,type,required,options});
 const MOD={
 evaluation:{name:'合作评估',fields:[F('counterparty','对接方','text',true),F('role','邀约角色'),F('fit','角色与档期判断','textarea'),F('start','预计开始','date'),F('end','预计结束','date'),F('amount','报价（含币种，待合同确认）'),F('status','决定','select',true,['待资料','评估中','接受','婉拒']),F('notes','风险、缺资料与下一步','textarea')]},
 contract:{name:'合同与交接',fields:[F('counterparty','合作主体','text',true),F('scope','工作范围与权利','textarea',true),F('start','生效日期','date'),F('end','到期日期','date'),F('payment','付款节点','textarea'),F('status','状态','select',true,['草拟','待审核','签署','已履行','终止']),F('fileId','合同附件','fileRef'),F('notes','审核意见与修改记录','textarea')]},
 scene:{name:'表演笔记',fields:[F('scene','场次/原文定位','text',true),F('objective','人物当场目标','textarea',true),F('obstacle','阻力与关系','textarea'),F('subtext','潜台词','textarea'),F('emotion','情绪推进','textarea'),F('action','动作与反应','textarea'),F('alternatives','处理方式A/B与选择理由','textarea'),F('notes','排练反馈','textarea')]},
 task:{name:'协作任务',fields:[F('owner','负责人','text',true),F('due','截止日期','date',true),F('status','状态','select',true,['待办','进行中','待审核','完成','取消']),F('notes','任务内容、完成标准与交接','textarea',true)]},
 event:{name:'日历事项',fields:[F('start','开始时间','datetime-local',true),F('end','结束时间','datetime-local',true),F('location','地点'),F('owner','参与人'),F('status','状态','select',true,['待确认','已确认','完成','取消']),F('notes','通告、交通、准备事项','textarea')]},
 meeting:{name:'会议纪要',fields:[F('date','日期','date',true),F('participants','参会人员'),F('notes','原始纪要','textarea',true),F('decisions','确认的决定','textarea'),F('actions','行动项（再建任务落实）','textarea')]},
 knowledge:{name:'知识与FAQ',fields:[F('category','分类'),F('question','问题','textarea',true),F('answer','审核后的答案','textarea',true),F('source','依据或原文链接'),F('status','状态','select',true,['待审核','可复用','已过期'])]},
 message:{name:'留言与回复',fields:[F('source','平台与来源','text',true),F('url','原留言链接','url'),F('text','原始留言','textarea',true),F('category','分类','select',true,['作品反馈','支持鼓励','活动咨询','合作咨询','建议批评','待核实信号']),F('tone','回复语气'),F('reply','回复草稿','textarea'),F('status','状态','select',true,['待分类','待起草','待审核','已批准','已人工发布','不回复']),F('reviewer','审核人'),F('publishedUrl','人工发布链接','url')]},
 right:{name:'授权检查',fields:[F('subject','授权主体与对象','text',true),F('asset','素材/肖像/声音/表演数据','text',true),F('scope','用途、平台与商业范围','textarea',true),F('territory','地区与转授权限制'),F('start','授权开始','date'),F('end','授权到期','date'),F('evidence','授权依据与证明来源'),F('status','审核','select',true,['未确认','待法务','已获书面授权','禁止使用','已到期']),F('notes','撤回、删除与生成内容边界','textarea')]},
 review:{name:'项目复盘',fields:[F('date','复盘日期','date',true),F('goal','原定目标','textarea',true),F('evidence','实际结果与证据','textarea',true),F('learned','有效做法与不足','textarea'),F('next','下一步行动','textarea')]},
 work:{name:'作品档案',fields:[F('role','角色与本人职责','text',true),F('date','完成日期','date'),F('url','可公开作品链接','url'),F('evidence','成果与观众反馈（注明来源）','textarea'),F('notes','能力成长与待提升','textarea')]},
 dance:{name:'舞蹈训练',fields:[F('date','训练日期','date',true),F('theme','主题与叙事情绪','textarea',true),F('music','音乐与节拍段落'),F('segments','动作段落与编舞备选','textarea'),F('videoId','排练视频原件','fileRef'),F('observations','视频观察问题与时间码','textarea'),F('teacher','老师反馈与安全判断','textarea'),F('next','下次训练计划','textarea')]},
 brief:{name:'行业资料',fields:[F('sector','领域','select',true,['影视','舞蹈','音乐','时尚','AI内容']),F('url','公开来源链接','url',true),F('date','核验日期','date'),F('facts','原文事实与摘要','textarea',true),F('inspiration','合作灵感（观点）','textarea'),F('status','核验状态','select',true,['未核实','已读原文','已交叉核验','已失效'])]},
 goal:{name:'阶段规划',fields:[F('period','年度/季度','text',true),F('goal','目标与选择理由','textarea',true),F('measure','验收方式','textarea',true),F('owner','负责人'),F('due','复盘日期','date'),F('status','状态','select',true,['规划中','执行中','完成','调整','暂停']),F('notes','学习主题、作品方向与行动','textarea')]},
 travel:{name:'出行安排',fields:[F('date','日期','date',true),F('from','出发地'),F('to','目的地','text',true),F('booking','交通与住宿（不存证件号码）','textarea'),F('contact','团队联络'),F('status','状态','select',true,['待确认','已预订','已出发','完成','取消']),F('notes','天气来源与行前准备','textarea')]},
 health:{name:'私人健康记录',fields:[F('date','记录日期','date',true),F('type','记录类型','select',true,['休息与感受','就诊记录','训练恢复','复查提醒']),F('notes','本人填写的记录','textarea',true),F('next','复查或提醒日期','date'),F('source','医生建议/资料出处（如有）')]},
 crisis:{name:'公共沟通事项',fields:[F('url','信号原始链接','url',true),F('facts','已核验事实','textarea',true),F('unknown','尚不确定的信息','textarea'),F('draft','回应草稿','textarea'),F('reviewer','负责人/审核人'),F('status','状态','select',true,['核验中','待审核','已批准','已人工发布','归档']),F('publishedUrl','人工发布链接','url')]},
 charity:{name:'公益协作',fields:[F('partner','合作机构','text',true),F('verification','机构资质与核验来源','textarea',true),F('commitment','承诺事项与预算','textarea'),F('owner','负责人'),F('due','截止日期','date'),F('status','状态','select',true,['核验中','执行中','待反馈','已完成','取消']),F('evidence','执行记录与公开报告','textarea')]}
 };

 function validate(kind,input,{complete=false}={}){
  const def=MOD[kind];if(!def)return input;
  const day=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&s.slice(0,4)!=='0000';};
  for(const f of def.fields){const value=input[f.key];if(value===null||value===undefined||value===''){if(complete&&f.required)throw Error(f.label+'不能为空');continue;}if(typeof value!=='string'||value.length>100000)throw Error(f.label+'格式错误或过长');
   if(f.type==='date'&&!day(value))throw Error(f.label+'须为真实日期（YYYY-MM-DD）');
   if(f.type==='datetime-local'){const m=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);if(!m||!day(m[1])||+m[2]>23||+m[3]>59||+(m[4]||0)>59)throw Error(f.label+'须为真实日期和时间');}
   if(f.type==='select'&&!f.options.includes(value))throw Error(f.label+'不在允许选项中');
   if(f.type==='url'){let u;try{u=new URL(value);}catch{throw Error(f.label+'链接无效');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error(f.label+'须为不含账号密码的HTTP/HTTPS链接');}
  }
  for(const [start,end]of [['start','end']])if(input[start]&&input[end]&&input[end]<input[start])throw Error('结束时间不能早于开始时间');
  if(['message','crisis'].includes(kind)&&['已批准','已人工发布'].includes(input.status)&&!input.reviewer?.trim())throw Error('批准或发布前需要审核人');
  if(['message','crisis'].includes(kind)&&input.status==='已人工发布'&&!/^https:\/\//.test(input.publishedUrl||''))throw Error('请填写人工发布后的HTTPS链接');
  return input;
 }
 root.ActorForms=Object.freeze({F,MOD,validate});
})(globalThis);
