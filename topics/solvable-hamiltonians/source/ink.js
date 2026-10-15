/* ink.js — 画布上的水墨：主题色、尺寸自适应、笔触、墨点、标注；术语弹注、滑块、播放的小工具。无依赖。 */
const Ink = (() => {
  "use strict";
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const D = Math.PI / 180;

  /* ── 主题色：从 CSS 变量读，主题一变全部重画 ── */
  let pal = null;
  const readPal = () => {
    const cs = getComputedStyle(root), g = (k) => cs.getPropertyValue(k).trim();
    pal = { paper: g("--paper"), ink: g("--ink"), soft: g("--ink-soft"), pale: g("--ink-pale"), red: g("--cinnabar"), line: g("--line"), wash: g("--wash"), mi: g("--mi"), num: g("--num"), brush: g("--brush"), serif: g("--serif"), math: g("--math") };
    return pal;
  };
  const P = () => pal || readPal();

  /* ── 画布：按容器尺寸和像素比自适应；draw(ctx, w, h, pal) 用 CSS 像素作图 ── */
  const views = new Set();
  function paint(v) {
    const c = v.canvas, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = v.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.setLineDash([]);
    v.w = w; v.h = h; v.draw(ctx, w, h, P());
  }
  function view(canvas, draw) {
    const v = { canvas, ctx: canvas.getContext("2d"), draw, queued: false };
    v.redraw = () => { if (v.queued) return; v.queued = true; requestAnimationFrame(() => { v.queued = false; paint(v); }); };
    views.add(v);
    new ResizeObserver(() => paint(v)).observe(canvas);
    paint(v);
    return v;
  }
  const retheme = () => { pal = null; views.forEach(paint); };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);
  new MutationObserver(retheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (document.fonts) {
    Promise.all(["20px KaTeX_Main", "italic 20px KaTeX_Math", "20px KaTeX_Fraktur"].map((f) => document.fonts.load(f).catch(() => null))).then(retheme);
    document.fonts.ready.then(retheme);
  }

  /* ── 可复现的随机数（墨迹纹理每次画都一样） ── */
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ── 笔触：沿折线铺一条宽度渐变的带子，两头收锋；可选晕染（bleed）和枯笔（dry） ── */
  function ribbon(pts, wf) {
    const n = pts.length, L = [0];
    for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[n - 1] || 1, left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, hw = wf(L[i] / tot) / 2;
      left.push([pts[i][0] - (dy / d) * hw, pts[i][1] + (dx / d) * hw]);
      right.push([pts[i][0] + (dy / d) * hw, pts[i][1] - (dx / d) * hw]);
    }
    return { left, right, L, tot };
  }
  function fillRibbon(ctx, rb) {
    ctx.beginPath(); ctx.moveTo(rb.left[0][0], rb.left[0][1]);
    for (const p of rb.left) ctx.lineTo(p[0], p[1]);
    for (let i = rb.right.length - 1; i >= 0; i--) ctx.lineTo(rb.right[i][0], rb.right[i][1]);
    ctx.closePath(); ctx.fill();
  }
  function stroke(ctx, pts, o = {}) {
    if (pts.length < 2) return;
    const { w = 3, w1 = w, color = P().ink, alpha = 1, bleed = 0, taper = [0.12, 0.25], dry = 0, seed = 7, cap = true } = o;
    const wf = (t) => {
      const base = w + (w1 - w) * t;
      const a = taper[0] > 0 ? Math.min(1, t / taper[0]) : 1, b = taper[1] > 0 ? Math.min(1, (1 - t) / taper[1]) : 1;
      return base * (0.28 + 0.72 * Math.sqrt(Math.max(0, Math.min(a, b))));
    };
    ctx.save(); ctx.fillStyle = color;
    if (bleed) { // 晕：同一条笔触放宽、模糊、淡淡铺一层
      ctx.globalAlpha = alpha * 0.16; ctx.filter = `blur(${bleed}px)`;
      fillRibbon(ctx, ribbon(pts, (t) => wf(t) * 1.6 + 1.2)); ctx.filter = "none";
    }
    ctx.globalAlpha = alpha;
    const rb = ribbon(pts, wf); fillRibbon(ctx, rb);
    if (cap) { // 圆头，免得收锋处是平口
      for (const [i, t] of [[0, 0], [pts.length - 1, 1]]) { ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], wf(t) / 2, 0, 2 * Math.PI); ctx.fill(); }
    }
    if (dry > 0) { // 枯笔：末段擦出几道丝缝（只在空白画布上先画时用）
      const r = rng(seed); ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "#000"; ctx.lineCap = "round";
      const K = Math.max(4, Math.round(w / 1.8));
      for (let k = 0; k < K; k++) {
        const off = (r() - 0.5) * 0.92, t0 = 1 - dry * Math.pow(r(), 0.6);
        ctx.lineWidth = 0.5 + r() * Math.max(0.8, w / 9); ctx.globalAlpha = 0.45 + 0.55 * r();
        ctx.beginPath(); let started = false;
        for (let i = 0; i < pts.length; i++) {
          if (rb.L[i] / rb.tot < t0) continue;
          const x = (rb.left[i][0] + rb.right[i][0]) / 2 + (rb.left[i][0] - rb.right[i][0]) * off;
          const y = (rb.left[i][1] + rb.right[i][1]) / 2 + (rb.left[i][1] - rb.right[i][1]) * off;
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  /* 细线：等宽，可虚线 */
  function line(ctx, pts, { w = 1, color = P().ink, alpha = 1, dash = null } = {}) {
    if (pts.length < 2) return;
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); ctx.restore();
  }
  /* 墨点：实心加一圈淡晕 */
  function dot(ctx, x, y, r, { color = P().ink, alpha = 1, bleed = true } = {}) {
    ctx.save(); ctx.fillStyle = color;
    if (bleed) { ctx.globalAlpha = alpha * 0.18; ctx.beginPath(); ctx.arc(x, y, r * 1.75, 0, 2 * Math.PI); ctx.fill(); }
    ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
  }
  function ring(ctx, x, y, r, { color = P().red, w = 1.6, alpha = 1, dash = null } = {}) {
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = w; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
  }
  /* 箭头头部：ang 是前进方向（屏幕坐标里的角） */
  function head(ctx, x, y, ang, { size = 9, color = P().ink, alpha = 1 } = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(size * 0.25, 0); ctx.lineTo(-size, -size * 0.48); ctx.quadraticCurveTo(-size * 0.62, 0, -size, size * 0.48); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  /* 折线中途放一个箭头（在弧长比例 at 处） */
  function midHead(ctx, pts, at, o) {
    if (pts.length < 2) return;
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const target = L[L.length - 1] * at; let i = 1; while (i < pts.length - 1 && L[i] < target) i++;
    const a = pts[i - 1], b = pts[i], f = (target - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    head(ctx, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0]), o);
  }

  /* ── 文字：rich 接受若干段 {t, f: 字体, it: 斜体, s: "sub"|"sup"}，带纸色描边以免压线 ── */
  function rich(ctx, segs, x, y, { size = 15, color = P().soft, align = "left", halo = true, base = "middle" } = {}) {
    if (typeof segs === "string") segs = [{ t: segs }];
    const font = (s) => `${s.it ? "italic " : ""}${s.s ? size * 0.7 : size}px ${s.f || P().serif}`;
    ctx.save(); ctx.textBaseline = base;
    let W = 0; for (const s of segs) { ctx.font = font(s); W += ctx.measureText(s.t).width + (s.gap || 0); }
    let cx = align === "center" ? x - W / 2 : align === "right" ? x - W : x;
    for (const s of segs) {
      ctx.font = font(s); const dy = s.s === "sub" ? size * 0.28 : s.s === "sup" ? -size * 0.38 : 0;
      if (halo) { ctx.strokeStyle = P().paper; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.globalAlpha = 0.9; ctx.strokeText(s.t, cx, y + dy); }
      ctx.globalAlpha = 1; ctx.fillStyle = s.c || color; ctx.fillText(s.t, cx, y + dy);
      cx += ctx.measureText(s.t).width + (s.gap || 0);
    }
    ctx.restore();
  }
  const mi = (t, o = {}) => ({ t, f: "KaTeX_Math, " + P().mi, ...o });      // 斜体变量
  const rm = (t, o = {}) => ({ t, f: "KaTeX_Main, " + P().math, ...o });    // 正体数字、函数名
  const zh = (t, o = {}) => ({ t, f: P().serif, ...o });

  /* 纸上淡淡一团墨晕 */
  function wash(ctx, x, y, r, { color = P().wash, alpha = 1 } = {}) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
  }

  /* ── 数字格式 ── */
  const minus = (s) => String(s).replace(/-/g, "−");
  const fmt = (x, d = 2) => minus((Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d));
  const supDigits = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sci = (x, d = 1) => {
    if (x === 0) return "0";
    if (x >= 0.01 && x < 1000) return fmt(x, x < 1 ? 3 : 2);
    const e = Math.floor(Math.log10(Math.abs(x))), m = x / 10 ** e;
    return `${m.toFixed(d)} × 10${String(e).split("").map((c) => supDigits[c]).join("")}`;
  };

  /* ── 控件 ── */
  function slider(id, onInput) {
    const el = $("#" + id), out = $("#" + id + "-o");
    const fire = () => onInput(+el.value, out);
    el.addEventListener("input", fire);
    return { el, fire, get: () => +el.value, set(v) { el.value = v; onInput(v, out); } };
  }
  function chips(box, onPick) {
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      $$("button", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onPick(b.dataset.k);
    });
    return $$("button", box).find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.k;
  }
  /* 播放：step(dt) 返回 false 就停 */
  function player(btn, step, { onStart } = {}) {
    let on = false, last = 0, raf = 0;
    const label = btn.textContent;
    const frame = (ts) => { if (!on) return; const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; if (step(dt) === false) stop(); else raf = requestAnimationFrame(frame); };
    const start = () => { if (onStart) onStart(); on = true; last = 0; btn.setAttribute("aria-pressed", "true"); btn.textContent = "停"; raf = requestAnimationFrame(frame); };
    const stop = () => { on = false; cancelAnimationFrame(raf); btn.setAttribute("aria-pressed", "false"); btn.textContent = label; };
    btn.addEventListener("click", () => (on ? stop() : start()));
    return { start, stop, get on() { return on; } };
  }

  /* ── 术语弹注：正文 .term → 卷末总表里对应的一条 ── */
  (function gloss() {
    const pop = $("#pop"); if (!pop) return;
    let cur = null;
    const close = () => { if (!cur) return; cur.setAttribute("aria-expanded", "false"); pop.hidden = true; cur = null; };
    function open(b) {
      close(); const src = document.getElementById("g-" + b.dataset.g); if (!src) return;
      $("#pop-title").innerHTML = $("dt", src).innerHTML; $("#pop-body").innerHTML = $("dd", src).innerHTML; $("#pop-more").href = "#g-" + b.dataset.g;
      pop.hidden = false; b.setAttribute("aria-expanded", "true"); cur = b;
      const r = b.getBoundingClientRect(), vw = document.documentElement.clientWidth;
      pop.style.left = scrollX + clamp(r.left, 16, Math.max(16, vw - pop.offsetWidth - 16)) + "px"; pop.style.top = scrollY + r.bottom + 8 + "px";
    }
    $$(".term").forEach((b) => b.setAttribute("aria-expanded", "false"));
    document.addEventListener("click", (ev) => {
      const b = ev.target.closest(".term");
      if (b) return b === cur ? close() : open(b);
      if (ev.target.closest("#pop-close, #pop-more") || !ev.target.closest("#pop")) close();
    });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && cur) { const b = cur; close(); b.focus(); } });
    addEventListener("resize", close);
  })();

  return { $, $$, clamp, D, P, view, rng, stroke, line, dot, ring, head, midHead, rich, mi, rm, zh, wash, fmt, minus, sci, slider, chips, player };
})();
