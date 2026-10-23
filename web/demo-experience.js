/* Guided demo uses the same records and controls as free exploration. */
((root) => {
  const check = (label, done, selector, tab) => ({label, done, selector, tab});
  const mission = (title, question, value, output, tab, checks) => ({title, question, value, output, tab, checks});
  const missions = [
    mission('选一部值得接的戏', '三个剧本同时送来，你会先看角色，还是先看档期？', '拖动评分权重，排序会按公式重新计算；最后接不接，由你决定。', '接戏评估卡', null, s => [
      check('展开三本对比，拖动一项权重', !!s.ran.compare && !!s.experience.checks.weights, s.ran.compare?'[data-wt="role"]':'[data-k="compare"]'),
      check('选《逆光来信》，查看初读报告', !!s.ran.take, '[data-k="take"], [data-act="pick"][data-v="nl"]'),
      check('确认接下，留下评估卡', s.folder.includes('take'), '[data-act="save"][data-k="take"]')]),
    mission('让理解回到剧本里', '许知夏为什么说“先让我把话说完”？她此刻知道寄信人是谁吗？', '先看潜台词，再对照原文，写下自己的判断。人物理解有依据，也留得下修改意见。', '原文核对与个人批注', 'sub', s => [
      check('展开第12场潜台词', !!s.ran.subtext, '[data-k="subtext"]', 'sub'),
      check('点一次“回到原文”核对', !!s.experience.checks.source, '[data-act="cite"][data-sc="12"]', 'sub'),
      check('写一句自己的理解，保存决定', !!s.reviews.st1?.length, '#rvText', 'sub')]),
    mission('同一场戏，选自己的演法', '这句台词要克制地说、试探地说，还是主动地说？', '选择会带进后面的预演标题与导出方案。节奏、视线、身体和风险一起比较。', '你选定的表演方案', 'scene', s => [
      check('展开情绪节拍与三种演法', !!s.ran.beats, '[data-k="beats"]', 'scene'),
      check('亲手点选一种处理方式', !!s.experience.checks.handling, '[data-act="handling"]', 'scene'),
      check('将选定方案存入资料夹', s.folder.includes('role'), '[data-act="save"][data-k="role"]', 'scene')]),
    mission('把讨论变成能看的画面', '和导演说“这里想停一下”，怎么让对方更快理解？', '把场次摊成五个镜头，讨论景别与时长；还可切到动态漫剧播放节奏示意。', '五镜头分镜表', 'board', s => [
      check('展开第12场轻量分镜', !!s.ran.shots, '[data-k="shots"]', 'board'),
      check('保存造型与分镜资料', s.folder.includes('prev'), '[data-act="save"][data-k="prev"]', 'board')]),
    mission('把会议变成有人负责的事', '“周五前确认探班口径”说过了，谁来跟进？', '从示例纪要展开任务，亲手推进一张卡；负责人、期限与状态留在同一处。', '可继续推进的任务看板', 'tasks', s => [
      check('把示例会议纪要展开成任务', !!s.ran.tasks, '[data-k="tasks"]', 'tasks'),
      check('推进一张任务卡，观察状态变化', !!s.experience.checks.taskMoved, '[data-act="move"]', 'tasks'),
      check('保存任务看板', s.folder.includes('shoot'), '[data-act="save"][data-k="shoot"]', 'tasks')]),
    mission('回复有温度，也有边界', '好评值得回应，私人酒店位置这类留言该怎么处理？', '将一条普通留言的草稿改成自己的语气，再提交当前版本审核。涉及隐私的留言走人工处理。', '你的回复草稿与审核快照', 'cmt', s => [
      check('查看分类，选一条作品讨论留言', !!s.ran.classify, '[data-k="classify"]', 'cmt'),
      check('修改普通留言的回复并保存', !!s.experience.checks.replyEdited, s.sel && s.sel!==6 && s.sel!==9?'.reply-editor':'[data-act="sel"][data-i="1"]', 'cmt'),
      check('提交这份修改稿供工作室审核', Object.values(s.replySubmissions).some(r => !r.risk && r.edited), '[data-act="submit"], [data-act="sel"][data-i="1"]', 'cmt')]),
    mission('合作之前，把边界问清楚', '品牌想用你的肖像、声音和动作做广告，授权到哪里为止？', '切换合作用途看核对项，写下哪些条件未确认；清单留给团队和律师继续处理。', '授权核对清单与人工意见', null, s => [
      check('展开五类授权核对项', !!s.ran.rights, '[data-k="rights"]'),
      check('切换一次用途，比较风险提示', !!s.scopeTried, '[data-act="scope"]'),
      check('保存清单，并写下自己的合作条件', s.folder.includes('deal') && !!s.reviews.st6?.length, s.folder.includes('deal') ? '#rvText' : '[data-act="save"][data-k="deal"]')]),
    mission('把经验带进下一部戏', '一部戏结束，什么值得带走，什么下次要换一种做法？', '留下一条自己的复盘，再导出刚才的选择、批注、任务与回复。刷新后也可以接着用。', '属于你的体验成果单', 'self', s => [
      check('至少回答一道表演自评', Object.values(s.selfAns || {}).some(t => t.trim()), '[data-self="0"]', 'self'),
      check('查看示例总结并保存复盘', s.folder.includes('review'), s.ran.selfrev ? '[data-act="save"][data-k="review"]' : '[data-k="selfrev"]', 'self')])
  ];
  function statuses(s) { return missions.map(m => {const checks=m.checks(s);return {...m,checks,done:checks.every(c=>c.done)};}); }
  function normalize(s) {s.experience ??= {active:false,step:0,checks:{}};s.replySubmissions ??= {};return s;}
  function report(s,d) {
    const all=statuses(s), h=d.handlings.find(h=>h.id===s.handling), scope=d.scopes[s.scope];
    const lines=['# 《'+d.project.title+'》我的体验成果单','','> 项目、人物和分析为虚构预置示例。下方“我的操作”来自本浏览器实际保存的记录；未调用真实模型，也未对外发布。','',`已完成 ${all.filter(m=>m.done).length}/8 个体验任务；资料夹 ${s.folder.length}/11 项。`,''];
    all.forEach((m,i)=>{lines.push(`## ${i+1}. ${m.title}（${m.done?'已完成':'尚未完成'}）`,...m.checks.map(c=>`- [${c.done?'x':' '}] ${c.label}`),'');});
    if(s.ran.compare)lines.push('## 我的评分权重',...Object.entries(s.wts||d.scoreRule.weights).map(([k,v])=>`- ${{role:'角色分量',dir:'年度方向',team:'团队与平台',sched:'档期',fee:'片酬'}[k]}：${v}`),'','权重会归一化计算；评分依据为预置示例数据。','');
    if(s.ran.subtext)lines.push('## 我核对的第12场原文',d.script.find(x=>x.id===12)?.text||'（查看工作台原文）','','潜台词属于推断，不能把角色在结局才知道的信息提前演出来。','');
    if(s.folder.includes('role'))lines.push('## 我选的演法：'+h.k,`- 节奏：${h.rhythm}`,`- 视线：${h.eye}`,`- 身体：${h.body}`,`- 风险：${h.risk}`,'');
    if(s.folder.includes('prev'))lines.push('## 分镜节奏示意（预置镜头）',...d.shots.map(x=>`- 镜头${x.no}｜${x.size}｜${x.dur}秒｜${x.act}`),'','三种演法共用预置画面，选择不会重新生成图片或视频。','');
    if(s.ran.tasks)lines.push('## 我推进的任务',...s.tasks.map(x=>`- ${['待办','进行中','已完成'][x.col]}｜${x.t}｜${x.who}｜${x.due}`),'');
    lines.push(...replyReport(s,d));
    if(s.ran.rights)lines.push('## 我选择的授权用途：'+scope.n,scope.d,...d.dims.map(x=>`- ${x.n}：${d.lvText[scope.lv[x.id]]}；${x.q.join(' / ')}`),'','这些是示例核对问题，不代表法律结论或已获得授权。','');
    for(const[k,list]of Object.entries(s.reviews))if(list.length)lines.push('## 我的人工批注 · '+(k.startsWith('st')?d.stations[+k.slice(2)]?.name||k:k),...list.map(r=>`- ${r.at} ${r.who}：${r.text}`),'');
    if(Object.values(s.selfAns||{}).some(t=>t.trim()))lines.push('## 我的表演复盘',...d.selfQ.map((q,i)=>`- ${q}\n  ${s.selfAns?.[i]||'（未填写）'}`),'');
    lines.push('---','演示中可真实保存、编辑、刷新恢复和导出。AI 结果是预置示例；真实资料分析需进入实战版配置自己的模型。文字成果不包含附件原件，恢复资料请另导出完整备份。');return lines.join('\n');
  }
  function replyReport(s,d){
    const lines=[];
    for(const c of d.comments){const submitted=s.replySubmissions[c.id],drafts=['warm','play','formal'].filter(t=>s.replyEdits['comment-'+c.id+'-'+t]!==undefined);if(!submitted&&!drafts.length)continue;
      lines.push('## 留言与回复 · '+c.u,'原留言：'+c.t);
      for(const tone of drafts)lines.push(`- 已保存草稿（${{warm:'温暖',play:'俏皮',formal:'正式'}[tone]}）：${s.replyEdits['comment-'+c.id+'-'+tone]}`);
      if(submitted)lines.push(`- 提交审核快照（${submitted.at}，${submitted.risk?'转人工处理':'待人工确认'}）：${submitted.text}`);
      lines.push('未自动发送或发布。','');
    }return lines;
  }
  const capabilities=[
    ['今日与日历',-1,'event','studio','日程可新增、勾选；重叠与工作日统计即时重算。'],
    ['项目与合作',0,'evaluation','script','补导演、制作团队和判断条件，比较三本。'],
    ['剧本研读',1,'knowledge','script','关系、潜台词和重点场次示例可回到原文。'],
    ['表演准备',2,'scene','performance','比较三种演法，保存自己的动作与目标笔记。'],
    ['造型与分镜',3,null,'previs','预置造型、五镜头分镜和动态漫剧节奏预览。'],
    ['工作室协作',4,'task','studio','任务可以自己新增、编辑和推进；纪要与FAQ可记录。'],
    ['粉丝沟通',5,'message','fans','改回复、换语气、保存审核快照，重要回复人工确认。'],
    ['内容与账号运营',null,'social-content','fans','录入作品、账号与表现，试着导入或导出自己的数据。'],
    ['版权与数字人',6,'right','rights','切换用途比较核对项，保留授权条件与人工意见。'],
    ['作品与复盘',7,'review','script','作品、自评和下一步行动留在记录里。'],
    ['舞蹈训练',2,'dance','performance','看示例舞段；训练主题、节奏与观察可自己填写。'],
    ['行业信息',-9,'brief','script','资讯示例分核验状态，自己的来源和判断可另行录入。'],
    ['发展规划',-8,'goal','studio','看定位雷达示例，再写自己的阶段目标。'],
    ['出行与健康',-2,'travel','life','出行清单可勾选；安排与私人健康记录可分别填写。'],
    ['公共沟通',-7,'crisis','fans','先整理已知事实与未知信息，再保留待审核口径。'],
    ['公益项目',-4,'charity','fans','整理合作对象、承诺、核验状态与后续行动。'],
    ['公司与品牌',null,'company','business','公司、财务、资产和品牌演示台账可增改、导出。'],
    ['肉肉生活',-10,null,'pet','完整狗狗封面、图标卡片、日常记录与时光机。'],
    ['图解使用说明',-11,null,'script','八阶段地图、功能图卡与表单字段随构建维护。'],
    ['账号与AI连接',null,null,'rights','实战版可连接演员自己的模型；演示版展示部署说明。']
  ].map(([name,page,kind,art,description])=>({name,page,kind,art,description}));
  const visions=[
    {id:'voice',title:'会接戏的台词搭档',art:'performance',lead:'为角色选择对手语气，录下自己的接词，再回听表演节奏。',choices:['克制的对手','情绪更外放的对手'],steps:['选择有权使用的场次和对手角色','调整对手语气，录制自己的接词','回听停顿、重音和反应，留下训练问题'],result:'概念效果：同一句对手台词，提供两种表演方向；接词录音与回听将由后续语音服务实现。当前仅为交互式流程预览。'},
    {id:'film',title:'把分镜变成一段成片',art:'previs',lead:'从同一场戏出发，比较不同风格的预演方向。',choices:['窗边的柔和日光','雨后的冷色夜景'],steps:['选择场次、已获许可的造型和参考图','确认镜头、表演方向与生成预算','生成后逐镜审核，再导出预演版本'],result:'概念效果：将角色、造型和镜头接成视频生成流程。当前的动态漫剧是预置分镜播放；此处不生成新的AI视频。'},
    {id:'radar',title:'替团队守着重要信息',art:'fans',lead:'按自己关心的话题整理来源，看到变化再决定是否跟进。',choices:['作品与观众反馈','行业与合作线索'],steps:['选择公开来源、关键词和核验标准','汇总变化、标记出处与待核实项','整理成简报，由团队确认下一步'],result:'概念效果：从来源卡片走到提醒与简报。当前可手动录入、导入和整理信息；持续联网监测与主动通知尚未接入。'},
    {id:'double',title:'有边界的数字分身',art:'rights',lead:'先把允许与禁止写清楚，再讨论数字形象可以做什么。',choices:['仅限团队内部预演','商业广告，须逐条批准'],steps:['核对肖像、声音、动作数据来源与授权','限制用途、期限、地域和转授权','生成后人工确认，保留撤回与销毁记录'],result:'概念效果：用许可范围管理数字内容制作。当前提供授权检查记录与用途示例；没有训练或生成任何人的数字分身。'},
    {id:'world',title:'让作品走向世界',art:'previs',image:'assets/illustrations/world-footprint-concept-v1.webp',lead:'用彩色地球整理作品传播、影展活动与国际合作的足迹。',choices:['作品传播','影展与活动','国际合作'],steps:['团队补充有出处的地区、平台、日期与合作信息','区分实际发生和计划中的足迹','在地图上点击地区，展开对应作品与记录'],result:'静态概念效果图：尚未接入地理与发行数据，图上连线均为虚构示意。未来可由团队录入资料后展示，不用热度猜测地域分布。'}
  ];
  root.DemoExperience = {missions,statuses,normalize,report,replyReport,capabilities,visions};
})(globalThis);
