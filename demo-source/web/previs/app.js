(async function () {
  'use strict';
  const Schema = window.PrevisSchema, KEY = 'previs-v1', $ = s => document.querySelector(s), esc = PrevisExport.esc;
  const themes = ['tide','butter','moss'];
  const setTheme = t => { if (themes.includes(t)) document.documentElement.dataset.theme = t; };
  setTheme(new URLSearchParams(location.search).get('theme') || 'tide');
  let store, client, state, selected = '', library = [], player, urls = {}, pendingTimer, writes = Promise.resolve(), dirty = false, version = 0, tab = 'shots', locked = false, failed = false, imageObserver;
  const loadingImages = new Map();
  let activeTask=Promise.resolve();
  const format = n => Number(n).toFixed(2) + 's';
  const clone = x => structuredClone(x);
  const error = e => { $('#error').hidden = false; $('#error').textContent = e?.message || String(e); };
  const clearError = () => { $('#error').hidden = true; $('#error').textContent = ''; };
  const notice = msg => { $('#notice').textContent = msg; $('#notice').hidden = !msg; };
  const status = text => { $('#save-status').textContent = text; };
  function invalid() { const input = $('#app').querySelector('input:invalid,textarea:invalid'); if (input) { input.reportValidity(); return true; } return false; }
  function changed() {
    dirty = true; version++; status('未保存'); failed = false; clearTimeout(pendingTimer);
    if (!invalidSilent()) pendingTimer = setTimeout(() => flush().catch(error), 400);
    parent.postMessage({type:'previs:dirty',dirty:true},location.origin);
  }
  const invalidSilent = () => !!$('#app').querySelector('input:invalid,textarea:invalid');
  async function flush() {
    clearTimeout(pendingTimer);
    if (!client) throw new Error('项目尚未连接，暂不能保存');
    if (invalidSilent()) throw new Error('镜头时长无效，请先填写0.1至600秒');
    if (!dirty) { await writes; return clone(state); }
    const snapshot = Schema.validate(state), at = version;
    status('保存中…');
    const job = writes.catch(() => {}).then(async () => {
      try {
        const saved = await client.save(snapshot);
        if (at === version) { state = Schema.validate(saved); dirty = false; failed = false; clearError(); status('已保存'); parent.postMessage({type:'previs:dirty',dirty:false},location.origin); }
        return saved;
      } catch (e) { failed = true; status('保存失败 · 可重试'); throw e; }
    });
    writes = job; return job;
  }
  async function busy(action, fn) {
    if (locked) return;
    let finish;activeTask=new Promise(resolve=>{finish=resolve});
    locked = true; $('#app').inert = true; $('#export-status').textContent = action;
    try { clearError(); await fn(); } catch (e) { error(e); $('#export-status').textContent = e.message; }
    finally { locked = false; $('#app').inert = false;finish(); }
  }
  async function whenIdle(){await activeTask;return flush()}
  function imageOptions(value) { return '<option value="">未选择图片</option>' + library.map(f => `<option value="${esc(f.id)}" ${f.id === value ? 'selected' : ''}>${esc(f.name)}</option>`).join(''); }
  function addRef(fileId) {
    if (!fileId) return;
    const meta = library.find(x => x.id === fileId); if (!meta) throw new Error('该图片不在本项目，请刷新列表');
    if (!state.files.some(x => x.id === meta.id)) state.files.push(Schema.file(meta));
  }
  function pruneRefs() {
    const refs = new Set([...state.shots, ...state.looks].map(x => x.imageId));
    state.files = state.files.filter(x => refs.has(x.id));
  }
  async function readOriginal(meta) {
    const blob = await store.getFile(meta.id);
    if (!(blob instanceof Blob) || !blob.size || !/^image\/(png|jpeg|webp|gif)$/i.test(blob.type || meta.type)) throw new Error('图片无法读取：' + meta.name);
    const bytes=await blob.arrayBuffer(), hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(blob.size!==meta.size||hash!==meta.sha256)throw new Error('原件大小或哈希不一致：'+meta.name);
    return blob;
  }
  async function readImage(meta) {
    const blob=await readOriginal(meta);
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch { URL.revokeObjectURL(url); throw new Error('附件不是可解码的图片：' + meta.name); }
    return url;
  }
  async function ensureImage(id) {
    if (urls[id]) return urls[id];
    if (loadingImages.has(id)) return loadingImages.get(id);
    const meta=library.find(x=>x.id===id); if(!meta)throw new Error('图片不在当前项目中');
    const work=readImage(meta).then(url=>{urls[id]=url;return url}).finally(()=>loadingImages.delete(id));
    loadingImages.set(id,work);return work;
  }
  function checkProjectReferences(snapshot) {
    for (const ref of snapshot.files) {
      const meta=library.find(x=>x.id===ref.id);
      if(!meta||meta.sha256!==ref.sha256||meta.size!==ref.size)throw new Error('原图不在当前项目或已变化，请先刷新图片列表：'+ref.name);
    }
  }
  async function refreshFiles() {
    const all = await store.listFiles();
    library = all.filter(f => /^image\/(png|jpeg|webp|gif)$/i.test(f.type)).map(f => Schema.file(f));
    const warnings = [];
    for(const f of state.files)if(library.some(x=>x.id===f.id)){try{await ensureImage(f.id)}catch(e){warnings.push(e.message)}}
    for (const f of state.files) if (!library.some(x => x.id === f.id)) warnings.push('原图不在当前项目附件中：' + f.name);
    notice(warnings.join('；'));
    renderLibrary(); renderEditor(); renderLooks(); renderPreview();
  }
  function renderPreview() {
    const previousTime = player?.status().time || 0;
    player?.destroy(); $('#preview').dataset.aspect = state.aspect;
    player = PrevisPlayer.mount($('#preview'), state, urls, { onFrame: s => {
      $('#scrub').max = s.total; $('#scrub').value = s.time; $('#play-time').textContent = s.time.toFixed(2) + ' / ' + s.total.toFixed(2) + 's';
      $('#play').textContent = s.playing ? '暂停' : '播放'; $('#play').setAttribute('aria-label',s.playing?'暂停预览':'播放预览');
    }});
    player.seek(Math.min(previousTime, Schema.timeline(state).total));
    const total = Schema.timeline(state).total;
    $('#shot-count').textContent = state.shots.length; $('#total-time').textContent = format(total); $('#look-count').textContent = state.looks.length;
    $('#play').disabled = !state.shots.length; $('#restart').disabled = !state.shots.length; $('#scrub').disabled = !state.shots.length;
  }
  function renderList() {
    $('#shot-list').innerHTML = state.shots.length ? Schema.timeline(state).shots.map(s => `<li class="shot-item ${s.id === selected ? 'selected' : ''}" data-id="${esc(s.id)}"><button class="shot-select" data-select="${esc(s.id)}" aria-label="编辑镜头${s.index+1}"><strong class="shot-number">${String(s.index+1).padStart(2,'0')}</strong><span><b>${esc(s.title || '未命名镜头')}</b><small>${format(s.start)} → ${format(s.end)} · ${esc(s.framing)}${s.imageId || state.looks.find(l=>l.id===s.lookId)?.imageId ? ' · 已选图' : ' · 未选图'}</small></span></button><div class="reorder"><button data-move="-1" data-id="${esc(s.id)}" aria-label="上移镜头${s.index+1}" ${s.index===0?'disabled':''}>↑</button><button data-move="1" data-id="${esc(s.id)}" aria-label="下移镜头${s.index+1}" ${s.index===state.shots.length-1?'disabled':''}>↓</button></div></li>`).join('') : '<li class="empty">还没有镜头。手动添加，或导入当前项目的 shots JSON。</li>';
  }
  function renderEditor() {
    const shot = state.shots.find(x=>x.id===selected);
    if (!shot) { $('#shot-editor').innerHTML = '<div class="empty">选择一个镜头，编辑画面、台词和节奏。</div>'; return; }
    $('#shot-editor').innerHTML = `<div class="editor-head"><h2>镜头 ${state.shots.indexOf(shot)+1}</h2><button id="delete-shot" class="danger">删除镜头</button></div>
      <div class="fields">
      <label>镜头标题<input data-field="title" maxlength="500" value="${esc(shot.title)}" placeholder="例如：门口停顿"></label>
      <div class="field-row"><label>时长（秒）<input data-field="duration" type="number" min="0.1" max="600" step="0.001" required value="${shot.duration}"></label><label>景别<input data-field="framing" maxlength="100" value="${esc(shot.framing)}" list="framings"><datalist id="framings">${Schema.FRAMINGS.map(f=>'<option>'+f+'</option>').join('')}</datalist></label></div>
      <label>画面描述<textarea data-field="description" maxlength="20000" rows="4" placeholder="人物、场景、动作与镜头意图">${esc(shot.description)}</textarea></label>
      <label>台词 / 声音说明<textarea data-field="dialogue" maxlength="10000" rows="3" placeholder="台词、旁白或环境声音的文字说明">${esc(shot.dialogue)}</textarea></label>
      <label>机位 / 造型说明<textarea data-field="lookNotes" maxlength="10000" rows="2" placeholder="景别以外的机位、服装与氛围要求">${esc(shot.lookNotes || '')}</textarea></label>
      <label>镜头图片<select data-field="imageId">${imageOptions(shot.imageId)}</select></label>
      <label>关联造型<select data-field="lookId"><option value="">未关联造型</option>${state.looks.map(l=>`<option value="${esc(l.id)}" ${shot.lookId===l.id?'selected':''}>${esc(l.name || '未命名造型')}</option>`).join('')}</select></label>
      <label>手动镜头运动<select data-field="movement">${[['static','静止'],['push','缓慢推近'],['pull','缓慢拉远'],['left','向左平移'],['right','向右平移']].map(([v,t])=>`<option value="${v}" ${shot.movement===v?'selected':''}>${t}</option>`).join('')}</select></label>
      <p class="hint">没有单独选图时，使用关联造型的图片。预览随输入更新；原图不会被覆盖。声音说明只展示文字。</p></div>`;
  }
  function renderLooks() {
    $('#look-list').innerHTML = state.looks.length ? state.looks.map(l=>`<article class="look-card" data-look="${esc(l.id)}">${urls[l.imageId]?`<img src="${esc(urls[l.imageId])}" alt="${esc(l.name || '造型参考')}">`:''}<div class="fields"><label>造型名称<input data-look-field="name" maxlength="300" value="${esc(l.name)}" placeholder="例如：雨夜外套"></label><label>服装 / 妆发 / 备注<textarea data-look-field="description" maxlength="10000" rows="4">${esc(l.description)}</textarea></label><label>参考原图<select data-look-field="imageId">${imageOptions(l.imageId)}</select></label></div><button data-delete-look="${esc(l.id)}" class="danger">删除造型</button></article>`).join('') : '<div class="empty">还没有造型。添加名称、说明与参考图，之后可关联到镜头。</div>';
  }
  function renderLibrary() {
    imageObserver?.disconnect();
    $('#image-library').innerHTML = library.length ? library.map(f=>`<article class="image-card"><img data-library-image="${esc(f.id)}" ${urls[f.id]?`src="${esc(urls[f.id])}"`:''} alt="${esc(f.name)}"><b>${esc(f.name)}</b><small>${(f.size/1024).toFixed(1)} KB · SHA256 ${f.sha256.slice(0,8)}…</small><div class="row"><button data-use-image="${esc(f.id)}" ${!selected?'disabled':''}>放入镜头</button><button data-download-image="${esc(f.id)}">原件</button></div></article>`).join('') : '<div class="empty">本项目还没有图片。上传你实际要使用的参考原件。</div>';
    imageObserver=new IntersectionObserver(entries=>entries.forEach(async entry=>{if(!entry.isIntersecting)return;imageObserver.unobserve(entry.target);const img=entry.target;try{img.src=await ensureImage(img.dataset.libraryImage)}catch(e){img.alt=e.message;notice(e.message)}}),{rootMargin:'200px'});
    document.querySelectorAll('[data-library-image]').forEach(img=>{if(!urls[img.dataset.libraryImage])imageObserver.observe(img)});
  }
  function renderAll() { $('#plan-title').value = state.title; $('#aspect').value = state.aspect; renderList(); renderEditor(); renderLooks(); renderLibrary(); renderPreview(); }
  function changeTab(next) { if (invalid()) return; tab=next; document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))}); for(const t of ['shots','looks','import']) $('#'+t+'-tab').hidden=t!==tab; if(tab!=='shots')player?.pause(); }
  function appendPlan(incoming) {
    const next=clone(state), ids=new Set([...next.shots,...next.looks].map(x=>x.id)); const lookMap=new Map();
    for(const look of incoming.looks){const old=look.id;if(ids.has(old))look.id=Schema.newLook().id;ids.add(look.id);lookMap.set(old,look.id);next.looks.push(look)}
    for(const shot of incoming.shots){if(ids.has(shot.id))shot.id=Schema.newShot().id;ids.add(shot.id);if(shot.lookId)shot.lookId=lookMap.get(shot.lookId)||shot.lookId;next.shots.push(shot)}
    for(const f of incoming.files)if(!next.files.some(x=>x.id===f.id))next.files.push(f);
    return Schema.validate(next);
  }
  async function importDoc(doc) {
    if (invalid()) return;
    await flush();
    if (doc?.app === 'practical-submodule') {
      await store.validateBundle(doc,{validate:Schema.validate});
      if(doc.key!==KEY)throw new Error('这不是造型与分镜的备份');
      for(const ref of Schema.validate(doc.state).files){const original=doc.files.find(f=>f.id===ref.id);if(!original||['name','type','size','sha256'].some(k=>original[k]!==ref[k]))throw new Error('备份缺少匹配的图片原件：'+ref.name)}
      if(!confirm('将用备份替换当前造型与分镜方案。项目其他模块保持原样。继续？'))return;
      await store.restoreBundle(doc,{client,validate:Schema.validate});
      state=Schema.validate(await client.reload()); dirty=false;version++;status('已恢复');
    } else {
      const incoming=Schema.importPlan(doc,library);
      const replace=$('#import-mode').value==='replace';
      if(replace&&state.shots.length&&!confirm('替换当前方案中的镜头和造型？原图附件仍保留在项目中。'))return;
      const next=replace?incoming:appendPlan(incoming);
      state=Schema.validate(next);selected=state.shots.at(-incoming.shots.length)?.id||state.shots[0]?.id||'';changed();await flush();
    }
    selected=state.shots.some(x=>x.id===selected)?selected:state.shots[0]?.id||'';
    await refreshFiles();renderAll();notice('导入完成；请核对镜头、图片和时长。');
  }
  async function dataURL(blob) { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('图片读取失败'));r.readAsDataURL(blob)}); }
  function fileName(ext) { return (state.title||'分镜方案').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,100)+ext; }
  function wire() {
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>changeTab(b.dataset.tab));
    $('#plan-title').oninput=e=>{state.title=e.target.value;changed()};
    $('#aspect').onchange=e=>{state.aspect=e.target.value;changed();renderPreview()};
    $('#save-now').onclick=()=>flush().then(()=>{clearError();notice('当前方案已保存。')}).catch(error);
    $('#reload').onclick=()=>busy('正在读取…',async()=>{if(dirty&&!confirm('放弃当前页未保存的编辑，重新读取服务端版本？'))return;clearTimeout(pendingTimer);await writes.catch(()=>{});writes=Promise.resolve();state=Schema.validate(await client.reload());dirty=false;failed=false;version++;selected=state.shots[0]?.id||'';await refreshFiles();renderAll();status('已读取')});
    $('#add-shot').onclick=()=>{if(invalid())return;if(state.shots.length>=300){error(new Error('本方案最多300个镜头，请拆分方案'));return}const s=Schema.newShot();state.shots.push(s);selected=s.id;changed();renderList();renderEditor();renderLibrary();renderPreview()};
    $('#shot-list').onclick=e=>{if(invalid())return;const select=e.target.closest('[data-select]'),move=e.target.closest('[data-move]');if(select){selected=select.dataset.select;player.pause();player.seek(Schema.timeline(state).shots.find(x=>x.id===selected).start);renderList();renderEditor();renderLibrary()}if(move){const i=state.shots.findIndex(x=>x.id===move.dataset.id),j=i+Number(move.dataset.move);if(j>=0&&j<state.shots.length){[state.shots[i],state.shots[j]]=[state.shots[j],state.shots[i]];changed();renderList();renderEditor();renderPreview()}}};
    $('#shot-editor').oninput=e=>{const f=e.target.dataset.field;if(!f)return;const shot=state.shots.find(x=>x.id===selected);if(!shot)return;if(f==='duration'){if(!e.target.checkValidity()){changed();return}shot.duration=Number(e.target.value)}else{if(f==='imageId')addRef(e.target.value);shot[f]=e.target.value}pruneRefs();changed();renderList();renderPreview();const imageId=shot.imageId||state.looks.find(l=>l.id===shot.lookId)?.imageId;if(imageId&&!urls[imageId])ensureImage(imageId).then(renderPreview).catch(error)};
    $('#shot-editor').onclick=e=>{if(e.target.id!=='delete-shot'||invalid())return;if(!confirm('删除这个镜头？所选图片原件仍留在项目附件中。'))return;const i=state.shots.findIndex(x=>x.id===selected);state.shots.splice(i,1);selected=state.shots[Math.min(i,state.shots.length-1)]?.id||'';pruneRefs();changed();renderAll()};
    $('#add-look').onclick=()=>{if(invalid())return;if(state.looks.length>=300){error(new Error('本方案最多300个造型'));return}state.looks.push(Schema.newLook());changed();renderLooks();renderEditor();renderPreview()};
    $('#look-list').oninput=e=>{const f=e.target.dataset.lookField;if(!f)return;const l=state.looks.find(x=>x.id===e.target.closest('[data-look]').dataset.look);if(f==='imageId')addRef(e.target.value);l[f]=e.target.value;pruneRefs();changed();renderPreview();if(f==='name')renderEditor();if(f==='imageId'){const card=e.target.closest('[data-look]');let image=card.querySelector('img');if(!l.imageId)image?.remove();else ensureImage(l.imageId).then(url=>{if(!image){image=new Image();card.prepend(image)}image.src=url;image.alt=l.name||'造型参考';renderPreview()}).catch(error)}};
    $('#look-list').onclick=e=>{const b=e.target.closest('[data-delete-look]');if(!b||invalid())return;if(!confirm('删除这个造型并取消镜头中的关联？图片原件仍保留。'))return;state.looks=state.looks.filter(l=>l.id!==b.dataset.deleteLook);state.shots.forEach(s=>{if(s.lookId===b.dataset.deleteLook)s.lookId=''});pruneRefs();changed();renderLooks();renderEditor();renderList();renderPreview()};
    $('#play').onclick=()=>player.status().playing?player.pause():player.play();$('#restart').onclick=()=>{player.pause();player.seek(0);player.play()};$('#scrub').oninput=e=>player.seek(Number(e.target.value));
    $('#image-files').onchange=e=>busy('上传原图…',async()=>{if(invalid())return;const files=[...e.target.files],failures=[];let count=0;for(const f of files){try{if(!/^image\/(png|jpeg|webp|gif)$/i.test(f.type)||f.size<1||f.size>32*1024*1024)throw new Error('只支持32MB以内的PNG、JPEG、WebP、GIF图片');const probe=new Image(),url=URL.createObjectURL(f);probe.src=url;try{await probe.decode()}catch{throw new Error('不是可解码的图片')}finally{URL.revokeObjectURL(url)}await store.putFile(f);count++}catch(err){failures.push(f.name+'：'+err.message)}}e.target.value='';await refreshFiles();notice('已上传'+count+'份图片原件；选择图片放入镜头或造型。');$('#export-status').textContent='上传完成';if(failures.length)error(new Error(failures.join('；')))});
    $('#refresh-files').onclick=()=>{if(!invalid())busy('读取项目图片…',refreshFiles)};
    $('#image-library').onclick=e=>{const use=e.target.closest('[data-use-image]'),download=e.target.closest('[data-download-image]');if(use){if(invalid())return;const shot=state.shots.find(s=>s.id===selected);if(!shot)return;busy('读取所选图片…',async()=>{await ensureImage(use.dataset.useImage);addRef(use.dataset.useImage);shot.imageId=use.dataset.useImage;pruneRefs();changed();renderEditor();renderList();renderPreview()})}if(download)store.downloadFile(download.dataset.downloadImage).catch(error)};
    $('#import-paste').onclick=()=>busy('校验导入…',async()=>{let doc;try{doc=JSON.parse($('#import-json').value)}catch{throw new Error('JSON格式无效，请检查括号和引号')}await importDoc(doc)});
    $('#import-file').onchange=e=>busy('读取方案…',async()=>{const f=e.target.files[0];if(!f)return;if(f.size>240*1024*1024)throw new Error('方案文件超过240MB');let doc;try{doc=JSON.parse(await f.text())}catch{throw new Error('文件不是有效JSON')}await importDoc(doc);e.target.value=''});
    $('#export-json').onclick=()=>busy('打包方案与原图…',async()=>{await flush();const snapshot=Schema.validate(state);checkProjectReferences(snapshot);const doc={app:'practical-submodule',version:1,key:KEY,state:snapshot,files:[]};let bytes=0;for(const f of snapshot.files){bytes+=f.size;if(bytes>160*1024*1024)throw new Error('方案原图合计超过160MB，请按镜头分批备份');const encoded=await dataURL(await readOriginal(f));doc.files.push({...f,data:encoded.slice(encoded.indexOf(',')+1)})}await store.validateBundle(doc,{validate:Schema.validate});await store.download(fileName('.json'),JSON.stringify(doc,null,2),'application/json');$('#export-status').textContent='JSON已下载，包含方案使用的原件备份。'});
    $('#export-csv').onclick=()=>busy('导出镜头表…',async()=>{await flush();await store.download(fileName('.csv'),Schema.csv(Schema.validate(state)),'text/csv;charset=utf-8');$('#export-status').textContent='CSV已下载。'});
    $('#export-html').onclick=()=>busy('内嵌原图，制作独立预演…',async()=>{await flush();const snapshot=Schema.validate(state),embedded={};checkProjectReferences(snapshot);const ids=new Set([...snapshot.shots,...snapshot.looks].map(x=>x.imageId).filter(Boolean));let bytes=0;for(const id of ids){const f=snapshot.files.find(f=>f.id===id);bytes+=f.size;if(bytes>160*1024*1024)throw new Error('已用图片超过160MB，请拆分预演');embedded[id]=await dataURL(await readOriginal(f))}const response=await fetch('vendor/gsap.min.js');if(!response.ok)throw new Error('运行库读取失败，未生成不完整HTML');const html=PrevisExport.buildHTML(snapshot,embedded,await response.text(),document.documentElement.dataset.theme);await store.download(fileName('.html'),html,'text/html;charset=utf-8');$('#export-status').textContent='独立HTML已下载，可离线打开播放。'});
  }
  window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='theme')setTheme(e.data.theme);if(e.data?.type==='previs:flush'){try{await whenIdle();parent.postMessage({type:'previs:flushed',requestId:e.data.requestId,ok:true},location.origin)}catch(err){parent.postMessage({type:'previs:flushed',requestId:e.data.requestId,ok:false,error:err.message},location.origin)}}});
  window.addEventListener('beforeunload',e=>{if(dirty||failed||locked){e.preventDefault();e.returnValue=''}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){player?.pause();if(dirty)flush().catch(error)}});
  try {
    if (!window.ActorStore) throw new Error('工作台存储连接未就绪，请从主工作台进入或重新载入');
    store=window.ActorStore;client=await store.open(KEY,Schema.fresh,Schema.validate);state=Schema.validate(client.state);selected=state.shots[0]?.id||'';
    const style=document.createElement('style');style.textContent=PrevisPlayer.css;document.head.append(style);
    wire();renderAll();await refreshFiles();status('已读取');$('#app').setAttribute('aria-busy','false');
    window.PrevisApp=Object.freeze({flush:whenIdle,getState:()=>clone(state),getPlayback:()=>player.status(),key:KEY});
    parent.postMessage({type:'previs:ready'},location.origin);
  } catch(e) { $('#app').setAttribute('aria-busy','false');error(e);status('连接失败');$('#app').querySelectorAll('button,input,textarea,select').forEach(x=>x.disabled=true); }
})();
