(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PrevisPlayer = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  // This function is also embedded verbatim in the self-contained HTML export.
  function mount(host, model, images, options = {}) {
    const doc = host.ownerDocument, view = doc.defaultView;
    const renderMode = new URLSearchParams(view.location.search).has('render');
    let acc = 0, time = 0, playing = false, raf = 0, origin = 0, dead = false;
    const rows = model.shots.map((s, index) => { const row = { ...s, index, start: acc }; acc = Math.round((acc + s.duration) * 1000) / 1000; row.end = acc; return row; });
    const total = acc;
    const root = options.root ? host : doc.createElement('div'); root.className = 'pv-canvas'; root.dataset.compositionId = 'previs';
    const dimensions = { '16:9': [1600, 900], '9:16': [900, 1600], '1:1': [1200, 1200] }[model.aspect] || [1600, 900];
    root.dataset.width = dimensions[0]; root.dataset.height = dimensions[1]; root.dataset.duration = total;
    host.style.aspectRatio = dimensions.join('/'); if (options.root) host.replaceChildren(); else host.replaceChildren(root);
    const nodes = rows.map(s => {
      const node = doc.createElement('section'); node.className = 'pv-scene clip'; node.id = 'pv-' + s.id;
      node.dataset.start = s.start; node.dataset.duration = s.duration; node.dataset.trackIndex = '0';
      const look = model.looks.find(x => x.id === s.lookId), imageId = s.imageId || look?.imageId;
      const image = doc.createElement('img'); image.className = 'pv-image'; image.alt = model.files.find(x => x.id === imageId)?.name || '';
      if (images[imageId]) image.src = images[imageId]; else image.hidden = true;
      const empty = doc.createElement('div'); empty.className = 'pv-no-image'; empty.textContent = '未选择项目图片'; empty.hidden = !!images[imageId];
      const copy = doc.createElement('div'); copy.className = 'pv-copy';
      const tag = doc.createElement('span'); tag.className = 'pv-tag'; tag.textContent = String(s.index + 1).padStart(2, '0') + ' / ' + rows.length + ' · ' + s.framing;
      const title = doc.createElement('h2'); title.textContent = s.title || '未命名镜头';
      const description = doc.createElement('p'); description.className = 'pv-description'; description.textContent = s.description;
      const dialogue = doc.createElement('p'); dialogue.className = 'pv-dialogue'; dialogue.textContent = s.dialogue;
      const lookTag = doc.createElement('small'); lookTag.textContent = [look ? '造型 · ' + (look.name || '未命名造型') : '', s.lookNotes || ''].filter(Boolean).join(' · ');
      copy.append(tag, title, description, dialogue, lookTag); node.append(image, empty, copy); root.append(node);
      return { node, image, shot: s };
    });
    if (!rows.length) { const empty = doc.createElement('div'); empty.className = 'pv-empty'; empty.textContent = '添加第一个镜头，开始你的预演'; root.append(empty); }
    let timeline = null;
    if (view.gsap && rows.length) {
      timeline = view.gsap.timeline({ paused: true });
      for (const { image, shot: s } of nodes) {
        const from = { scale: s.movement === 'pull' ? 1.14 : s.movement === 'left' || s.movement === 'right' ? 1.12 : 1, xPercent: s.movement === 'left' ? 4 : s.movement === 'right' ? -4 : 0 };
        const to = { scale: s.movement === 'push' ? 1.14 : s.movement === 'left' || s.movement === 'right' ? 1.12 : 1, xPercent: s.movement === 'left' ? -4 : s.movement === 'right' ? 4 : 0, duration: s.duration, ease: 'none', immediateRender: true };
        timeline.fromTo(image, from, to, s.start);
      }
      view.__timelines = view.__timelines || {}; view.__timelines.previs = timeline;
    }
    function draw(t) {
      time = Math.max(0, Math.min(Number(t) || 0, total));
      const row = rows.find(s => time >= s.start && time < s.end) || (time === total ? rows.at(-1) : null);
      if (timeline) timeline.time(time, false);
      for (const { node, image, shot: s } of nodes) {
        // HyperFrames owns clip visibility in render mode. Interactive HTML owns its own UI.
        if (!renderMode) node.hidden = row?.id !== s.id;
        if (!timeline) {
          const p = Math.max(0, Math.min(1, (time - s.start) / s.duration));
          const scale = s.movement === 'push' ? 1 + .14 * p : s.movement === 'pull' ? 1.14 - .14 * p : ['left', 'right'].includes(s.movement) ? 1.12 : 1;
          const x = s.movement === 'left' ? 4 - 8 * p : s.movement === 'right' ? -4 + 8 * p : 0;
          image.style.transform = 'translateX(' + x + '%) scale(' + scale + ')';
        }
      }
      options.onFrame?.({ time, total, playing, shot: row || null });
      return { time, total, playing, shotId: row?.id || '' };
    }
    function pause() { playing = false; view.cancelAnimationFrame(raf); raf = 0; draw(time); }
    function tick(now) { if (!playing || dead) return; draw((now - origin) / 1000); if (time >= total) pause(); else raf = view.requestAnimationFrame(tick); }
    function play() { if (!total || dead) return; if (time >= total) time = 0; if (playing) return; playing = true; origin = view.performance.now() - time * 1000; draw(time); raf = view.requestAnimationFrame(tick); }
    function seek(value) { const resume = playing; pause(); draw(value); if (resume && time < total) play(); }
    draw(0);
    const api = { play, pause, seek, status: () => ({ time, total, playing }), destroy() { dead = true; pause(); timeline?.kill(); if (view.__timelines?.previs === timeline) delete view.__timelines.previs; } };
    if (renderMode) { view.__seek = ms => { timeline?.time(Math.max(0, Math.min(ms / 1000, total)), false); }; }
    return api;
  }
  const css = `
.pv-canvas{position:relative;width:100%;height:100%;overflow:hidden;background:var(--stage,#141b2b);color:var(--stage-ink,#fff);container-type:inline-size}
.pv-scene{position:absolute;inset:0;box-sizing:border-box;width:100%;height:100%;overflow:hidden}.pv-scene[hidden],.pv-image[hidden],.pv-no-image[hidden]{display:none!important}
.pv-image{display:block;position:absolute;width:100%;height:100%;inset:0;object-fit:contain;transform-origin:center}.pv-no-image,.pv-empty{position:absolute;inset:0;display:grid;place-items:center;font:500 clamp(12px,3cqw,25px) system-ui;color:var(--stage-muted,#a9b4c9);background:linear-gradient(135deg,var(--stage,#141b2b),var(--stage-alt,#253048));padding:5%;text-align:center}
.pv-no-image{align-items:start;padding-top:9%;font-size:clamp(10px,2cqw,16px)}
.pv-copy{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;padding:5.5%;background:linear-gradient(transparent 30%,#000a);box-sizing:border-box;overflow:hidden;color:#fff}
.pv-copy h2{font:600 clamp(14px,5cqw,55px)/1.2 system-ui;margin:.4em 0 .3em;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.pv-tag{font:500 clamp(9px,1.8cqw,17px)/1.5 system-ui;letter-spacing:.14em}.pv-copy p{font:400 clamp(10px,2.4cqw,25px)/1.5 system-ui;margin:.2em 0;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;max-width:100%}.pv-description{-webkit-line-clamp:3;opacity:.8}.pv-dialogue{-webkit-line-clamp:3;border-left:2px solid #fffb;padding-left:.6em}.pv-copy small{font:400 clamp(9px,1.7cqw,16px)/1.5 system-ui;margin-top:.5em;color:#e0e5ee}`;
  return { mount, css };
});
