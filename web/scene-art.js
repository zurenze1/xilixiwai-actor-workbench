/* Original, dependency-free scene accents. No React Bits Pro source is included. */
(() => {
  'use strict';
  if (window.ActorSceneArt) { window.ActorSceneArt.refresh(); return; }
  const scriptURL = document.currentScript?.src || new URL('scene-art.js', document.baseURI).href;
  const cssAsset = new URL('scene-art.css', scriptURL); cssAsset.search = new URL(scriptURL).search;
  const cssURL = cssAsset.href;
  const photoAtlas = 'assets/illustrations/actor-editorial-photo-atlas-v1.webp';
  if (!Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => link.href === cssURL)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = cssURL; document.head.append(link);
  }
  const key = 'xilixiwai.scene-art.motion.v1';
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  let paused = false, destroyed = false, raf = 0, lastFrame = 0, queued = false;
  let dust = null;
  try { paused = localStorage.getItem(key) === 'paused'; } catch (_) { /* Storage may be disabled. */ }
  const scenes = new Map(), headings = new Map(), illustrations = new Map(), springs = new Set();
  // A photograph belongs to one business scene. Corresponding demo/practical routes may share it.
  const scenePhotos = Object.freeze({
  "home": {
    "src": "assets/illustrations/scene-home-v1.webp",
    "topic": "今日安排与工作环境",
    "ratio": 1.5987903225806452
  },
  "body": {
    "src": "assets/illustrations/blue-gold-underwater-editorial-v1.webp",
    "topic": "用户已认可的身体与状态概念图，保持原样",
    "ratio": 1.5987903225806452
  },
  "trip": {
    "src": "assets/editorial-references/contiki-014.webp",
    "source": "https://www.contiki.com/en-us/activity/on-contiki-coming-soon",
    "brand": "Contiki",
    "description": "海边旅行场景，仅出行板块视觉参考",
    "ratio": 1.7777777777777777
  },
  "take": {
    "src": "assets/scenes-v2/project-v2.webp",
    "topic": "演员与团队翻看项目邀约和档期",
    "fictional": true,
    "ratio": 1.7768331562167907
  },
  "read": {
    "src": "assets/scenes-v2/script-v2.webp",
    "topic": "演员翻页批注剧本",
    "fictional": true,
    "ratio": 1.75
  },
  "role": {
    "src": "assets/scenes-v2/performance-v2.webp",
    "topic": "两位成年演员在排练中对戏",
    "fictional": true,
    "ratio": 1.75
  },
  "prev": {
    "src": "assets/scenes-v2/previs-v2.webp",
    "topic": "在监视器旁讨论镜头和分镜",
    "fictional": true,
    "ratio": 1.75
  },
  "shoot": {
    "src": "assets/scenes-v2/studio-v2.webp",
    "topic": "团队讨论通告和任务",
    "fictional": true,
    "ratio": 1.75
  },
  "business": {
    "src": "assets/scenes-v2/business-v2.webp",
    "topic": "工作室核对票据、资产与经营资料",
    "fictional": true,
    "ratio": 1.75
  },
  "social": {
    "src": "assets/scenes-v2/social-v2.webp",
    "topic": "拍摄短视频和检查剪辑",
    "fictional": true,
    "ratio": 1.75
  },
  "dance": {
    "src": "assets/scenes-v2/dance-v2.webp",
    "topic": "舞蹈训练中的真实动作",
    "fictional": true,
    "ratio": 1.75
  },
  "review": {
    "src": "assets/scenes-v2/review-v2.webp",
    "topic": "收工后看回放与记复盘笔记",
    "fictional": true,
    "ratio": 1.75
  },
  "fans": {
    "src": "assets/scenes-v2/fans-v2.webp",
    "topic": "工作室整理粉丝来信和回复",
    "fictional": true,
    "ratio": 1.7768331562167907
  },
  "deal": {
    "src": "assets/scenes-v2/rights-v2.webp",
    "topic": "团队核对授权合同与肖像声音材料",
    "fictional": true,
    "ratio": 1.7768331562167907
  },
  "plan": {
    "src": "assets/scenes-v2/plan-v2.webp",
    "topic": "回顾作品、年度日历和发展计划",
    "fictional": true,
    "ratio": 1.7768331562167907
  },
  "charity": {
    "src": "assets/scenes-v2/charity-v2.webp",
    "topic": "志愿者清理海滩或整理公益物资",
    "fictional": true,
    "ratio": 1.7768331562167907
  },
  "brief": {
    "src": "assets/scenes-v2/brief-v2.webp",
    "topic": "阅读电影行业刊物和资讯并记录出处",
    "fictional": true,
    "ratio": 1.7768331562167907
  }
});
  const failedPhotos = new Set();
  const scenePhoto = key => {const photo=scenePhotos[key];return photo && failedPhotos.has(photo.src) ? photo.fallback || null : photo;};
  const sceneAliases = Object.freeze({ today: 'home', project: 'take', script: 'read', performance: 'role', previs: 'prev', studio: 'shoot', rights: 'deal', travel: 'trip', portfolio:'plan', deals:'deal', promo:'fans' });
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const motionOK = () => !paused && !media.matches && !document.hidden && !destroyed;
  const insideViewport = el => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const color = el => {
    const theme = el.closest('[data-theme]')?.dataset.theme || document.documentElement.dataset.theme || 'tide';
    return theme === 'butter' ? [191, 145, 58] : theme === 'moss' ? [123, 169, 117] : [81, 165, 225];
  };
  const dustExcluded = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),.script,[data-script-reading],[data-stardust-exclude]'));
  function clearDust() {
    if (!dust) return;
    dust.particles.length = 0; dust.ctx.clearRect(0, 0, dust.width, dust.height); dust.canvas.dataset.sceneParticles = '0';
  }
  function resizeDust() {
    if (!dust) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5), width = innerWidth, height = innerHeight;
    if (width === dust.width && height === dust.height && dpr === dust.dpr) return;
    dust.width = width; dust.height = height; dust.dpr = dpr;
    dust.canvas.width = Math.ceil(width * dpr); dust.canvas.height = Math.ceil(height * dpr);
    dust.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); clearDust();
  }
  function drawDust(now) {
    if (!dust) return;
    dust.particles = dust.particles.filter(p => now - p.born < 450);
    const [r, g, b] = color(document.body);
    dust.ctx.clearRect(0, 0, dust.width, dust.height);
    for (const p of dust.particles) {
      const age = clamp((now - p.born) / 450, 0, 1);
      dust.ctx.beginPath(); dust.ctx.arc(p.x, p.y - age * .7, p.radius, 0, Math.PI * 2);
      dust.ctx.fillStyle = `rgba(${r},${g},${b},${(.2 * (1 - age) ** 1.4).toFixed(3)})`; dust.ctx.fill();
    }
    dust.canvas.dataset.sceneParticles = String(dust.particles.length);
  }
  function onDustMove(event) {
    if (!dust || !motionOK() || !finePointer.matches || event.pointerType !== 'mouse') return;
    if (dustExcluded(event.target) || dustExcluded(document.activeElement)) { clearDust(); schedule(); return; }
    const now = performance.now(); if (now - dust.lastEmission < 16) return;
    const dx = event.movementX || 0, dy = event.movementY || 0;
    if (!dx && !dy) return;
    const length = Math.max(1, Math.hypot(dx, dy));
    const offset = Math.sin(++dust.sequence * 2.39996) * 5;
    dust.lastEmission = now;
    dust.particles.push({ x: event.clientX - dy / length * offset, y: event.clientY + dx / length * offset, born: now, radius: .55 + (dust.sequence % 4) * .15 });
    if (dust.particles.length > 14) dust.particles.splice(0, dust.particles.length - 14);
    schedule();
  }
  function onDustFocus(event) { if (dustExcluded(event.target)) { clearDust(); schedule(); } }
  function removeDust() {
    if (!dust) return;
    clearDust(); dust.canvas.remove(); dust = null;
    window.removeEventListener('pointermove', onDustMove); document.removeEventListener('focusin', onDustFocus);
  }
  function syncDust() {
    if (!document.body?.hasAttribute('data-stardust-cursor') || !finePointer.matches || media.matches || destroyed) { removeDust(); return; }
    if (dust && !dust.canvas.isConnected) removeDust();
    if (!dust) {
      const canvas = document.createElement('canvas'); canvas.className = 'scene-stardust-canvas'; canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d', { alpha: true }); if (!ctx) return;
      dust = { canvas, ctx, particles: [], lastEmission: -Infinity, sequence: 0, width: 0, height: 0, dpr: 1 };
      document.body.append(canvas); window.addEventListener('pointermove', onDustMove, { passive: true }); document.addEventListener('focusin', onDustFocus);
    }
    resizeDust();
  }
  function updateControls() {
    document.querySelectorAll('[data-scene-motion-toggle]').forEach(button => {
      const state=media.matches?'reduced':paused?'paused':'running';
      if(button.dataset.motionState!==state){
        const path=state==='running'?'<path d="M8 5h2v14H8zM14 5h2v14h-2z"/>':state==='paused'?'<path d="m9 5 10 7-10 7z"/>':'<path d="m5 5 14 14M7 4v10m5-10v15m5-6v6" fill="none" stroke="currentColor" stroke-width="1.5"/>';
        button.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">'+path+'</svg>';button.dataset.motionState=state;
      }
      button.title=media.matches?'已按系统设置减少动态':paused?'播放装饰动效':'暂停装饰动效';
      button.setAttribute('aria-pressed', String(paused || media.matches));
      button.setAttribute('aria-label', media.matches ? '已遵循系统减少动态效果设置' : paused ? '播放页面装饰动效' : '暂停页面装饰动效');
      button.disabled = media.matches;
    });
    const state=media.matches ? 'reduced' : paused ? 'paused' : 'running';if(document.documentElement.dataset.sceneMotion!==state)document.documentElement.dataset.sceneMotion=state;
  }
  function resetSpring(s) {
    s.x = s.y = s.vx = s.vy = 0; s.dragging = false; s.el.style.transform = ''; springs.delete(s);
  }
  function setPaused(value, persist = true) {
    paused = Boolean(value);
    if (persist) { try { localStorage.setItem(key, paused ? 'paused' : 'running'); } catch (_) {} }
    if (paused || media.matches) headings.forEach(h => { h.drag = null; h.chars.forEach(resetSpring); });
    if (paused || media.matches) clearDust();
    updateControls(); schedule();
    window.dispatchEvent(new CustomEvent('actor:scene-motion-change', { detail: { paused, reduced: media.matches } }));
  }
  function draw(scene) {
    const { ctx, width: w, height: h, phase, host } = scene;
    if (!w || !h) return;
    const [r, g, b] = color(host), rgb = `${r},${g},${b}`;
    ctx.clearRect(0, 0, w, h);
    if (scene.dots) {
      for (let layer = 0; layer < 2; layer++) {
        const spacing = layer ? 53 : 37, radius = layer ? 1.8 : 1.15;
        for (let y = 14, row = 0; y < h; y += spacing, row++) for (let x = 17, col = 0; x < w; x += spacing, col++) {
          const seed = row * 2.13 + col * 1.77 + layer * 3.21;
          const alpha = .035 + (Math.sin(phase * .56 + seed) * .5 + .5) * (layer ? .16 : .09);
          const dx = Math.sin(phase * .13 + seed) * 3 + scene.pointer * (layer ? 8 : 4);
          const dy = Math.cos(phase * .11 + seed) * 2;
          ctx.beginPath(); ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r + (layer ? 13 : 0)},${g + (layer ? 8 : 0)},${b},${alpha.toFixed(3)})`; ctx.fill();
        }
      }
      scene.frames++; scene.canvas.dataset.sceneFrames = String(scene.frames); return;
    }
    const horizon = h * .91;
    const glow = ctx.createRadialGradient(w * .57, horizon, 3, w * .57, horizon, w * .66);
    glow.addColorStop(0, `rgba(${rgb},.24)`); glow.addColorStop(.42, `rgba(${rgb},.08)`); glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    const shift = scene.pointer * 10;
    for (let i = 0; i < 23; i++) {
      const t = i / 22, center = w * .57;
      const baseX = center + (t - .5) * w * .93;
      const spread = (t - .5) * w * .47;
      const bend = Math.sin(phase * .53 + i * .51) * 6 + shift;
      const gradient = ctx.createLinearGradient(0, horizon, 0, 0);
      gradient.addColorStop(0, `rgba(${rgb},.43)`); gradient.addColorStop(.2, `rgba(${rgb},.16)`); gradient.addColorStop(1, `rgba(${rgb},0)`);
      ctx.strokeStyle = gradient; ctx.lineWidth = i % 4 === 0 ? 1.45 : .75;
      ctx.beginPath(); ctx.moveTo(baseX, horizon);
      ctx.bezierCurveTo(baseX + bend, h * .69, baseX + spread * .5 + bend, h * .24, baseX + spread, -18); ctx.stroke();
      const progress = (phase * (.17 + (i % 4) * .018) + i * .137) % 1;
      const y = horizon * (1 - progress);
      const x = baseX + spread * progress * progress + bend * Math.sin(progress * Math.PI);
      const trail = ctx.createLinearGradient(x, y + 28, x, y - 11);
      trail.addColorStop(0, `rgba(${rgb},0)`); trail.addColorStop(.7, `rgba(${rgb},.55)`); trail.addColorStop(1, `rgba(${rgb},0)`);
      ctx.strokeStyle = trail; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x, y - 9); ctx.stroke();
    }
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, `rgba(${rgb},0)`); line.addColorStop(.57, `rgba(${rgb},.48)`); line.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = line; ctx.fillRect(0, horizon, w, 1);
    scene.frames++; scene.canvas.dataset.sceneFrames = String(scene.frames);
  }
  function resize(scene) {
    const r = scene.host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.7);
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    if (w !== scene.width || h !== scene.height || dpr !== scene.dpr) {
      scene.width = w; scene.height = h; scene.dpr = dpr;
      scene.canvas.width = Math.round(w * dpr); scene.canvas.height = Math.round(h * dpr);
      scene.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(scene);
    }
    scene.visible = insideViewport(scene.host); schedule();
  }
  const intersect = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    entries.forEach(entry => { const scene = scenes.get(entry.target); if (scene) scene.visible = entry.isIntersecting; }); schedule();
  }) : null;
  function addScene(host) {
    if (scenes.has(host)) return;
    const canvas = document.createElement('canvas'); canvas.className = 'scene-rising-canvas'; canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: true }); if (!ctx) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'scene-motion-toggle'; button.dataset.sceneMotionToggle = '';
    host.classList.add('scene-lines-host'); host.prepend(canvas); host.append(button);
    const scene = { host, canvas, ctx, button, dots: host.hasAttribute('data-blinking-dots'), phase: .36, frames: 0, width: 0, height: 0, dpr: 1, pointer: 0, visible: insideViewport(host) };
    scene.move = event => { if (event.pointerType === 'touch') return; const r = host.getBoundingClientRect(); scene.pointer = clamp((event.clientX - r.left) / Math.max(1, r.width) - .5, -.5, .5); };
    scene.leave = () => { scene.pointer = 0; };
    host.addEventListener('pointermove', scene.move, { passive: true }); host.addEventListener('pointerleave', scene.leave, { passive: true });
    scenes.set(host, scene); intersect?.observe(host);
    if (typeof ResizeObserver === 'function') { scene.resize = new ResizeObserver(() => resize(scene)); scene.resize.observe(host); }
    resize(scene); updateControls();
  }
  function removeScene(scene) {
    scene.resize?.disconnect(); intersect?.unobserve(scene.host);
    scene.host.removeEventListener('pointermove', scene.move); scene.host.removeEventListener('pointerleave', scene.leave);
    scene.canvas.remove(); scene.button.remove(); scene.host.classList.remove('scene-lines-host'); scenes.delete(scene.host);
  }
  function springStyle(s) { s.el.style.transform = `translate(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px) rotate(${(s.x * .09).toFixed(2)}deg)`; }
  function addHeading(host) {
    if (headings.has(host)) return;
    const state = { host, chars: [], runs: [], drag: null, released: 0, originalAria: host.getAttribute('aria-label') };
    const readable = node => node.nodeName === 'BR' ? '\n' : node.nodeType === Node.TEXT_NODE ? node.textContent : Array.from(node.childNodes).map(readable).join('');
    const visibleText = readable(host);
    if (!host.hasAttribute('aria-label')) host.setAttribute('aria-label', visibleText.trim());
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, { acceptNode(node) {
      return node.parentElement?.closest('script,style,[aria-hidden="true"],button,input,textarea,select') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    const texts = []; while (walker.nextNode()) texts.push(walker.currentNode);
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    texts.forEach(text => {
      const run = document.createElement('span'); run.className = 'scene-elastic-run'; run.setAttribute('aria-hidden', 'true');
      const chars = segmenter ? Array.from(segmenter.segment(text.data), p => p.segment) : Array.from(text.data);
      chars.forEach(char => {
        if (/\s/.test(char)) { run.append(document.createTextNode(char)); return; }
        const el = document.createElement('span'); el.className = 'scene-elastic-char'; el.textContent = char; run.append(el);
        state.chars.push({ el, host, x: 0, y: 0, vx: 0, vy: 0, dragging: false });
      });
      text.replaceWith(run); state.runs.push({ run, text });
    });
    host.classList.add('scene-elastic');
    const getChar = target => { const el = target instanceof Element ? target.closest('.scene-elastic-char') : null; return state.chars.find(s => s.el === el); };
    const nudge = s => { if (!s || !motionOK()) return; s.vy = -3.9; s.vx = 1.1; springs.add(s); schedule(); };
    state.down = event => {
      if (!motionOK() || event.pointerType === 'touch' || event.button !== 0 || event.target.closest('a,button,input,select,textarea')) return;
      const s = getChar(event.target); if (!s) return;
      s.dragging = true; springs.add(s); state.drag = { s, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      try { s.el.setPointerCapture(event.pointerId); } catch (_) {} schedule();
    };
    state.move = event => {
      const drag = state.drag; if (!drag || event.pointerId !== drag.id || !motionOK()) return;
      const dx = clamp(event.clientX - drag.x, -26, 26), dy = clamp(event.clientY - drag.y, -20, 20);
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 4;
      const index = state.chars.indexOf(drag.s);
      state.chars.forEach((s, i) => { const distance = Math.abs(i - index); if (distance > 2) return;
        s.x = dx * (distance ? .3 / distance : 1); s.y = dy * (distance ? .45 / distance : 1); s.vx = s.vy = 0; s.dragging = true; springs.add(s); springStyle(s);
      });
    };
    state.up = event => {
      const drag = state.drag; if (!drag || event.pointerId !== drag.id) return;
      state.drag = null; state.released = performance.now(); state.chars.forEach(s => { s.dragging = false; });
      if (!drag.moved) nudge(drag.s); schedule();
    };
    state.click = event => { if (performance.now() - state.released < 160) return; nudge(getChar(event.target)); };
    host.addEventListener('pointerdown', state.down); host.addEventListener('pointermove', state.move, { passive: true });
    host.addEventListener('pointerup', state.up); host.addEventListener('pointercancel', state.up); host.addEventListener('lostpointercapture', state.up);
    host.addEventListener('click', state.click); headings.set(host, state);
  }
  function removeHeading(h) {
    for (const [event, listener] of [['pointerdown', h.down], ['pointermove', h.move], ['pointerup', h.up], ['pointercancel', h.up], ['lostpointercapture', h.up], ['click', h.click]]) h.host.removeEventListener(event, listener);
    h.chars.forEach(resetSpring); h.runs.forEach(({ run, text }) => { if (h.host.contains(run)) run.replaceWith(text); });
    if (h.originalAria === null) h.host.removeAttribute('aria-label'); else h.host.setAttribute('aria-label', h.originalAria);
    h.host.classList.remove('scene-elastic'); headings.delete(h.host);
  }
  function layoutPhoto(art) {
    if (!art.isConnected) return;
    if (art.dataset.scenePhotoLayout === 'single') {
      art.style.backgroundSize = innerWidth<=600?'cover':'auto 100%';art.style.backgroundPosition=innerWidth<=600?'74% center':'right center';
      const r=art.getBoundingClientRect(),ratio=Number(art.dataset.sceneRatio)||1.75,imageWidth=r.height*ratio,left=Math.max(0,r.width-imageWidth);
      art.style.setProperty('--scene-fade-start',Math.max(0,left/Math.max(1,r.width)*100-1)+'%');
      art.style.setProperty('--scene-fade-end',Math.min(94,(left+imageWidth*.57)/Math.max(1,r.width)*100)+'%');return;
    }
    const index = Number(art.dataset.scenePhotoIndex), rect = art.getBoundingClientRect();
    if (!Number.isInteger(index) || !rect.width || !rect.height) return;
    const tile = Math.max(rect.width, rect.height);
    art.style.backgroundSize = `${tile * 3}px ${tile * 3}px`;
    art.style.backgroundPosition = `${-(index % 3) * tile - (tile - rect.width) / 2}px ${-Math.floor(index / 3) * tile - (tile - rect.height) / 2}px`;
  }
  const photoResize = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => entries.forEach(entry => layoutPhoto(entry.target))) : null;
  function sceneKey(host) {
    const path = location.pathname;
    if (/\/(?:rourou|pet)\//.test(path)) return '';
    if (/\/(?:demo-operations|practical)\/business\//.test(path)) return 'business';
    if (/\/(?:demo-operations|practical)\/social\//.test(path)) return 'social';
    if (/\/practical\/previs\//.test(path)) return 'prev';
    if (/\/demo-lab\//.test(path)) return 'lab';
    const page = host.closest('[data-page]')?.dataset.page || document.body?.dataset.page || host.dataset.illustration;
    return sceneAliases[page] || page;
  }
  function clearPhoto(host) {
    const art = illustrations.get(host);
    if (art) { photoResize?.unobserve(art); art.remove(); illustrations.delete(host); }
    host.querySelector(':scope > .scene-photo-credit')?.remove();
    host.classList.remove('scene-illustrated', 'scene-illustration-slot', 'scene-photo-hero');
    delete host.dataset.sceneTopic;
  }
  function addIllustration(host) {
    const slot = host.tagName === 'SPAN' || host.hasAttribute('data-illustration-slot');
    const hero = host.matches('.hero,.module-head,.ocean-module-banner,[data-illustration-hero]');
    const untouched = /\/(?:rourou|pet)\//.test(location.pathname) || host.classList.contains('body-portrait');
    if (untouched) { clearPhoto(host); host.classList.remove('scene-art-omitted', 'scene-without-photo'); return; }
    const key = sceneKey(host), photo = !slot && hero && !untouched ? scenePhoto(key) : null;
    host.classList.toggle('scene-art-omitted', slot);
    host.classList.toggle('scene-without-photo', hero && !photo && !untouched);
    if (!photo) { clearPhoto(host); return; }
    let art = illustrations.get(host);
    if (!art || !art.isConnected) {
      if (art) photoResize?.unobserve(art);
      art = document.createElement('span'); art.className = 'scene-illustration'; art.setAttribute('aria-hidden', 'true');
      host.append(art); illustrations.set(host, art); photoResize?.observe(art);
    }
    host.classList.add('scene-illustrated', 'scene-photo-hero');
    art.dataset.scenePhotoLayout = Number.isInteger(photo.tile) ? 'atlas' : 'single';
    art.dataset.scenePhotoIndex = Number.isInteger(photo.tile) ? String(photo.tile) : '';
    art.dataset.sceneKey = key;
    art.dataset.scenePhotoFit = 'cinematic';art.dataset.sceneFictional=String(Boolean(photo.fictional));art.dataset.sceneRatio=String(photo.ratio||1.75);
    host.dataset.sceneTopic=photo.topic||photo.description||'';
    art.dataset.sceneImageId = photo.src + (Number.isInteger(photo.tile) ? `#scene=${photo.tile}` : '');
    art.style.backgroundImage = `url("${new URL(photo.src, scriptURL).href}")`;
    if(!photo.source)host.querySelector(':scope > .scene-photo-credit')?.remove();
    if (photo.source) {
      let credit=host.querySelector(':scope > .scene-photo-credit');
      if(!credit){credit=document.createElement('a');credit.className='scene-photo-credit';credit.target='_blank';credit.rel='noopener noreferrer';host.append(credit);}
      if(credit.getAttribute('href')!==photo.source)credit.setAttribute('href',photo.source);const label='图源 · '+photo.brand+' ↗';if(credit.textContent!==label)credit.textContent=label;const title=photo.description+' 第三方品牌视觉参考，非演员本人或代言。';if(credit.title!==title)credit.title=title;
      const probe=new Image();const requested=art.dataset.sceneImageId;
      probe.onerror=()=>{if(art.dataset.sceneImageId!==requested||!art.isConnected)return;failedPhotos.add(photo.src);credit.remove();if(photo.fallback){const fallback=photo.fallback;art.dataset.scenePhotoLayout=Number.isInteger(fallback.tile)?'atlas':'single';art.dataset.scenePhotoIndex=String(fallback.tile??'');art.dataset.sceneImageId=fallback.src+(Number.isInteger(fallback.tile)?'#scene='+fallback.tile:'');art.style.backgroundImage=`url("${new URL(fallback.src,scriptURL).href}")`;layoutPhoto(art);}else clearPhoto(host);};
      probe.src=new URL(photo.src,scriptURL).href;
    }
    layoutPhoto(art);
  }
  function prune() {
    scenes.forEach(s => { if (!s.host.isConnected || !(s.host.hasAttribute('data-rising-lines') || s.host.hasAttribute('data-blinking-dots'))) removeScene(s); });
    headings.forEach(h => { if (!h.host.isConnected || !h.host.hasAttribute('data-elastic') || h.runs.some(({ run }) => !h.host.contains(run))) removeHeading(h); });
    illustrations.forEach((art, host) => { if (!host.isConnected || !host.hasAttribute('data-illustration')) clearPhoto(host); });
    document.querySelectorAll('.scene-art-omitted,.scene-without-photo').forEach(host => { if (!host.hasAttribute('data-illustration')) host.classList.remove('scene-art-omitted', 'scene-without-photo'); });
  }
  function needsFrame() { return motionOK() && (Array.from(scenes.values()).some(s => s.visible && s.host.isConnected) || springs.size > 0 || Boolean(dust?.particles.length)); }
  function schedule() {
    if (!needsFrame()) { if (raf) cancelAnimationFrame(raf); raf = 0; lastFrame = 0; return; }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick(now) {
    raf = 0; if (!needsFrame()) { lastFrame = 0; return; }
    if (lastFrame && now - lastFrame < 1000 / 30 - .5) { schedule(); return; }
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .065) : 1 / 30; lastFrame = now;
    if (dust?.particles.length) drawDust(now);
    scenes.forEach(s => { if (!s.host.isConnected) { removeScene(s); return; } if (s.visible) { s.phase += dt; draw(s); } });
    springs.forEach(s => {
      if (!s.el.isConnected) { springs.delete(s); return; } if (!insideViewport(s.host)) { resetSpring(s); return; } if (s.dragging) return;
      const factor = dt * 30;
      s.vx = (s.vx - s.x * .16 * factor) * Math.pow(.72, factor); s.vy = (s.vy - s.y * .16 * factor) * Math.pow(.72, factor);
      s.x += s.vx * factor; s.y += s.vy * factor;
      if (Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.vx) + Math.abs(s.vy) < .08) resetSpring(s); else springStyle(s);
    }); schedule();
  }
  function refresh() {
    if (destroyed) return; prune(); syncDust();
    document.querySelectorAll('[data-illustration]').forEach(addIllustration);
    document.querySelectorAll('[data-rising-lines],[data-blinking-dots]').forEach(addScene);
    document.querySelectorAll('[data-elastic]').forEach(addHeading);
    scenes.forEach(s => {
      const palette = color(s.host).join(','), dots = s.host.hasAttribute('data-blinking-dots');
      const changed = s.palette !== palette || s.dots !== dots;
      s.palette = palette; s.dots = dots; resize(s); if (changed) draw(s);
    }); updateControls(); schedule();
  }
  function queueRefresh() { if (queued || destroyed) return; queued = true; queueMicrotask(() => { queued = false; refresh(); }); }
  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme', 'data-page', 'data-illustration', 'data-illustration-slot', 'data-rising-lines', 'data-blinking-dots', 'data-stardust-cursor', 'data-elastic', 'hidden'] });
  function onVisibility() { if (!document.hidden) scenes.forEach(s => { s.visible = insideViewport(s.host); }); else clearDust(); schedule(); }
  function onViewport() { scenes.forEach(s => { s.visible = insideViewport(s.host); }); illustrations.forEach(layoutPhoto); resizeDust(); clearDust(); schedule(); }
  function onReduced() { if (media.matches) headings.forEach(h => { h.drag = null; h.chars.forEach(resetSpring); }); syncDust(); updateControls(); schedule(); }
  function onFinePointer() { syncDust(); schedule(); }
  function onToggle(event) { if (event.target instanceof Element && event.target.closest('[data-scene-motion-toggle]')) setPaused(!paused); }
  function onStorage(event) { if (event.key === key) setPaused(event.newValue === 'paused', false); }
  document.addEventListener('visibilitychange', onVisibility); document.addEventListener('click', onToggle);
  window.addEventListener('resize', onViewport, { passive: true }); window.addEventListener('scroll', onViewport, { passive: true, capture: true }); window.addEventListener('storage', onStorage);
  media.addEventListener?.('change', onReduced);
  finePointer.addEventListener?.('change', onFinePointer);
  window.ActorSceneArt = {
    refresh, pause: () => setPaused(true), resume: () => setPaused(false), toggle: () => setPaused(!paused),
    status: () => ({ paused, reduced: media.matches, animating: Boolean(raf), canvases: scenes.size, visibleCanvases: Array.from(scenes.values()).filter(s => s.visible).length, elasticTitles: headings.size, illustrations: illustrations.size, frames: Array.from(scenes.values()).reduce((n, s) => n + s.frames, 0), dustEnabled: Boolean(dust), dustParticles: dust?.particles.length || 0, dustMaxParticles: 14, dustSpreadPx: 12, dustLifetimeMs: 450 }),
    destroy() {
      destroyed = true; if (raf) cancelAnimationFrame(raf); raf = 0; observer.disconnect(); intersect?.disconnect();
      photoResize?.disconnect();
      removeDust();
      Array.from(scenes.values()).forEach(removeScene); Array.from(headings.values()).forEach(removeHeading);
      illustrations.forEach((art, host) => { art.remove(); host.classList.remove('scene-illustrated', 'scene-illustration-slot', 'scene-photo-hero'); }); illustrations.clear();
      document.querySelectorAll('.scene-art-omitted,.scene-without-photo').forEach(host => host.classList.remove('scene-art-omitted', 'scene-without-photo'));
      document.removeEventListener('visibilitychange', onVisibility); document.removeEventListener('click', onToggle);
      window.removeEventListener('resize', onViewport); window.removeEventListener('scroll', onViewport, true); window.removeEventListener('storage', onStorage); media.removeEventListener?.('change', onReduced);
      finePointer.removeEventListener?.('change', onFinePointer);
      delete document.documentElement.dataset.sceneMotion; delete window.ActorSceneArt;
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true }); else refresh();
})();
