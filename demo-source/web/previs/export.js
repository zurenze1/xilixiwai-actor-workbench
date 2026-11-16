(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./schema.js') : root.PrevisSchema,
    typeof module === 'object' && module.exports ? require('./player.js') : root.PrevisPlayer);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.PrevisExport = api;
})(typeof window === 'undefined' ? globalThis : window, function (Schema, Player) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  function buildHTML(input, images, gsapSource, theme = 'tide') {
    const state = Schema.validate(input), total = Schema.timeline(state).total;
    if (!state.shots.length) throw new Error('请先添加镜头');
    if (!['tide','butter','moss'].includes(theme)) theme = 'tide';
    for (const src of Object.values(images)) if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(src)) throw new Error('导出图片不是可内嵌原件');
    for (const s of [...state.shots, ...state.looks]) if (s.imageId && !images[s.imageId]) throw new Error('图片未完整读取，已中止导出：' + s.imageId);
    if (typeof gsapSource !== 'string' || !gsapSource.includes('GSAP')) throw new Error('预演运行库尚未就绪');
    const dimensions = { '16:9': [1600,900], '9:16': [900,1600], '1:1': [1200,1200] }[state.aspect];
    const script = gsapSource.replace(/<\/script/gi, '<\\/script');
    const details = Schema.timeline(state).shots.map(s => {
      const look = state.looks.find(x => x.id === s.lookId), ref = state.files.find(x => x.id === (s.imageId || look?.imageId));
      return `<li><button class="jump" data-time="${s.start}">${s.index + 1}. ${esc(s.title || '未命名镜头')} · ${s.start.toFixed(2)}s / ${s.duration}s</button><p>${esc(s.description)}</p>${s.dialogue ? '<blockquote>'+esc(s.dialogue)+'</blockquote>' : ''}${s.lookNotes ? '<p>机位/造型说明：'+esc(s.lookNotes)+'</p>' : ''}${look ? '<p>造型：'+esc(look.name)+' · '+esc(look.description)+'</p>' : ''}${ref ? '<small>原图：'+esc(ref.name)+' · SHA256 '+esc(ref.sha256)+'</small>' : '<small>未选择项目图片</small>'}</li>`;
    }).join('');
    return `<!doctype html><html lang="zh-CN" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.title || '分镜预演')}</title><style>
*{box-sizing:border-box}body{margin:0;background:#242424;color:#fff;font:14px/1.6 system-ui;padding:24px;--stage:#141d36;--stage-alt:#2e3a6b}html[data-theme=butter] body{background:#efe7d8;color:#3b3226;--stage:#393b25;--stage-alt:#6f7a4a}html[data-theme=moss] body{background:#f7f2e2;color:#1f2a17;--stage:#1f321b;--stage-alt:#557a35}main{max-width:1100px;margin:auto}h1{font-size:26px;margin:0 0 8px;overflow-wrap:anywhere}.meta{opacity:.65;font-size:12px;margin-bottom:20px}.screen{display:flex;justify-content:center;background:#111}#preview{position:relative;width:100%;aspect-ratio:${dimensions.join('/')};height:auto;max-height:85vh;overflow:hidden}${state.aspect === '9:16' ? '#preview{max-width:440px}' : ''}button{font:inherit;cursor:pointer;border:1px solid #8886;background:transparent;color:inherit;border-radius:6px;padding:8px 14px}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:18px 0}.controls input{flex:1;min-width:150px}.controls output{font-size:12px;font-variant-numeric:tabular-nums}ol{padding-left:25px}li{margin:20px 0;border-top:1px solid #8885;padding:15px 0}li p,blockquote{white-space:pre-wrap;overflow-wrap:anywhere}small{display:block;overflow-wrap:anywhere;opacity:.65}blockquote{margin:8px 0;border-left:3px solid #8888;padding-left:15px}.jump{padding-left:0;border:0;text-align:left;font-weight:600}@media(max-width:500px){body{padding:12px}.controls input{flex-basis:100%}}${Player.css}
</style></head><body><main><h1>${esc(state.title || '分镜预演')}</h1><p class="meta">${state.shots.length} 个镜头 · ${total.toFixed(2)} 秒 · ${state.aspect} · 当前方案与所选项目原图</p><div class="screen"><div id="preview" data-composition-id="previs" data-width="${dimensions[0]}" data-height="${dimensions[1]}" data-duration="${total}"></div></div><div class="controls"><button id="play">播放</button><button id="restart">从头</button><output id="time">0.00 / ${total.toFixed(2)}s</output><input id="seek" type="range" min="0" max="${total}" value="0" step="0.01" aria-label="播放进度"></div><details><summary>镜头全文与原图引用</summary><ol>${details}</ol></details></main><script type="application/json" id="previs-data">${safeJSON({ state, images })}</script><script>${script}</script><script>
const mountPrevis=${Player.mount.toString()};
const payload=JSON.parse(document.getElementById('previs-data').textContent);
const player=mountPrevis(document.getElementById('preview'),payload.state,payload.images,{root:true,onFrame:s=>{document.getElementById('seek').value=s.time;document.getElementById('time').textContent=s.time.toFixed(2)+' / '+s.total.toFixed(2)+'s';document.getElementById('play').textContent=s.playing?'暂停':'播放'}});
document.getElementById('play').onclick=()=>player.status().playing?player.pause():player.play();document.getElementById('restart').onclick=()=>{player.pause();player.seek(0);player.play()};document.getElementById('seek').oninput=e=>player.seek(Number(e.target.value));document.querySelectorAll('.jump').forEach(b=>b.onclick=()=>{player.pause();player.seek(Number(b.dataset.time))});document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause()});window.PrevisPlayback=player;
</script></body></html>`;
  }
  return Object.freeze({ buildHTML, safeJSON, esc });
});
