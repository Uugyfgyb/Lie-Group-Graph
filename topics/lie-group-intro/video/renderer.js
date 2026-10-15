/* renderer.js — 科普动画的逐帧渲染。renderAt(t) 只依赖 t 和时间轴 TL，同一个 t 永远画出同一帧。
   画面与专题页同一套水墨：纸色底、浓淡墨笔触、朱色只给要盯住的东西。依赖 lie.js（Lie）、KaTeX、out/timeline.js（TL）。 */
(() => {
  "use strict";
  const W = 1920, H = 1080, PI = Math.PI, TAU = 2 * PI, D2R = PI / 180;
  const cv = document.getElementById("cv"), ctx = cv.getContext("2d");
  const P = {
    paper: "#ecebe3", ink: "#1b1c1a", soft: "#4c4e4a", pale: "#8b8d86", red: "#ad3324", seal: "#f3ece0",
    wash: "rgba(27,28,26,0.09)", line: "rgba(27,28,26,0.22)",
    brush: '"Ma Shan Zheng","STKaiti","KaiTi","Kaiti SC",serif', serif: '"Noto Serif SC","Songti SC","STSong","SimSun",serif',
  };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ramp = (u, a, b) => clamp01((u - a) / (b - a));
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const E = (u, a, b) => ease(ramp(u, a, b));
  const lerp = (a, b, f) => a + (b - a) * f;
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ── 纸：底色、两团墨晕、纤维、四角暗角，只画一次 ── */
  const paper = document.createElement("canvas"); paper.width = W; paper.height = H;
  (() => {
    const g = paper.getContext("2d"), r = rng(3);
    g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
    for (const [x, y, rad] of [[1700, -120, 1000], [-80, 620, 760], [1100, 1180, 700]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(27,28,26,0.07)"); gr.addColorStop(1, "rgba(27,28,26,0)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    g.lineCap = "round";
    for (let i = 0; i < 2600; i++) {
      const x = r() * W, y = r() * H, len = 6 + r() * 34, a = r() * TAU, c = (r() - 0.5) * 0.6;
      g.strokeStyle = `rgba(27,28,26,${0.018 + r() * 0.03})`; g.lineWidth = 0.5 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + c) * len * 0.5, y + Math.sin(a + c) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(27,28,26,${0.03 + r() * 0.05})`; g.beginPath(); g.arc(r() * W, r() * H, 0.4 + r() * 0.8, 0, TAU); g.fill(); }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05); v.addColorStop(0, "rgba(27,28,26,0)"); v.addColorStop(1, "rgba(27,28,26,0.12)");
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  })();
  // 枯笔要在独立图层上擦，免得擦穿纸纹
  const layerCv = document.createElement("canvas"); layerCv.width = W; layerCv.height = H;
  const layer = layerCv.getContext("2d");

  /* ── 笔触（与 ink.js 同一套写法；upto 让一笔从头慢慢写出来） ── */
  function build(pts, wf, upto = 1) {
    const n = pts.length, L = [0];
    for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[n - 1] || 1, left = [], right = [], used = [];
    for (let i = 0; i < n; i++) {
      if (L[i] / tot > upto + 1e-9 && i > 1) break;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, hw = wf(L[i] / tot) / 2;
      left.push([pts[i][0] - (dy / d) * hw, pts[i][1] + (dx / d) * hw]); right.push([pts[i][0] + (dy / d) * hw, pts[i][1] - (dx / d) * hw]); used.push(i);
    }
    return { left, right, L, tot, used };
  }
  function fillRb(c, rb) {
    if (rb.left.length < 2) return;
    c.beginPath(); c.moveTo(rb.left[0][0], rb.left[0][1]);
    for (const p of rb.left) c.lineTo(p[0], p[1]);
    for (let i = rb.right.length - 1; i >= 0; i--) c.lineTo(rb.right[i][0], rb.right[i][1]);
    c.closePath(); c.fill();
  }
  function stroke(c, pts, o = {}) {
    if (pts.length < 2) return;
    const { w = 4, w1 = w, color = P.ink, alpha = 1, bleed = 0, taper = [0.12, 0.25], dry = 0, seed = 7, upto = 1, cap = true } = o;
    if (upto <= 0 || alpha <= 0) return;
    const wf = (t) => { const base = w + (w1 - w) * t; const a = taper[0] > 0 ? Math.min(1, t / taper[0]) : 1, b = taper[1] > 0 ? Math.min(1, (1 - t) / taper[1]) : 1; return base * (0.28 + 0.72 * Math.sqrt(Math.max(0, Math.min(a, b)))); };
    c.save(); c.fillStyle = color;
    if (bleed) { c.globalAlpha = alpha * 0.16; c.filter = `blur(${bleed}px)`; fillRb(c, build(pts, (t) => wf(t) * 1.6 + 1.5, upto)); c.filter = "none"; }
    c.globalAlpha = alpha;
    const rb = build(pts, wf, upto); fillRb(c, rb);
    if (cap && rb.used.length) {
      for (const k of [0, rb.used.length - 1]) { const i = rb.used[k]; c.beginPath(); c.arc(pts[i][0], pts[i][1], wf(rb.L[i] / rb.tot) / 2, 0, TAU); c.fill(); }
    }
    if (dry > 0) {
      const r = rng(seed); c.globalCompositeOperation = "destination-out"; c.strokeStyle = "#000"; c.lineCap = "round";
      const K = Math.max(5, Math.round(w / 1.8));
      for (let k = 0; k < K; k++) {
        const off = (r() - 0.5) * 0.92, t0 = 1 - dry * Math.pow(r(), 0.6);
        c.lineWidth = 0.6 + r() * Math.max(1, w / 8); c.globalAlpha = 0.45 + 0.55 * r();
        c.beginPath(); let started = false;
        rb.used.forEach((i, k2) => {
          if (rb.L[i] / rb.tot < t0) return;
          const x = (rb.left[k2][0] + rb.right[k2][0]) / 2 + (rb.left[k2][0] - rb.right[k2][0]) * off, y = (rb.left[k2][1] + rb.right[k2][1]) / 2 + (rb.left[k2][1] - rb.right[k2][1]) * off;
          if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
        });
        c.stroke();
      }
    }
    c.restore();
  }
  function line(c, pts, { w = 1.5, color = P.ink, alpha = 1, dash = null, upto = 1 } = {}) {
    if (pts.length < 2 || alpha <= 0 || upto <= 0) return;
    const n = Math.max(2, Math.round(pts.length * upto));
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; c.setLineDash(dash || []);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); c.restore();
  }
  function dot(c, x, y, r, { color = P.ink, alpha = 1, bleed = true } = {}) {
    if (alpha <= 0) return;
    c.save(); c.fillStyle = color;
    if (bleed) { c.globalAlpha = alpha * 0.18; c.beginPath(); c.arc(x, y, r * 1.75, 0, TAU); c.fill(); }
    c.globalAlpha = alpha; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  function ring(c, x, y, r, { color = P.red, w = 2.4, alpha = 1, dash = null } = {}) {
    if (alpha <= 0) return;
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.restore();
  }
  function head(c, x, y, ang, { size = 14, color = P.ink, alpha = 1 } = {}) {
    if (alpha <= 0) return;
    c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = color; c.globalAlpha = alpha;
    c.beginPath(); c.moveTo(size * 0.25, 0); c.lineTo(-size, -size * 0.48); c.quadraticCurveTo(-size * 0.62, 0, -size, size * 0.48); c.closePath(); c.fill(); c.restore();
  }
  function endHead(c, pts, o) { if (pts.length < 2) return; const a = pts[Math.max(0, pts.length - 4)], b = pts[pts.length - 1]; head(c, b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), o); }
  function midHead(c, pts, at, o) {
    if (pts.length < 2) return;
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const target = L[L.length - 1] * at; let i = 1; while (i < pts.length - 1 && L[i] < target) i++;
    const a = pts[i - 1], b = pts[i], f = (target - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    head(c, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0]), o);
  }
  const mi = (t, o = {}) => ({ t, f: "KaTeX_Math", it: true, ...o });
  const rm = (t, o = {}) => ({ t, f: "KaTeX_Main", ...o });
  const zh = (t, o = {}) => ({ t, f: P.serif, ...o });
  const bz = (t, o = {}) => ({ t, f: P.brush, ...o });
  const fk = (t, o = {}) => ({ t, f: "KaTeX_Fraktur", ...o });
  function text(c, segs, x, y, { size = 34, color = P.soft, align = "left", alpha = 1, halo = true } = {}) {
    if (alpha <= 0) return;
    if (typeof segs === "string") segs = [zh(segs)];
    const font = (s) => `${s.it ? "italic " : ""}${s.s ? size * 0.68 : size}px ${s.f}`;
    c.save(); c.textBaseline = "middle"; c.globalAlpha = alpha;
    let Wt = 0; for (const s of segs) { c.font = font(s); Wt += c.measureText(s.t).width; }
    let x0 = align === "center" ? x - Wt / 2 : align === "right" ? x - Wt : x;
    for (const s of segs) {
      c.font = font(s); const dy = s.s === "sub" ? size * 0.26 : s.s === "sup" ? -size * 0.36 : 0;
      if (halo) { c.strokeStyle = P.paper; c.lineWidth = 7; c.lineJoin = "round"; c.strokeText(s.t, x0, y + dy); }
      c.fillStyle = s.c || color; c.fillText(s.t, x0, y + dy); x0 += c.measureText(s.t).width;
    }
    c.restore();
  }
  const circlePts = (cx, cy, r, n = 200, a0 = 0, a1 = TAU) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; });
  function ball(c, cx, cy, r, { alpha = 1, upto = 1, w = 4 } = {}) {
    if (alpha <= 0) return;
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, "rgba(27,28,26,0)"); g.addColorStop(1, "rgba(27,28,26,0.12)");
    c.save(); c.globalAlpha = alpha * upto; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.restore();
    stroke(c, circlePts(cx, cy, r, 240, 0.6, 0.6 + TAU * 0.995), { w, w1: w * 0.7, color: P.ink, alpha: 0.85 * alpha, taper: [0.03, 0.08], upto });
  }
  function sealBox(c, ch, x, y, s, alpha = 1) {
    if (alpha <= 0) return;
    c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(-3 * D2R); c.fillStyle = P.red;
    c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * 0.1); c.fill();
    c.fillStyle = P.seal; c.font = `${s * 0.68}px ${P.brush}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ch, 0, s * 0.04); c.restore();
  }

  /* ── 圆相：卷首图，开场和结尾共用 ── */
  function enso(c, cx, cy, R, { reveal = 1, beads = 1, tangent = 1, threads = 1, labels = 1, alpha = 1, sealAlpha = 0 } = {}) {
    const at = (phi, r = R) => [cx + r * Math.cos(phi), cy - r * Math.sin(phi)];
    const bl = []; let a = 176 * D2R, gap = 14 * D2R; while (a > 118 * D2R) { bl.push(a); a -= gap; gap *= 0.8; }
    bl.forEach((b, k) => { const f = (k + 1) / bl.length, show = clamp01(beads * bl.length - k), [x, y] = at(b); dot(c, x, y, R * (0.024 + 0.06 * f) * (0.6 + 0.4 * show), { color: P.ink, alpha: alpha * show * (0.5 + 0.45 * f) }); });
    if (reveal > 0) {
      const pts = [], a0 = 112 * D2R, a1 = -172 * D2R;
      for (let i = 0; i <= 320; i++) { const t = i / 320, phi = a0 + (a1 - a0) * t; pts.push(at(phi, R * (1 + 0.013 * Math.sin(2.3 * phi + 0.4) - 0.012 * t))); }
      layer.clearRect(0, 0, W, H);
      stroke(layer, pts, { w: R * 0.2, w1: R * 0.075, color: P.ink, alpha: 0.93, taper: [0.03, 0.1], dry: 0.45, seed: 11, bleed: 4, upto: reveal });
      c.save(); c.globalAlpha = alpha; c.drawImage(layerCv, 0, 0); c.restore();
    }
    const Ept = at(0), fs = R * 0.17;
    if (tangent > 0) stroke(c, [[Ept[0], cy + 0.55 * R], [Ept[0], cy - 1.36 * R]], { w: 5, color: P.red, taper: [0.2, 0.08], upto: tangent, alpha });
    [0.45, 0.9, 1.3].forEach((phiK, j) => {
      const f = clamp01(threads * 3 - j); if (f <= 0) return;
      const inv = []; for (let i = 0; i <= 50; i++) { const al = (phiK * i) / 50, L = (phiK - al) * R; inv.push([cx + R * Math.cos(al) - L * Math.sin(al), cy - R * Math.sin(al) - L * Math.cos(al)]); }
      line(c, inv, { w: 2.6, color: P.red, dash: [6, 7], alpha: 0.9 * alpha, upto: f });
      dot(c, inv[0][0], inv[0][1], 5, { color: P.red, bleed: false, alpha });
      if (f >= 1) endHead(c, inv, { size: 15, color: P.red, alpha });
    });
    if (tangent > 0.3) dot(c, Ept[0], Ept[1], R * 0.06, { color: P.red, alpha });
    if (labels > 0) {
      const la = alpha * labels;
      text(c, [mi("e")], Ept[0] + 18, Ept[1] + fs * 0.8, { size: fs, color: P.red, alpha: la });
      const g = at(-138 * D2R, R * 1.25); text(c, [mi("G")], g[0], g[1], { size: fs * 1.1, color: P.ink, align: "center", alpha: la });
      text(c, [fk("g"), rm(" = "), mi("T"), mi("e", { s: "sub" }), mi("G")], Ept[0] - 18, cy - 1.3 * R, { size: fs, color: P.red, align: "right", alpha: la });
      const mid = [cx + R * Math.cos(0.45) - 0.45 * R * Math.sin(0.45), cy - R * Math.sin(0.45) - 0.45 * R * Math.cos(0.45)];
      text(c, [rm("exp")], mid[0] + fs * 0.5, mid[1] - fs * 0.25, { size: fs * 0.92, color: P.red, alpha: la });
    }
    if (sealAlpha > 0) {
      const sw = R * 0.24, sx = cx + R * 1.35, sy = cy + R * 0.7;
      c.save(); c.globalAlpha = sealAlpha; c.translate(sx, sy); c.rotate(-3 * D2R); c.fillStyle = P.red;
      c.beginPath(); c.roundRect(-sw / 2, -sw, sw, sw * 2, 5); c.fill();
      c.fillStyle = P.seal; c.font = `${sw * 0.78}px ${P.brush}`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("李", 0, -sw * 0.48); c.fillText("群", 0, sw * 0.48); c.restore();
    }
  }

  /* ───────── 各场 ───────── */
  const scenes = {};

  scenes.open = (c, u, S) => {
    enso(c, 960, 430, 245, { beads: E(u, 0.2, 1.4), reveal: E(u, 1.0, 3.6), tangent: E(u, 3.3, 4.2), threads: E(u, 4.0, 5.6), labels: E(u, 4.6, 5.4), sealAlpha: E(u, 5.4, 6.0) });
  };

  scenes.lian = (c, u, S) => {
    const cx = 700, cy = 535, Rr = 310, Rf = 225;
    const { L, D } = S, at = (phi, r) => [cx + r * Math.cos(phi), cy - r * Math.sin(phi)];
    // 叶数 n 与转角 θ 随旁白变化
    let n = 6, th = 0;
    if (u < L(1)) th = 60 * E(u, L(0) + 0.9, L(0) + D(0) * 0.8);
    else if (u < L(2)) th = 60 - 15 * E(u, L(1) + 0.1, L(1) + 1.3);
    else if (u < L(3)) { th = 45 * (1 - E(u, L(2), L(2) + 0.6)); n = Math.round(6 * Math.pow(10, E(u, L(2) + 0.3, L(2) + D(2) + 0.4))); }
    else { n = 60; th = Math.min(359, Math.max(0, u - (L(3) + 0.45 * D(3))) * 30); }
    const m = u >= L(3) ? E(u, L(3), L(3) + 0.45 * D(3)) : 0; // 0 风车 → 1 圆盘
    const wd = Math.min(28, ((TAU * Rf) / n) * 0.38);
    const mill = (rot, color, alpha) => {
      if (alpha <= 0) return;
      for (let k = 0; k < n; k++) {
        const a = (TAU * k) / n + rot, pts = [];
        for (let i = 0; i <= 26; i++) { const q = i / 26; pts.push(at(a + 0.62 * q * q, Rf * (0.12 + 0.88 * q))); }
        stroke(c, pts, { w: wd, w1: wd * 0.55, color, alpha, taper: [0.35, 0.55] });
      }
    };
    const disk = (alpha) => {
      if (alpha <= 0) return;
      c.save(); c.globalAlpha = alpha * 0.5; c.fillStyle = P.wash; c.beginPath(); c.arc(cx, cy, Rf, 0, TAU); c.fill(); c.restore();
      for (const f of [0.3, 0.55, 0.8, 1]) stroke(c, circlePts(cx, cy, Rf * f, 180, 0.3 + f + th * D2R, 0.3 + f + th * D2R + TAU * 0.97), { w: 5 + 10 * f, color: P.ink, alpha: alpha * 0.85, taper: [0.05, 0.2] });
    };
    mill(0, P.pale, 0.5 * (1 - m)); mill(th * D2R, P.ink, 0.9 * (1 - m)); disk(m);
    dot(c, cx, cy, 9, { color: P.ink });
    // 外圈：群元；n → ∞ 时珠子连成一笔圆
    const pulse = u >= L(1) + 0.45 * D(1) && u < L(2) ? 1 + 0.35 * Math.max(0, Math.sin((u - L(1)) * 7)) : 1;
    line(c, circlePts(cx, cy, Rr, 200), { w: 1.4, color: P.pale, alpha: 0.7 * (1 - m), dash: [2, 8] });
    for (let k = 1; k < n; k++) { const [x, y] = at((TAU * k) / n, Rr); dot(c, x, y, (n > 30 ? 6 : 10) * pulse, { color: P.ink, alpha: 1 - m }); }
    const ringF = E(u, L(3) + 0.15 * D(3), L(3) + 0.7 * D(3));
    if (ringF > 0) stroke(c, circlePts(cx, cy, Rr, 260, 0.02, 0.02 + TAU * 0.985), { w: 20, w1: 11, color: P.ink, alpha: 0.88, taper: [0.04, 0.15], bleed: 2, upto: ringF });
    const e = at(0, Rr); dot(c, e[0], e[1], 13, { color: P.red });
    text(c, [mi("e")], e[0] + 16, e[1] + 26, { size: 40, color: P.red });
    // 当前转角：外侧朱弧 + 箭头
    const arcA = u < L(4) ? 1 : 1 - E(u, L(4), L(4) + 0.6);
    if (th > 0.5 && arcA > 0) {
      c.save(); c.globalAlpha *= arcA;
      const ra = Rr + 44, arc = circlePts(cx, cy, ra, Math.max(4, Math.round(th / 2)), 0, th * D2R);
      line(c, arc, { w: 3, color: P.red, alpha: 0.9 }); endHead(c, arc, { size: 16, color: P.red });
      line(c, [at(th * D2R, Rr + 22), at(th * D2R, Rr - 32)], { w: 3.4, color: P.red });
      c.restore();
    }
    if (u < L(3)) {
      const step = 360 / n, k = Math.round(th / step);
      if (th > 1 && Math.abs(th - k * step) < 0.6) { const q = at(k * step * D2R, Rr); ring(c, q[0], q[1], 26, { color: P.red, w: 3.2 }); }
      text(c, [mi("θ"), rm(` = ${Math.round(th)}°`)], 140, 230, { size: 46, color: P.soft });
      text(c, [zh(`${n} 个转动`)], 140, 292, { size: 34, color: P.pale });
    } else text(c, [zh("转多少度都重合")], 140, 230, { size: 40, color: P.soft, alpha: E(u, L(3) + 0.4 * D(3), L(3) + 0.6 * D(3)) * (1 - E(u, L(4), L(4) + 0.5)) });
    // 45° 对不上：朱色叉
    if (u >= L(1) + 1.2 && u < L(2)) {
      const fa = E(u, L(1) + 1.2, L(1) + 1.6), tip = at(45 * D2R + 0.62, Rf + 8);
      line(c, [[tip[0] - 16, tip[1] - 16], [tip[0] + 16, tip[1] + 16]], { w: 5, color: P.red, alpha: fa });
      line(c, [[tip[0] + 16, tip[1] - 16], [tip[0] - 16, tip[1] + 16]], { w: 5, color: P.red, alpha: fa });
      text(c, [zh("对不上")], tip[0] + 28, tip[1] - 6, { size: 34, color: P.red, alpha: fa });
    }
    if (u >= L(4)) text(c, [bz("李群 "), mi("G"), rm(" = "), mi("SO"), rm("(2)")], 140, 230, { size: 50, color: P.ink, align: "left", alpha: E(u, L(4) + 0.3, L(4) + 1.1) });
  };

  scenes.qie = (c, u, S) => {
    const { L, D } = S, cx = 660, cy = 540, Hp = 340;
    let lk;
    if (u < L(3)) lk = Math.log(100) * E(u, L(0) + 0.55 * D(0), L(1) + 0.9 * D(1));
    else lk = Math.log(100) + (Math.log(4) - Math.log(100)) * E(u, L(3) - 0.2, L(3) + 1.6);
    const k = Math.exp(lk), Hw = 1.3 / k, sc = Hp / Hw, c0 = 1 - 1 / k;
    const X = (x) => cx + (x - c0) * sc, Y = (y) => cy - y * sc;
    c.save(); c.beginPath(); c.rect(70, 150, 1110, 750); c.clip();
    line(c, [[70, Y(0)], [1180, Y(0)]], { w: 1.4, color: P.pale, alpha: 0.5 });
    const pts = [];
    if (Hw > 0.75) for (let i = 0; i <= 400; i++) { const a = (i / 400) * TAU; pts.push([X(Math.cos(a)), Y(Math.sin(a))]); }
    else { const A = Math.asin(Math.min(1, Hw * 1.3)); for (let i = 0; i <= 300; i++) { const a = -A + (2 * A * i) / 300; pts.push([X(Math.cos(a)), Y(Math.sin(a))]); } }
    stroke(c, pts, { w: 9, color: P.ink, taper: [0, 0], cap: false, bleed: 2.5 });
    const ta = E(u, L(0) + 0.3 * D(0), L(0) + 0.6 * D(0));
    line(c, [[X(1), Y(-1.4 * Hw)], [X(1), Y(1.4 * Hw)]], { w: 3, color: P.red, dash: [14, 10], alpha: ta });
    if (k > 1.8 && Hw * 0.8 < 0.97) {
      const y0 = 0.8 * Hw, xa = Math.sqrt(1 - y0 * y0), A = [X(xa), Y(y0)], B = [X(1), Y(y0)], fa = ramp(k, 1.8, 3);
      line(c, [A, B], { w: 3.4, color: P.red, alpha: fa });
      line(c, [[A[0], A[1] - 9], [A[0], A[1] + 9]], { w: 2.6, color: P.red, alpha: fa }); line(c, [[B[0], B[1] - 9], [B[0], B[1] + 9]], { w: 2.6, color: P.red, alpha: fa });
    }
    const e = [X(1), Y(0)];
    const ja = E(u, L(2) + 0.3, L(2) + 1.3);
    if (ja > 0) { const tip = [e[0], e[1] - 200 * ja]; stroke(c, [e, [tip[0], tip[1] + 12]], { w: 7, color: P.red, taper: [0, 0.1] }); head(c, tip[0], tip[1], -PI / 2, { size: 26, color: P.red }); text(c, [mi("J")], e[0] + 26, e[1] - 160, { size: 48, color: P.red, alpha: ja }); }
    dot(c, e[0], e[1], 12, { color: P.red });
    text(c, [mi("e")], e[0] + 22, e[1] + 34, { size: 44, color: P.red });
    if (Hw > 0.5) { const yl = -0.62; text(c, [mi("G")], X(Math.sqrt(1 - yl * yl)) - 30, Y(yl), { size: 46, color: P.soft, align: "right" }); }
    c.restore();
    // 放大倍数
    const za = ramp(u, L(0) + 0.5 * D(0), L(0) + 0.7 * D(0)) * (1 - ramp(u, L(2) + 0.5, L(2) + 1.2));
    text(c, [rm("×"), rm(k < 9.5 ? k.toFixed(1) : String(Math.round(k)))], 1130, 220, { size: 60, color: P.red, align: "right", alpha: za });
    // J 把向右变成向上：小插图
    const ia = E(u, L(3) + 1.2, L(3) + 1.9);
    if (ia > 0) {
      const ox = 1460, oy = 760, len = 130, ang = (PI / 2) * E(u, L(3) + 2.2, L(3) + 3.6);
      c.save(); c.globalAlpha = ia; c.fillStyle = "rgba(27,28,26,0.05)"; c.beginPath(); c.roundRect(ox - 230, oy - 190, 460, 300, 16); c.fill(); c.restore();
      line(c, [[ox - 180, oy], [ox + 190, oy]], { w: 1.2, color: P.pale, alpha: ia }); line(c, [[ox, oy + 90], [ox, oy - 175]], { w: 1.2, color: P.pale, alpha: ia });
      stroke(c, [[ox, oy], [ox + len - 14, oy]], { w: 6, color: P.pale, taper: [0, 0], alpha: ia * 0.7 }); head(c, ox + len, oy, 0, { size: 22, color: P.pale, alpha: ia * 0.7 });
      const tx = ox + len * Math.cos(ang), ty = oy - len * Math.sin(ang);
      stroke(c, [[ox, oy], [ox + (len - 14) * Math.cos(ang), oy - (len - 14) * Math.sin(ang)]], { w: 7, color: P.ink, taper: [0, 0], alpha: ia }); head(c, tx, ty, -ang, { size: 24, color: P.ink, alpha: ia });
      const arc = circlePts(ox, oy, 70, 30, 0.12, Math.max(0.13, ang - 0.12)); if (ang > 0.3) { line(c, arc, { w: 3, color: P.red, alpha: ia }); endHead(c, arc, { size: 14, color: P.red, alpha: ia }); }
      text(c, [mi("J")], ox + 70, oy - 70, { size: 40, color: P.red, alpha: ia * ramp(ang, 0.3, 0.8) });
    }
  };

  scenes.juan = (c, u, S) => {
    const { L, D } = S, cx = 620, cy = 640, R = 228, th = 1.8;
    const at = (phi, r = R) => [cx + r * Math.cos(phi), cy - r * Math.sin(phi)];
    const ab = 1 - E(u, L(4), L(4) + 0.6); // 前半（绕线、级数）
    if (ab > 0) {
      c.save(); c.globalAlpha = ab;
      line(c, [[cx - R * 1.6, cy], [cx + R * 1.6, cy]], { w: 1.4, color: P.pale, alpha: 0.5 });
      line(c, [[cx, cy + R * 1.15], [cx, cy - R * 2.0]], { w: 1.4, color: P.pale, alpha: 0.5 });
      stroke(c, circlePts(cx, cy, R, 240, 0.6, 0.6 + TAU * 0.99), { w: 7, w1: 5, color: P.ink, alpha: 0.85, taper: [0.03, 0.08], bleed: 2 });
      const E0 = at(0);
      line(c, [[E0[0], cy + 0.5 * R], [E0[0], cy - 2.1 * R]], { w: 2.6, color: P.red, dash: [12, 10], alpha: 0.75 });
      // 绕线：长 θ 的切线段像线一样绕到圆上（自由端走圆的渐开线）
      const w = E(u, L(0) + 0.35 * D(0), L(0) + D(0) + 0.2), al = w * th;
      const thrA = u < L(2) ? 1 : 1 - 0.6 * E(u, L(2), L(2) + 0.6);
      const arcPts = circlePts(cx, cy, R, Math.max(2, Math.round(al * 60)), 0, al), tip0 = at(al);
      const tail = (th - al) * R, dirx = -Math.sin(al), diry = -Math.cos(al), free = [tip0[0] + dirx * tail, tip0[1] + diry * tail];
      if (al > 0.005) stroke(c, arcPts, { w: 9, color: P.red, taper: [0, 0], alpha: 0.85 * thrA });
      if (tail > 1) stroke(c, [tip0, free], { w: 9, color: P.red, taper: [0, 0], alpha: 0.85 * thrA });
      if (w > 0 && w < 1) {
        const inv = []; for (let i = 0; i <= 40; i++) { const a2 = (al * i) / 40, L2 = (th - a2) * R; inv.push([cx + R * Math.cos(a2) - L2 * Math.sin(a2), cy - R * Math.sin(a2) - L2 * Math.cos(a2)]); }
        line(c, inv, { w: 2.4, color: P.red, dash: [5, 6], alpha: 0.8 });
      }
      dot(c, free[0], free[1], 9, { color: P.red, alpha: thrA });
      dot(c, E0[0], E0[1], 11, { color: P.red });
      text(c, [mi("e")], E0[0] + 20, E0[1] + 30, { size: 40, color: P.red });
      text(c, [zh("长 "), mi("θ"), zh(" 的切线")], E0[0] + 22, cy - th * R * 0.55, { size: 32, color: P.red, alpha: (1 - w) * (u < L(2) ? 1 : 0) });
      // 级数：各项首尾相接
      if (u >= L(2) - 0.1) {
        const { sums } = Lie.expSeries(th, 8);
        const tk = (k) => (k === 0 ? L(2) + 0.2 : k === 1 ? L(2) + 0.3 * D(2) : L(2) + 0.55 * D(2) + ((k - 2) * (0.5 * D(2) + 0.6)) / 7);
        let prev = [0, 0];
        sums.forEach((Sk, k) => {
          const f = E(u, tk(k), tk(k) + (k < 2 ? 0.7 : 0.5)); if (f <= 0) { prev = Sk; return; }
          const a = [cx + prev[0] * R, cy - prev[1] * R], b = [cx + Sk[0] * R, cy - Sk[1] * R], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (len > 1) {
            const pts = Array.from({ length: 12 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / 11, a[1] + ((b[1] - a[1]) * i) / 11]);
            stroke(c, pts, { w: k === 1 ? 8 : Math.max(3, 8 - 0.7 * k), color: k === 1 ? P.red : P.ink, taper: [0.03, 0.06], upto: f });
            if (f >= 1 && len > 22) head(c, b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), { size: Math.min(20, len * 0.4), color: k === 1 ? P.red : P.ink });
            if (f >= 1 && len > 44 && k <= 5) { const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len; text(c, [rm(String(k))], (a[0] + b[0]) / 2 + nx * 26, (a[1] + b[1]) / 2 + ny * 26, { size: 32, color: k === 1 ? P.red : P.pale, align: "center" }); }
          }
          if (f >= 1) dot(c, b[0], b[1], 5, { color: P.ink, bleed: false });
          prev = Sk;
        });
        const fin = E(u, L(3), L(3) + 0.6);
        if (fin > 0) { const q = at(th); ring(c, q[0], q[1], 18 + 10 * Math.max(0, Math.sin((u - L(3)) * 5)) * (1 - ramp(u, L(3) + 1.2, L(3) + 2)), { color: P.red, w: 3.4, alpha: fin }); text(c, [mi("e"), mi("iθ", { s: "sup" })], q[0] - 30, q[1] - 40, { size: 44, color: P.red, align: "right", alpha: fin }); }
      }
      c.restore();
    }
    // 后半：2×2 矩阵的流，“李”字跟着流变形
    const fa = E(u, L(4) + 0.3, L(4) + 0.9);
    if (fa > 0) {
      const ox = 640, oy = 560, s = 150, A = { rot: [[0, -1], [1, 0]], shear: [[0, 1], [0, 0]], squeeze: [[1, 0], [0, -1]] };
      const t1 = L(4) + 0.55 * D(4), t2 = L(4) + 0.78 * D(4), t3 = L(5) + D(5) + 1.2;
      const ph = u < t1 ? ["rot", L(4) + 0.6, t1, 1.25, "转动"] : u < t2 ? ["shear", t1, t2, 1, "剪切"] : ["squeeze", t2, t3, 0.8, "挤压"];
      const [kind, p0, p1, tMax, name] = ph, tt = tMax * E(u, p0 + 0.15, p0 + Math.min(1.6, (p1 - p0) * 0.8)), pa = fa * E(u, p0, p0 + 0.3);
      const M = Lie.exp2(A[kind], tt), X = (x) => ox + x * s, Y = (y) => oy - y * s;
      c.save(); c.beginPath(); c.rect(90, 180, 1100, 720); c.clip();
      line(c, [[90, Y(0)], [1190, Y(0)]], { w: 1.2, color: P.pale, alpha: 0.4 * pa }); line(c, [[X(0), 180], [X(0), 900]], { w: 1.2, color: P.pale, alpha: 0.4 * pa });
      const seeds = kind === "rot" ? [0.6, 1.2, 1.8, 2.4, 3.0].map((r) => ({ x: [r, 0], s: [0, TAU] }))
        : kind === "shear" ? [-2.2, -1.5, -0.75, 0.75, 1.5, 2.2].map((y) => ({ x: [0, y], s: [-9 / Math.abs(y), 9 / Math.abs(y)] }))
        : [0.35, 1, 2].flatMap((cc) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => ({ x: [a * Math.sqrt(cc), b * Math.sqrt(cc)], s: [-3.5, 3.5] })));
      for (const sd of seeds) {
        const pts = []; for (let i = 0; i <= 220; i++) { const sv = sd.s[0] + ((sd.s[1] - sd.s[0]) * i) / 220, q = Lie.apply(Lie.exp2(A[kind], sv), sd.x); if (Math.abs(q[0]) < 8 && Math.abs(q[1]) < 6) pts.push([X(q[0]), Y(q[1])]); }
        line(c, pts, { w: 1.8, color: P.soft, alpha: 0.5 * pa });
        const vis = pts.filter((q) => q[0] > 110 && q[0] < 1170 && q[1] > 200 && q[1] < 880);
        if (vis.length > 6) for (const f of kind === "rot" ? [0.15, 0.65] : [0.5]) midHead(c, vis, f, { size: 14, color: P.soft, alpha: 0.8 * pa });
      }
      const glyph = (T, color, alpha) => {
        c.save(); c.translate(ox, oy); c.scale(s, -s); c.transform(T[0][0], T[1][0], T[0][1], T[1][1], 0, 0); c.scale(0.01, -0.01);
        c.font = `190px ${P.brush}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = color; c.globalAlpha = alpha; c.shadowColor = color; c.shadowBlur = alpha > 0.5 ? 3 : 0;
        c.fillText("李", 0, 8); c.restore();
      };
      glyph([[1, 0], [0, 1]], P.pale, 0.35 * pa); glyph(M, P.ink, 0.92 * pa);
      line(c, circlePts(X(0), Y(0), s, 120), { w: 2, color: P.red, alpha: 0.45 * pa, dash: [4, 7] });
      const img = Array.from({ length: 161 }, (_, i) => { const a = (i / 160) * TAU, q = Lie.apply(M, [Math.cos(a), Math.sin(a)]); return [X(q[0]), Y(q[1])]; });
      line(c, img, { w: 3.6, color: P.red, alpha: 0.9 * pa });
      c.restore();
      text(c, [bz(name)], 150, 240, { size: 64, color: P.ink, alpha: pa });
      const aa = E(u, L(5) + 0.4, L(5) + 1.2);
      text(c, [zh("面积始终 = π")], 150, 316, { size: 38, color: P.red, alpha: aa * fa });
    }
  };

  scenes.kuo = (c, u, S) => {
    const { L, D } = S, cx = 660, cy = 555, Rs = 295, eps = 30 * D2R;
    const yaw = (-44 + 0.45 * u) * D2R, pitch = 24 * D2R;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const V = [cp * cyw, cp * syw, sp], Er = [-syw, cyw, 0], Eu = [-sp * cyw, -sp * syw, cp];
    const d3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const pr = (q) => [cx + Rs * d3(q, Er), cy - Rs * d3(q, Eu), d3(q, V)];
    const draw3 = (pts3, front, back) => {
      let run = [], fr = null; const flush = () => { if (run.length > 1) (fr ? front : back)(run); };
      for (const q of pts3) { const Pq = pr(q), f = Pq[2] >= 0; if (fr !== null && f !== fr) { flush(); run = [run[run.length - 1]]; } fr = f; run.push(Pq); }
      flush();
    };
    const appear = E(u, 0.1, 1.6);
    ball(c, cx, cy, Rs, { upto: appear, w: 5 });
    const gc = (fn) => Array.from({ length: 161 }, (_, i) => fn((i / 160) * TAU));
    for (const g of [gc((a) => [Math.cos(a), Math.sin(a), 0]), gc((a) => [Math.cos(a), 0, Math.sin(a)]), gc((a) => [0, Math.cos(a), Math.sin(a)])])
      draw3(g, (r) => line(c, r, { w: 1.6, color: P.pale, alpha: 0.9 * appear }), (r) => line(c, r, { w: 1.6, color: P.pale, alpha: 0.4 * appear, dash: [3, 7] }));
    [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]].forEach(([nm, e]) => {
      const O = pr([0, 0, 0]), A1 = pr(e), A2 = pr(e.map((v) => v * 1.32)), A3 = pr(e.map((v) => v * 1.45));
      line(c, [O, A1], { w: 1.6, color: P.soft, alpha: 0.5 * appear, dash: [5, 7] }); line(c, [A1, A2], { w: 2.4, color: P.soft, alpha: (A1[2] >= 0 ? 0.9 : 0.45) * appear });
      text(c, [mi(nm)], A3[0], A3[1], { size: 44, color: P.soft, align: "center", alpha: appear });
    });
    const nrm = Math.hypot(1, 1, 0.3), p0 = [1 / nrm, -1 / nrm, 0.3 / nrm], seq = [["y", -1], ["x", -1], ["y", 1], ["x", 1]];
    let q = p0; const legs = seq.map(([ax, sg]) => { const pts = []; for (let i = 0; i <= 48; i++) pts.push(Lie.apply(Lie.rot(ax, (sg * eps * i) / 48), q)); q = pts[48]; return pts; });
    const legT = (i) => [L(1) + D(1) * (0.16 + 0.205 * i), L(1) + D(1) * (0.16 + 0.205 * i) + D(1) * 0.17];
    const tags = ["①", "②", "③", "④"], names = ["绕 y 轴退一步", "绕 x 轴退一步", "绕 y 轴进一步", "绕 x 轴进一步"];
    let cur = null;
    legs.forEach((pts, i) => {
      const [a, b] = legT(i), f = E(u, a, b); if (f <= 0) return;
      const sub = pts.slice(0, 1 + Math.round(48 * f));
      draw3(sub, (r) => stroke(c, r, { w: 6, color: P.ink, taper: [0, 0] }), (r) => line(c, r, { w: 3.5, color: P.ink, alpha: 0.35, dash: [6, 7] }));
      if (sub.length > 6) { const pa = pr(sub[sub.length - 4]), pb = pr(sub[sub.length - 1]); head(c, pb[0], pb[1], Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), { size: 18, color: P.ink }); cur = pb; }
      if (f >= 1) { const m = pr(pts[24]), dx = m[0] - cx, dy = m[1] - cy, dl = Math.hypot(dx, dy) || 1; text(c, [zh(tags[i])], m[0] + (dx / dl) * 30, m[1] + (dy / dl) * 30, { size: 36, color: P.soft, align: "center" }); }
    });
    // 右侧图例：四步依次亮起，括号公式出现时让位
    const la = E(u, L(1), L(1) + 0.5) * (1 - E(u, L(3) - 0.2, L(3) + 0.3));
    names.forEach((nm, i) => { const on = u >= legT(i)[0]; text(c, [zh(`${tags[i]}  ${nm}`)], 1220, 330 + i * 68, { size: 38, color: on ? P.ink : P.pale, alpha: la }); });
    const P0 = pr(p0); dot(c, P0[0], P0[1], 10, { color: P.ink, alpha: appear });
    text(c, [mi("p"), rm("0", { s: "sub" })], P0[0] - 22, P0[1] - 26, { size: 44, color: P.ink, align: "right", alpha: appear });
    const ga = E(u, L(2) + 0.25 * D(2), L(2) + 0.45 * D(2));
    if (u >= legT(3)[1]) {
      const P4 = pr(legs[3][48]), pz = pr(Lie.apply(Lie.rot("z", eps * eps), p0));
      line(c, [P0, P4], { w: 3.4, color: P.red, dash: [8, 6], alpha: Math.max(0.4, ga) });
      dot(c, P4[0], P4[1], 10, { color: P.red });
      ring(c, pz[0], pz[1], 20, { color: P.red, w: 3.4, alpha: ga });
      text(c, [zh("≈ 绕 "), mi("z"), zh(" 转 "), mi("ε"), rm("2", { s: "sup" })], pz[0] + 34, pz[1] + 46, { size: 40, color: P.red, alpha: ga });
    } else if (cur) dot(c, cur[0], cur[1], 9, { color: P.ink });
  };

  // 覆：三联图
  function turntable(c, cx, cy, s, thDeg, al) {
    const rx = s * 0.36, ry = rx * 0.36, th = thDeg * D2R, cy2 = cy + s * 0.06;
    const ell = (f = 1, dy = 0, a0 = 0, a1 = TAU) => Array.from({ length: 121 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 120; return [cx + rx * f * Math.cos(a), cy2 + dy - ry * f * Math.sin(a)]; });
    line(c, [[cx, cy2 - s * 0.4], [cx, cy2 + s * 0.28]], { w: 2, color: P.pale, dash: [7, 7], alpha: al });
    line(c, ell(1, 9, PI, TAU), { w: 2, color: P.pale, alpha: al });
    c.save(); c.globalAlpha = al; c.fillStyle = "rgba(27,28,26,0.07)"; c.beginPath(); ell().forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.fill(); c.restore();
    stroke(c, ell(), { w: 4.5, color: P.ink, alpha: 0.85 * al, taper: [0, 0], cap: false });
    const mark = (a, color, alpha, tip) => { const pts = []; for (let i = 0; i <= 20; i++) { const r = 0.08 + 0.78 * (i / 20); pts.push([cx + rx * r * Math.cos(a), cy2 - ry * r * Math.sin(a)]); } stroke(c, pts, { w: s * 0.045, w1: s * 0.016, color, alpha, taper: [0.15, 0.3] }); if (tip) dot(c, pts[20][0], pts[20][1], s * 0.022, { color: P.red, alpha }); };
    mark(0, P.pale, 0.5 * al, false); mark(th, P.ink, 0.92 * al, true);
    const arc = ell(0.42, -s * 0.3, -0.3 * PI, 1.25 * PI); line(c, arc, { w: 2.6, color: P.red, alpha: 0.85 * al }); endHead(c, arc, { size: 14, color: P.red, alpha: al });
  }
  function so3ball(c, cx, cy, s, th, al) {
    const r = s * 0.33;
    ball(c, cx, cy, r, { alpha: al, w: 4 });
    line(c, [[cx, cy - r], [cx, cy + r]], { w: 1.6, color: P.pale, dash: [2, 7], alpha: al });
    text(c, [rm("+"), mi("z")], cx, cy - r - 54, { size: 30, color: P.soft, align: "center", alpha: al });
    text(c, [mi("I")], cx - 16, cy + 22, { size: 32, color: P.soft, align: "right", alpha: al });
    const Yf = (f) => cy - f * r;
    for (let k = 0; k < 2; k++) {
      const ox = k === 0 ? -6 : 6, done = th - 360 * k; if (done <= 0) break;
      const up = Math.min(done, 180) / 180;
      stroke(c, [[cx + ox, Yf(0)], [cx + ox, Yf(up)]], { w: 5, color: P.ink, taper: [0, 0], alpha: al });
      if (up > 0.15) head(c, cx + ox, Yf(up * 0.6), -PI / 2, { size: 15, color: P.ink, alpha: al });
      if (done >= 180) {
        const rr = r + 18 + 12 * k, side = k === 0 ? 1 : -1;
        const arc = Array.from({ length: 61 }, (_, i) => { const a = -PI / 2 + (PI * i) / 60; return [cx + side * rr * Math.cos(a), cy + rr * Math.sin(a)]; });
        line(c, arc, { w: 2.6, color: P.red, dash: [7, 7], alpha: al }); endHead(c, arc, { size: 14, color: P.red, alpha: al });
        const back = Math.min(done - 180, 180) / 180;
        if (back > 0) { stroke(c, [[cx + ox, Yf(-1)], [cx + ox, Yf(-1 + back)]], { w: 5, color: P.ink, taper: [0, 0], alpha: al }); if (back > 0.15) head(c, cx + ox, Yf(-1 + back * 0.6), -PI / 2, { size: 15, color: P.ink, alpha: al }); }
      }
    }
    const psi = ((th % 360) + 360) % 360, f = psi <= 180 ? psi / 180 : -(360 - psi) / 180, ox = th > 360 ? 6 : -6;
    dot(c, cx + ox, Yf(f), 10, { color: P.ink, alpha: al }); ring(c, cx + ox, Yf(f), 17, { color: P.red, w: 3, alpha: al });
  }
  function su2circle(c, cx, cy, s, th, al, hi) {
    const r = s * 0.32, half = (th * D2R) / 2;
    line(c, [[cx - r * 1.25, cy], [cx + r * 1.25, cy]], { w: 1.6, color: P.pale, alpha: 0.6 * al });
    stroke(c, circlePts(cx, cy, r, 220, 0.4, 0.4 + TAU * 0.99), { w: 3.4, color: P.ink, alpha: 0.7 * al, taper: [0.03, 0.08] });
    if (half > 0.01) { const n = Math.max(6, Math.round(half * 50)); stroke(c, Array.from({ length: n + 1 }, (_, i) => { const a = (-half * i) / n; return [cx + r * 0.85 * Math.cos(a), cy - r * 0.85 * Math.sin(a)]; }), { w: 6, color: P.red, alpha: 0.8 * al, taper: [0.02, 0.1] }); }
    dot(c, cx + r, cy, 6, { color: P.ink, bleed: false, alpha: al }); dot(c, cx - r, cy, 6, { color: P.ink, bleed: false, alpha: al });
    text(c, [rm("+1")], cx + r + 14, cy - 30, { size: 30, color: P.soft, alpha: al });
    text(c, [rm("−1")], cx - r - 14, cy - 30, { size: 30, color: P.soft, align: "right", alpha: al });
    const z = [cx + r * Math.cos(-half), cy - r * Math.sin(-half)];
    dot(c, z[0], z[1], 12, { color: P.red, alpha: al });
    if (hi > 0) { ring(c, cx - r, cy, 26 + 6 * Math.sin(hi * 12), { color: P.red, w: 3.4, alpha: al * Math.min(1, hi * 3) }); text(c, [rm("−"), mi("I")], cx - r, cy + 60, { size: 48, color: P.red, align: "center", alpha: al * Math.min(1, hi * 3) }); }
  }
  scenes.fu = (c, u, S) => {
    const { L, D } = S;
    let th = 0;
    if (u >= L(1)) th = 360 * E(u, L(1) + 0.3, L(1) + D(1));
    if (u >= L(3)) th = 360 + 360 * E(u, L(3) + 0.3, L(3) + 0.8 * D(3));
    th = Math.round(th * 10) / 10;
    const cy = 470, sz = 440, xs = [380, 960, 1540];
    const al = xs.map((_, i) => E(u, 0.3 + 0.45 * i, 0.9 + 0.45 * i));
    xs.forEach((x, i) => {
      c.save(); c.globalAlpha = al[i]; c.fillStyle = "rgba(27,28,26,0.045)"; c.strokeStyle = P.line; c.lineWidth = 2;
      c.beginPath(); c.roundRect(x - sz / 2, cy - sz / 2, sz, sz, [6, 22, 8, 24]); c.fill(); c.stroke(); c.restore();
    });
    turntable(c, xs[0], cy, sz, th, al[0]);
    so3ball(c, xs[1], cy, sz, th, al[1]);
    const hi = u >= L(2) && u < L(3) + 0.3 ? u - L(2) : 0;
    su2circle(c, xs[2], cy, sz, th, al[2], hi);
    text(c, [zh("转盘")], xs[0], cy + sz / 2 + 44, { size: 36, color: P.ink, align: "center", alpha: al[0] });
    text(c, [mi("SO"), rm("(3)"), zh(" 里的转动")], xs[1], cy + sz / 2 + 44, { size: 36, color: P.ink, align: "center", alpha: al[1] });
    text(c, [mi("SU"), rm("(2)"), zh(" 里的相位")], xs[2], cy + sz / 2 + 44, { size: 36, color: P.ink, align: "center", alpha: al[2] });
    text(c, [mi("θ"), rm(` = ${Math.round(th)}°`)], 960, 205, { size: 50, color: P.soft, align: "center", alpha: E(u, L(1) - 0.3, L(1) + 0.2) });
    const back = u >= L(2) && u < L(3) + 0.5 ? E(u, L(2), L(2) + 0.5) : 0;
    text(c, [zh("回到原样")], xs[0], cy - sz / 2 + 44, { size: 32, color: P.red, align: "center", alpha: back });
    text(c, [zh("回到 "), mi("I")], xs[1], cy - sz / 2 + 44, { size: 32, color: P.red, align: "center", alpha: back });
    const two = E(u, L(3) + 0.8 * D(3), L(3) + 0.8 * D(3) + 0.5);
    if (two > 0) text(c, [zh("转两圈，三处都回到起点")], 960, 262, { size: 34, color: P.red, align: "center", alpha: two * (1 - E(u, L(4), L(4) + 0.4)) });
  };

  scenes.end = (c, u, S) => {
    const { L, D } = S;
    const out = 1 - E(u, L(1) - 0.2, L(1) + 0.8);
    if (out > 0) {
      enso(c, 640, 560, 235, { alpha: out * E(u, 0, 0.8) });
      const rows = [["切", "单位元处的切线", "李代数"], ["卷", "指数映射", "卷回群里"], ["括", "李括号", "转动不能交换"]];
      rows.forEach(([s, a, b], i) => {
        const ra = out * E(u, L(0) + D(0) * [0.05, 0.38, 0.7][i], L(0) + D(0) * [0.05, 0.38, 0.7][i] + 0.6), y = 360 + i * 150;
        sealBox(c, s, 1210, y, 74, ra);
        text(c, [zh(a)], 1275, y - 22, { size: 40, color: P.ink, alpha: ra });
        text(c, [zh("→ " + b)], 1275, y + 28, { size: 34, color: P.red, alpha: ra });
      });
    }
  };

  /* ── 公式与文字叠层（KaTeX 渲染好，按时间淡入淡出） ── */
  const FX = [];
  const fxBox = document.getElementById("fxs");
  function fx(scene, { tex, html, x, y, size = 46, cls = "", from, until = null }) {
    const el = document.createElement("div"); el.className = "fx " + cls; el.style.left = x + "px"; el.style.top = y + "px"; el.style.fontSize = size + "px";
    if (tex) katex.render(tex, el, { displayMode: false, throwOnError: true }); else el.innerHTML = html;
    fxBox.appendChild(el); FX.push({ scene, el, from, until });
  }
  fx("lian", { tex: String.raw`R(\theta)=\begin{pmatrix}\cos\theta&-\sin\theta\\ \sin\theta&\cos\theta\end{pmatrix}`, x: 1230, y: 300, from: (S) => S.L(4) + 0.5 });
  fx("lian", { tex: String.raw`R(\alpha)\,R(\beta)=R(\alpha+\beta)`, x: 1230, y: 470, size: 42, from: (S) => S.L(4) + 1.4 });
  fx("lian", { html: "群 + 光滑流形 = 李群", x: 1230, y: 560, size: 40, cls: "cap", from: (S) => S.L(4) + 2.4 });
  fx("qie", { tex: String.raw`\mathfrak g=T_eG`, x: 1250, y: 270, size: 56, cls: "red", from: (S) => S.L(2) + 1.0 });
  fx("qie", { html: "李代数：单位元处的切空间", x: 1250, y: 360, size: 36, cls: "cap", from: (S) => S.L(2) + 1.6 });
  fx("qie", { tex: String.raw`J=\frac{dR}{d\theta}\Big|_{\theta=0}=\begin{pmatrix}0&-1\\1&0\end{pmatrix}`, x: 1250, y: 440, size: 44, from: (S) => S.L(3) + 0.3 });
  fx("juan", { tex: String.raw`\exp(X)=I+X+\frac{X^2}{2!}+\frac{X^3}{3!}+\cdots`, x: 1190, y: 300, size: 42, from: (S) => S.L(1) + 0.3, until: (S) => S.L(4) + 0.3 });
  fx("juan", { tex: String.raw`e^{i\theta}=\cos\theta+i\sin\theta`, x: 1190, y: 450, size: 46, cls: "red", from: (S) => S.L(3) + 0.6, until: (S) => S.L(4) + 0.3 });
  fx("juan", { tex: String.raw`\exp(\theta J)=R(\theta)`, x: 1190, y: 545, size: 44, from: (S) => S.L(3) + 1.3, until: (S) => S.L(4) + 0.3 });
  fx("juan", { tex: String.raw`\det\exp X=e^{\operatorname{tr}X}`, x: 1260, y: 330, size: 52, from: (S) => S.L(5) + 0.3 });
  fx("juan", { html: "tr <i>X</i> = 0  ⟹  面积不变", x: 1260, y: 440, size: 38, cls: "cap", from: (S) => S.L(5) + 1.0 });
  fx("kuo", { tex: String.raw`e^{\varepsilon X}e^{\varepsilon Y}e^{-\varepsilon X}e^{-\varepsilon Y}=I+\varepsilon^2[X,Y]+O(\varepsilon^3)`, x: 1140, y: 300, size: 34, from: (S) => S.L(3) + 0.2 });
  fx("kuo", { tex: String.raw`[L_x,L_y]=L_z`, x: 1140, y: 420, size: 60, cls: "red", from: (S) => S.L(3) + 1.6 });
  fx("kuo", { tex: String.raw`[\hat J_x,\hat J_y]=i\hbar\,\hat J_z`, x: 1140, y: 590, size: 52, from: (S) => S.L(4) + 0.3 });
  fx("kuo", { html: "角动量对易关系（<i>Ĵ</i> = <i>iħL</i>）", x: 1140, y: 690, size: 34, cls: "cap", from: (S) => S.L(4) + 1.0 });
  fx("fu", { tex: String.raw`U_z(2\pi)=\begin{pmatrix}e^{-i\pi}&0\\0&e^{i\pi}\end{pmatrix}=-I`, x: 960, y: 780, size: 40, cls: "c", from: (S) => S.L(4) + 0.2 });
  fx("fu", { html: "中子干涉实验：Rauch 等，Werner 等（1975）", x: 960, y: 900, size: 28, cls: "c cap", from: (S) => S.L(4) + 1.2 });
  fx("open", { html: "连珠成圆，以切知圆", x: 960, y: 760, size: 92, cls: "c big", from: () => 0.8 });
  fx("open", { html: "三分钟看懂李群", x: 960, y: 890, size: 36, cls: "c cap", from: () => 1.6 });
  fx("end", { html: "连珠成圆，以切知圆", x: 960, y: 330, size: 104, cls: "c big", from: (S) => S.L(1) + 0.4 });
  fx("end", { html: "互动图解：uugyfgyb.github.io/Lie-Group-Graph", x: 960, y: 520, size: 40, cls: "c red", from: (S) => S.L(1) + 1.6 });
  fx("end", { html: "李群图解 · Lie Group Graph", x: 960, y: 600, size: 30, cls: "c cap", from: (S) => S.L(1) + 2.2 });

  /* ── 每一场的时间：L(i) 第 i 句开始、D(i) 时长（相对本场起点） ── */
  const SC = TL.scenes.map((s, si) => {
    const ls = TL.lines.filter((l) => l.scene === si);
    return { ...s, dur: s.end - s.start, L: (i) => ls[i].start - s.start, D: (i) => ls[i].end - ls[i].start, lines: ls };
  });
  const titleEl = document.getElementById("title"), subEl = document.getElementById("sub");
  let lastSub = null, lastTitle = null;

  window.renderAt = (t) => {
    let si = SC.findIndex((s) => t >= s.start && t < s.end); if (si < 0) si = t < 0 ? 0 : SC.length - 1;
    const S = SC[si], u = t - S.start;
    const fadeIn = si === 0 ? ramp(u, 0, 0.6) : ramp(u, 0, 0.55), fadeOut = si === SC.length - 1 ? ramp(S.dur - u, 0, 1.2) : ramp(S.dur - u, 0, 0.55);
    const a = Math.min(fadeIn, fadeOut);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none"; ctx.setLineDash([]);
    ctx.drawImage(paper, 0, 0);
    ctx.save(); ctx.globalAlpha = a; scenes[S.id](ctx, u, S); ctx.restore();
    // 文字层：canvas 上的 globalAlpha 在 save/restore 里，DOM 叠层另算
    if (lastTitle !== si) { titleEl.querySelector(".seal").textContent = S.seal; titleEl.querySelector("h1").textContent = S.title; lastTitle = si; }
    titleEl.style.opacity = S.seal ? String(a * E(u, 0.1, 0.7)) : "0";
    for (const f of FX) {
      if (f.scene !== S.id) { f.el.style.opacity = "0"; continue; }
      const t0 = f.from(S), t1 = f.until ? f.until(S) : Infinity;
      f.el.style.opacity = String(a * E(u, t0, t0 + 0.6) * (isFinite(t1) ? 1 - E(u, t1 - 0.4, t1) : 1));
    }
    const ln = TL.lines.find((l) => t >= l.start - 0.15 && t < l.end + 0.35);
    if (ln) { if (lastSub !== ln) { subEl.textContent = ln.sub; lastSub = ln; } subEl.style.opacity = String(Math.min(ramp(t, ln.start - 0.15, ln.start + 0.1), ramp(ln.end + 0.35 - t, 0, 0.25))); }
    else subEl.style.opacity = "0";
    return si;
  };
  window.renderReady = Promise.all(["40px KaTeX_Main", "italic 40px KaTeX_Math", "40px KaTeX_Fraktur", `40px ${P.brush}`].map((f) => document.fonts.load(f, "李群eG")))
    .then(() => document.fonts.ready).then(() => { window.renderAt(0); return true; });
})();
