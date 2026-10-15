/* app.js — 卷首与七幅图（六幅可互动）：卷首（线图与根图）、so(5) 的吉文斯转动、直和的两个圆盘、H₂ 的八个扇区、
   可编辑的反相容图与 Hasse 图、H₂ 的测量线路、ψ(α) 一族态的方差与抽样、论文表 I / 表 II。
   依赖 presets.js（Presets）、frag.js（Frag）、ink.js（Ink）。 */
(() => {
  "use strict";
  const { $, $$, clamp, view, stroke, line, dot, ring, head, rich, mi, rm, zh, wash, fmt, minus, slider, chips, player } = Ink;
  const F = Frag, PR = Presets;
  const DEG = 180 / Math.PI;
  const SUBD = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (k) => String(k).split("").map((c) => SUBD[+c] ?? c).join("");
  const rngOf = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const seg = (A, B, n = 14) => Array.from({ length: n + 1 }, (_, k) => [A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]);
  const bend = (A, B, k = 0.12, n = 18) => { const mx = (A[0] + B[0]) / 2 - (B[1] - A[1]) * k, my = (A[1] + B[1]) / 2 + (B[0] - A[0]) * k; return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * A[0] + 2 * u * t * mx + t * t * B[0], u * u * A[1] + 2 * u * t * my + t * t * B[1]]; }); };
  const opTxt = (op, n) => (op.s < 0 ? "−" : "") + F.str(op.p, n);
  const disc = (ctx, x, y, r, color) => { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.restore(); };
  const ptr = (canvas, ev) => { const b = canvas.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; };
  const fitBox = (w, h, bw, bh, pad) => { const s = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh), ox = (w - bw * s) / 2, oy = (h - bh * s) / 2; return { s, X: (x) => ox + x * s, Y: (y) => oy + y * s }; };
  const sgn = (x) => (x > 0 ? "+" : "−");
  const par = (t) => (t.startsWith("−") ? "(" + t + ")" : t);

  /* ════════ 卷首：五个泡利项的反相容图（论文图 2a）与它的根图 ════════ */
  (function hero() {
    const c = $("#hero"); if (!c) return;
    view(c, (ctx, w, h, pal) => {
      const u = Math.min(w, h), fs = Math.max(12, u * 0.034);
      wash(ctx, w * 0.3, h * 0.3, u * 0.36, { alpha: 0.9 });
      wash(ctx, w * 0.66, h * 0.7, u * 0.42, { alpha: 0.9 });
      // 线图：五边形 0 在上，1 在右，2、3 在下，4 在左；边 01 04 14 12 23 34
      const cx = w * 0.29, cy = h * 0.29, R = u * 0.19;
      const L = [[0, -1], [0.951, -0.309], [0.588, 0.809], [-0.588, 0.809], [-0.951, -0.309]].map(([a, b]) => [cx + a * R, cy + b * R]);
      for (const [a, b] of [[0, 1], [0, 4], [1, 4], [1, 2], [2, 3], [3, 4]]) line(ctx, [L[a], L[b]], { w: 1.3, color: pal.soft });
      const off = [[0, -1], [1, -0.2], [0.8, 0.7], [-0.8, 0.7], [-1, -0.2]];
      L.forEach((p, i) => { dot(ctx, p[0], p[1], u * 0.021); rich(ctx, [rm(String(i))], p[0] + off[i][0] * u * 0.05, p[1] + off[i][1] * u * 0.05, { size: fs, align: "center", color: pal.ink }); });
      rich(ctx, [zh("泡利项与反对易")], cx, cy + R * 1.42, { size: fs * 0.82, align: "center", color: pal.pale });
      // 根图：团 {0,1,4}、{1,2}、{2,3}、{3,4} 与点 0 的空团；第 k 笔连着点 k 所属的两个团
      const rx = w * 0.64, ry = h * 0.7, S = u * 0.15;
      const N = { "014": [rx - S * 0.75, ry - S * 0.55], "12": [rx + S * 0.95, ry - S * 0.75], "23": [rx + S * 1.15, ry + S * 0.75], "34": [rx - S * 0.2, ry + S * 1.0], "0": [rx - S * 2.05, ry - S * 0.05] };
      const RE = [["0", "014", 0], ["014", "12", 1], ["12", "23", 2], ["23", "34", 3], ["34", "014", 4]];
      RE.forEach(([a, b, k], i) => {
        const pts = bend(N[a], N[b], 0.06 * (i % 2 ? 1 : -1));
        stroke(ctx, pts, { w: u * 0.018, color: pal.ink, bleed: 2, seed: 11 + i, taper: [0.1, 0.18] });
        const m = pts[9];
        rich(ctx, [rm(String(k))], m[0], m[1] - u * 0.036, { size: fs, align: "center", color: pal.ink });
      });
      for (const p of Object.values(N)) { disc(ctx, p[0], p[1], u * 0.024, pal.paper); ring(ctx, p[0], p[1], u * 0.024, { color: pal.red, w: 2 }); rich(ctx, [mi("γ")], p[0], p[1] + 1, { size: fs * 0.9, align: "center", color: pal.red, halo: false }); }
      rich(ctx, [zh("根图：一项一笔")], rx + S * 0.2, ry + S * 1.62, { size: fs * 0.82, align: "center", color: pal.pale });
      // 朱色虚线：从线图指向根图
      const arc = bend([cx + R * 1.25, cy + R * 0.2], [rx + S * 0.2, ry - S * 1.35], -0.25, 24);
      line(ctx, arc, { w: 1.4, color: pal.red, dash: [5, 5] });
      const a1 = arc[arc.length - 1], a2 = arc[arc.length - 3];
      head(ctx, a1[0], a1[1], Math.atan2(a1[1] - a2[1], a1[0] - a2[0]), { size: 10, color: pal.red });
      rich(ctx, [zh("一项一笔")], arc[12][0] + u * 0.06, arc[12][1] - u * 0.02, { size: fs * 0.95, color: pal.red });
    });
  })();

  /* ════════ 代：so(5) 的吉文斯转动 ════════ */
  (function so5() {
    const c = $("#so5"); if (!c) return;
    const As = ["XI", "YI", "ZX", "ZY"].map(F.parse), ops = F.soGenerators(As), N = 5;
    const pairs = []; for (let u = 0; u < N; u++) for (let v = u + 1; v < N; v++) pairs.push([u, v]);
    const symE = (u, v) => F.isSym(ops[u][v].p);
    let kind = "real", seed = 4, h0, nf, steps, exact, pred, maxAbs, Emax, t = 0;
    const panel = $("#so5-panel");
    const offNorm = (h) => Math.sqrt(pairs.filter(([u, v]) => !((u === 0 && v === 1) || (u === 2 && v === 3))).reduce((s, [u, v]) => s + h[u][v] ** 2, 0));
    const hAt = (tt) => { let h = h0; for (let k = 0; k < steps.length; k++) { const f = clamp(tt - k, 0, 1); if (f <= 0) break; h = F.rotateH(h, steps[k].i, steps[k].j, steps[k].phi * f); } return h; };
    function gen() {
      const r = rngOf(seed * 7919 + { star: 1, real: 2, all: 3 }[kind]);
      const val = () => (r() < 0.5 ? -1 : 1) * (0.3 + 0.7 * r());
      h0 = Array.from({ length: N }, () => new Array(N).fill(0));
      for (const [u, v] of pairs) if (kind === "all" || (kind === "star" && u === 0) || (kind === "real" && symE(u, v))) { h0[u][v] = val(); h0[v][u] = -h0[u][v]; }
      nf = F.normalForm(h0); steps = F.givens(nf.Q).filter((s) => Math.abs(s.phi) > 1e-9);
      exact = F.eigHerm(F.hamFromH(h0, ops, 2)).values;
      const [e1, e2] = nf.eps; pred = [e1 + e2, e1 - e2, -e1 + e2, -e1 - e2].sort((a, b) => a - b);
      maxAbs = Math.max(...h0.flat().map(Math.abs)); Emax = Math.max(...pred.map(Math.abs)) * 1.15 || 1;
    }
    gen();
    const V = view(c, (ctx, w, h, pal) => {
      const K = steps.length, H = hAt(t), k = Math.min(K - 1, Math.floor(t)), act = t > 0 && t < K ? steps[k] : null;
      const narrow = w < 520, gx = w * (narrow ? 0.4 : 0.37), gy = h * 0.53, R = Math.min(w * (narrow ? 0.3 : 0.26), h * 0.37);
      const P5 = [...Array(5)].map((_, q) => { const a = ((-90 + 72 * q) * Math.PI) / 180; return [gx + R * Math.cos(a), gy + R * Math.sin(a)]; });
      wash(ctx, gx, gy, R * 1.55, { alpha: 0.75 });
      const fs = narrow ? 10.5 : 12;
      for (const [u, v] of pairs) {
        const A = P5[u], B = P5[v], wv = Math.abs(H[u][v]) / maxAbs, on = act && act.i === u && act.j === v, col = on ? pal.red : pal.ink;
        if (wv < 2e-3) line(ctx, [A, B], { w: on ? 1.6 : 0.8, color: on ? pal.red : pal.pale, alpha: on ? 1 : 0.55, dash: [2, 5] });
        else if (symE(u, v)) stroke(ctx, seg(A, B), { w: 1.2 + 9 * wv, color: col, taper: [0.05, 0.05], seed: u * 5 + v, alpha: 0.92 });
        else line(ctx, [A, B], { w: 1 + 7 * wv, color: col, dash: [7, 5], alpha: 0.85 });
      }
      for (const [u, v] of pairs) {
        const A = P5[u], B = P5[v], on = act && act.i === u && act.j === v, m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        rich(ctx, [rm(opTxt(ops[u][v], 2))], m[0], m[1], { size: fs, align: "center", color: on ? pal.red : Math.abs(H[u][v]) / maxAbs < 2e-3 ? pal.pale : pal.soft });
      }
      P5.forEach((p, q) => {
        disc(ctx, p[0], p[1], 13, pal.paper); ring(ctx, p[0], p[1], 13, { color: pal.red, w: 1.8 });
        rich(ctx, [mi("γ"), rm(String(q), { s: "sub" })], p[0], p[1] + 1, { size: 14, align: "center", color: pal.ink, halo: false });
      });
      // 谱：右侧竖轴
      const ax = w * (narrow ? 0.86 : 0.83), y0 = h * 0.12, y1 = h * 0.9, Y = (e) => y1 - ((e + Emax) / (2 * Emax)) * (y1 - y0);
      line(ctx, [[ax, y0], [ax, y1]], { w: 1.2, color: pal.ink });
      line(ctx, [[ax - 5, Y(0)], [ax + 5, Y(0)]], { w: 1, color: pal.ink });
      rich(ctx, [rm("0")], ax - 9, Y(0), { size: 11, align: "right", color: pal.pale });
      rich(ctx, [zh("本征值")], ax, y0 - 14, { size: 12.5, align: "center", color: pal.soft });
      const seen = [];
      exact.forEach((e) => { const yy = Y(e); dot(ctx, ax, yy, 4.2, { color: pal.ink }); });
      pred.forEach((e) => ring(ctx, ax, Y(e), 8, { color: pal.red, w: 1.5 }));
      exact.forEach((e) => { if (seen.some((s) => Math.abs(s - e) < 1e-6)) return; seen.push(e); const mult = exact.filter((x) => Math.abs(x - e) < 1e-6).length; rich(ctx, [rm(fmt(e, 3) + (mult > 1 ? " ×" + mult : ""))], ax + 13, Y(e), { size: 11.5, color: pal.soft }); });
    });
    const out = $("#so5-t-o");
    function upd() {
      const K = steps.length, done = Math.min(K, Math.floor(t + 1e-9)), st = t < K ? steps[Math.min(K - 1, Math.floor(t))] : null, [e1, e2] = nf.eps;
      out.textContent = `${fmt(t, 1)} / ${K} 步`;
      let s = `<div class="p-big"><b>${done}/${K}</b><span>已完成的吉文斯转动；一般的 SO(5) 元素至多要 10 步，10 = dim so(5)</span></div><dl class="kv">`;
      if (st && t > 0) s += `<dt>这一步</dt><dd>γ${sub(st.i)}–γ${sub(st.j)} 平面里转 φ = ${fmt(st.phi * DEG, 1)}°</dd><dt>门</dt><dd>exp(−i·φ/2·${par(opTxt(ops[st.i][st.j], 2))})</dd>`;
      else s += `<dt>状态</dt><dd>${t >= K ? "转完了" : "还没转：拖动进度或按“转”"}</dd>`;
      s += `<dt>ε₁，ε₂</dt><dd>${fmt(e1, 4)}，${fmt(e2, 4)}</dd><dt>精确对角化</dt><dd>${exact.map((x) => fmt(x, 4)).join("，")}</dd><dt>±ε₁ ± ε₂</dt><dd>${pred.map((x) => fmt(x, 4)).join("，")}</dd><dt>离标准形</dt><dd>${fmt(offNorm(hAt(t)), 4)}</dd></dl>`;
      if (t >= K) s += `<p class="ok">剩下 ${fmt(e1, 3)}·XI − ${fmt(e2, 3)}·XX：两项对易。两个比特各做一次阿达马门，变成 ZI 与 ZZ，直接在计算基里读数。</p>`;
      else if (kind === "star") s += `<p>AC：所有边共用 γ₀，根图是一颗星。ε₂ = 0，本征值只有 ±|c| 两个，各两重。</p>`;
      else if (kind === "real") s += `<p>只用实对称项时，实线连成二部图 {γ₀, γ₂, γ₄}–{γ₁, γ₃}，没有三角形：实对称的 Ĥ 里凑不出一个完整的 so(3)。</p>`;
      else s += `<p>十个生成元都在。转动不改变谱，右侧竖轴上的点不会动。</p>`;
      panel.innerHTML = s;
    }
    const tS = slider("so5-t", (v) => { t = (v / 1000) * steps.length; upd(); V.redraw(); });
    const setT = (tt) => { t = tt; tS.el.value = String(Math.round((t / Math.max(1, steps.length)) * 1000)); upd(); V.redraw(); };
    const play = player($("#so5-play"), (dt) => { const K = steps.length; setT(Math.min(K, t + dt * 1.25)); return t < K; }, { onStart: () => { if (t >= steps.length) setT(0); } });
    const fresh = () => { play.stop(); gen(); setT(0); };
    kind = chips($("#so5-kind"), (k) => { kind = k; fresh(); }) || kind;
    $("#so5-new").addEventListener("click", () => { seed++; fresh(); });
    fresh();
  })();

  /* ════════ 和：两块 so(3) 的直和 ════════ */
  (function dials() {
    const c = $("#dials"); if (!c) return;
    const B = [{ P: "XX", Q: "ZI" }, { P: "ZZ", Q: "IX" }].map((b) => { const P = F.parse(b.P), Q = F.parse(b.Q); return { ...b, p: P, q: Q, O: F.soGenerators([P, Q])[1][2] }; });
    const init = [[0.56, 0.62], [-0.44, 0.52]];
    let vec = init.map((v) => v.slice()), orig = null, phase = -1, s = 0, from = null;
    const panel = $("#he-panel");
    const geom = (w, h) => { const tall = h > w * 0.8; return tall ? [0, 1].map((k) => ({ cx: w / 2, cy: h * (0.26 + 0.49 * k), R: Math.min(w * 0.3, h * 0.17) })) : [0, 1].map((k) => ({ cx: w * (0.27 + 0.46 * k), cy: h * 0.53, R: Math.min(w * 0.19, h * 0.36) })); };
    const V = view(c, (ctx, w, h, pal) => {
      geom(w, h).forEach((g, k) => {
        const b = B[k], [a, q] = vec[k], r = Math.hypot(a, q), R = g.R;
        wash(ctx, g.cx, g.cy, R * 1.5, { alpha: 0.8 });
        ring(ctx, g.cx, g.cy, R, { color: pal.line, w: 1 });
        if (r > 1e-3) ring(ctx, g.cx, g.cy, r * R, { color: pal.pale, w: 1, dash: [3, 4] });
        line(ctx, [[g.cx - R * 1.12, g.cy], [g.cx + R * 1.12, g.cy]], { w: 1, color: pal.soft });
        line(ctx, [[g.cx, g.cy + R * 1.12], [g.cx, g.cy - R * 1.12]], { w: 1, color: pal.soft });
        rich(ctx, [rm(b.P)], g.cx + R * 1.16, g.cy, { size: 13, color: pal.soft });
        rich(ctx, [rm(b.Q)], g.cx, g.cy - R * 1.2, { size: 13, align: "center", color: pal.soft });
        rich(ctx, [zh(`第 ${k + 1} 块`)], g.cx - R * 1.1, g.cy - R * 1.12, { size: 13, color: pal.ink });
        const tip = [g.cx + a * R, g.cy - q * R], ang = Math.atan2(q, a);
        if (r > 1e-3) {
          const arcPts = Array.from({ length: 25 }, (_, i) => { const th = (ang * i) / 24; return [g.cx + Math.cos(th) * R * 0.32, g.cy - Math.sin(th) * R * 0.32]; });
          if (Math.abs(ang) > 0.02) line(ctx, arcPts, { w: 1.2, color: pal.red });
          stroke(ctx, seg([g.cx, g.cy], tip), { w: 4.5, color: pal.ink, taper: [0.02, 0.3], seed: 3 + k });
          head(ctx, tip[0], tip[1], Math.atan2(tip[1] - g.cy, tip[0] - g.cx), { size: 11, color: pal.ink });
          if (Math.abs(ang) > 0.05) rich(ctx, [mi("φ"), rm(String(k + 1), { s: "sub" })], g.cx + Math.cos(ang / 2) * R * 0.45, g.cy - Math.sin(ang / 2) * R * 0.45, { size: 13, align: "center", color: pal.red });
        }
        dot(ctx, tip[0], tip[1], 6.5, { color: pal.red });
        rich(ctx, [mi("r"), rm(String(k + 1), { s: "sub" }), rm(" = " + fmt(r, 3))], g.cx - R * 1.1, g.cy - R * 1.12 + 19, { size: 12.5, color: pal.soft });
      });
    });
    function upd() {
      const r = vec.map(([a, q]) => Math.hypot(a, q)), phi = vec.map(([a, q]) => Math.atan2(q, a));
      const H = F.sumMat([{ p: B[0].p, c: vec[0][0] }, { p: B[0].q, c: vec[0][1] }, { p: B[1].p, c: vec[1][0] }, { p: B[1].q, c: vec[1][1] }], 2);
      const ev = F.eigHerm(H).values, pr = [r[0] + r[1], r[0] - r[1], -r[0] + r[1], -r[0] - r[1]].sort((x, y) => x - y);
      const U1 = F.pauliExp(B[0].O, phi[0], 2), U2 = F.pauliExp(B[1].O, phi[1], 2), cm = F.fro(F.axpy(F.cmul(U1, U2), -1, F.cmul(U2, U1)));
      let s = `<div class="p-big"><b>${fmt(r[0], 2)} ⊕ ${fmt(r[1], 2)}</b><span>两块各自的长度 r₁、r₂：转动只改方向，不改长度</span></div><dl class="kv">`;
      s += `<dt>第 1 块的门</dt><dd>U₁ = exp(−i·φ₁/2·${par(opTxt(B[0].O, 2))})，φ₁ = ${fmt(phi[0] * DEG, 1)}°</dd>`;
      s += `<dt>第 2 块的门</dt><dd>U₂ = exp(−i·φ₂/2·${par(opTxt(B[1].O, 2))})，φ₂ = ${fmt(phi[1] * DEG, 1)}°</dd>`;
      s += `<dt>‖U₁U₂ − U₂U₁‖</dt><dd>${cm < 1e-12 ? "0（对易）" : cm.toExponential(1)}</dd>`;
      s += `<dt>精确对角化</dt><dd>${ev.map((x) => fmt(x, 4)).join("，")}</dd><dt>±r₁ ± r₂</dt><dd>${pr.map((x) => fmt(x, 4)).join("，")}</dd></dl>`;
      const flat = phi.every((p) => Math.abs(p) < 1e-6);
      s += flat ? `<p class="ok">两块都转到横轴上了：剩 ${fmt(r[0], 3)}·XX + ${fmt(r[1], 3)}·ZZ，做贝尔测量（CNOT 加阿达马门）一次读出。</p>` : `<p>拖动朱点改系数，或按“转”。转第 1 块时，第 2 块的向量不动：U₁ 与第 2 块的两项都对易。</p>`;
      panel.innerHTML = s;
    }
    let drag = -1;
    c.addEventListener("pointerdown", (ev) => {
      const [x, y] = ptr(c, ev), G = geom(c.clientWidth, c.clientHeight);
      let best = -1, bd = Infinity;
      G.forEach((g, k) => { const d = Math.hypot(x - g.cx, y - g.cy); if (d < g.R * 1.25 && d < bd) { bd = d; best = k; } });
      if (best < 0) return;
      anim.stop(); drag = best; c.setPointerCapture(ev.pointerId); move(ev); ev.preventDefault();
    });
    const move = (ev) => {
      if (drag < 0) return;
      const [x, y] = ptr(c, ev), g = geom(c.clientWidth, c.clientHeight)[drag];
      let a = (x - g.cx) / g.R, q = -(y - g.cy) / g.R; const r = Math.hypot(a, q); if (r > 1) { a /= r; q /= r; }
      vec[drag] = [a, q]; orig = null; upd(); V.redraw();
    };
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", () => (drag = -1));
    c.addEventListener("pointercancel", () => (drag = -1));
    const anim = player($("#he-play"), (dt) => {
      if (phase < 0) return false;
      s = Math.min(1, s + dt / 1.1);
      const [a, q] = from[phase], r = Math.hypot(a, q), ph = Math.atan2(q, a) * (1 - s);
      vec[phase] = [r * Math.cos(ph), r * Math.sin(ph)];
      upd(); V.redraw();
      if (s >= 1) { phase++; s = 0; if (phase > 1) { phase = -1; return false; } }
      return true;
    }, { onStart: () => { if (!orig) orig = vec.map((v) => v.slice()); from = vec.map((v) => v.slice()); phase = 0; s = 0; } });
    $("#he-reset").addEventListener("click", () => { anim.stop(); phase = -1; vec = (orig || init).map((v) => v.slice()); orig = null; upd(); V.redraw(); });
    upd();
  })();

  /* ════════ 称：H₂ 的八个扇区 ════════ */
  const H2 = (() => {
    const sch = F.h2Scheme(), gs = F.groundState(sch.M);
    const gIdx = sch.sectors.findIndex((s) => Math.abs(s.Em - gs.E) < 1e-9);
    const occOf = new Map(); for (let o = 0; o < 16; o++) occOf.set(F.bkOfOcc(o), o);
    return { sch, gs, gIdx, occOf };
  })();
  const ket = (b) => "|" + [0, 1, 2, 3].map((q) => (b >> q) & 1).join("") + "⟩";
  const occStr = (o) => {
    const g = (o & 1 ? "↑" : "") + (o & 2 ? "↓" : ""), u = (o & 4 ? "↑" : "") + (o & 8 ? "↓" : "");
    const parts = []; if (g) parts.push("σg" + g); if (u) parts.push("σu" + u);
    return parts.join(" ") || "空";
  };
  const vTxt = (v) => "(" + v.map(sgn).join(", ") + ")";
  (function sectors() {
    const c = $("#sectors"); if (!c) return;
    const { sch, gIdx, occOf, gs } = H2, S = sch.sectors, rMax = Math.max(...S.map((s) => s.r));
    let sel = gIdx;
    const panel = $("#cheng-panel");
    const layout = (w, h) => { const cols = w / h > 1.25 ? 4 : 2, rows = 8 / cols, cw = w / cols, ch = h / rows; return S.map((_, i) => ({ x: (i % cols) * cw, y: Math.floor(i / cols) * ch, cw, ch })); };
    const V = view(c, (ctx, w, h, pal) => {
      layout(w, h).forEach((L, i) => {
        const s = S[i], g = i === gIdx, R = Math.min(L.cw, L.ch) * 0.28, cx = L.x + L.cw / 2, cy = L.y + L.ch * 0.4;
        if (i === sel) { ctx.save(); ctx.fillStyle = pal.wash; ctx.fillRect(L.x + 3, L.y + 3, L.cw - 6, L.ch - 6); ctx.restore(); line(ctx, [[L.x + 6, L.y + L.ch - 5], [L.x + L.cw - 6, L.y + L.ch - 5]], { w: 2, color: g ? pal.red : pal.ink }); }
        ring(ctx, cx, cy, R, { color: pal.line, w: 1 });
        line(ctx, [[cx - R, cy], [cx + R, cy]], { w: 0.8, color: pal.pale }); line(ctx, [[cx, cy - R], [cx, cy + R]], { w: 0.8, color: pal.pale });
        const tip = [cx + (s.p[0] / rMax) * R, cy - (s.p[1] / rMax) * R], col = g ? pal.red : pal.ink;
        if (s.r > 1e-9) { stroke(ctx, seg([cx, cy], tip, 10), { w: 3.6, color: col, taper: [0.02, 0.3], seed: i }); head(ctx, tip[0], tip[1], Math.atan2(tip[1] - cy, tip[0] - cx), { size: 8, color: col }); }
        else dot(ctx, cx, cy, 3, { color: col });
        const fs = Math.max(10.5, Math.min(13, L.cw / 9));
        rich(ctx, [rm(vTxt(s.v))], cx, L.y + L.ch * 0.76, { size: fs, align: "center", color: g ? pal.red : pal.ink });
        rich(ctx, [rm(fmt(s.Em, 3) + " / " + fmt(s.Ep, 3))], cx, L.y + L.ch * 0.9, { size: fs * 0.92, align: "center", color: pal.soft });
      });
    });
    function upd() {
      const s = S[sel], [z1, z3, z02] = s.v, th = Math.atan2(z1 * s.p[1], s.p[0]) * DEG;
      const meaning = `${z3 > 0 ? "N 为偶数" : "N 为奇数"}；${z02 > 0 ? "N<sub>α</sub> 为偶数" : "N<sub>α</sub> 为奇数"}；${z1 > 0 ? "σg 上的电子数为偶数" : "σg 上的电子数为奇数"}`;
      const basis = s.basis.map((b) => `${ket(b)} ↔ ${occStr(occOf.get(b))}`).join("<br>");
      let h = `<div class="p-big"><b>${vTxt(s.v)}</b><span>扇区 v = (z₁, z₃, z₀₂)，即 Ẑ₁、Ẑ₃、Ẑ₀Ẑ₂ 的本征值</span></div><dl class="kv">`;
      h += `<dt>含义</dt><dd>${meaning}</dd><dt>两个基态矢</dt><dd><span class="sm">BK 比特 ↔ 轨道占据</span><br>${basis}</dd>`;
      h += `<dt>p₀，p₁，p₂</dt><dd>${fmt(s.p0, 5)}，${fmt(s.p[0], 5)}，${fmt(s.p[1], 5)}</dd><dt>能级 p₀ ∓ r</dt><dd>${fmt(s.Em, 5)}，${fmt(s.Ep, 5)} 哈特里</dd>`;
      h += `<dt>转角 θ</dt><dd>${s.r < 1e-12 ? "不用转" : fmt(th, 2) + "°"}</dd></dl>`;
      if (sel === gIdx) h += `<p class="ok">基态在这里：E₀ = ${fmt(gs.E, 5)} 哈特里，比 HF 的 ${fmt(sch.mo.Ehf, 5)} 低 ${fmt((sch.mo.Ehf - gs.E) * 1000, 1)} 毫哈特里（关联能）。二维空间由 σg² 与 σu² 张成，转角 θ 就是全组态相互作用的混合角的两倍。</p>`;
      else if (s.r < 1e-12) h += `<p>p₁ = p₂ = 0：这个扇区里 Ĥ 只是常数 ${fmt(s.p0, 5)}，两个态简并。</p>`;
      else if (Math.abs(s.p[1]) < 1e-12) h += `<p>p₂ = 0：Ĥ 在这里已经是 p₀ + p₁Ẑ₀，不用转，直接测。</p>`;
      panel.innerHTML = h;
    }
    const pick = (i) => { sel = (i + 8) % 8; upd(); V.redraw(); };
    c.addEventListener("click", (ev) => { const [x, y] = ptr(c, ev); const L = layout(c.clientWidth, c.clientHeight); const i = L.findIndex((l) => x >= l.x && x < l.x + l.cw && y >= l.y && y < l.y + l.ch); if (i >= 0) pick(i); });
    c.addEventListener("keydown", (ev) => { const cols = c.clientWidth / c.clientHeight > 1.25 ? 4 : 2; const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[ev.key]; if (d) { pick(sel + d); ev.preventDefault(); } });
    upd();
  })();

  /* ════════ 图：可编辑的反相容图、Hasse 图、根图 ════════ */
  (function classifier() {
    const c = $("#graph"), hc = $("#hasse"), rc = $("#root"); if (!c) return;
    let pr, A, sel = -1, mode = "g", tq = 0, info, rootLay = null;
    const note = $("#tu-note"), text = $("#tu-text");
    const findClaw = (G, vs) => { for (const x of vs) { const nb = vs.filter((v) => G[x][v]); for (let a = 0; a < nb.length; a++) for (let b = a + 1; b < nb.length; b++) for (let d = b + 1; d < nb.length; d++) if (!G[nb[a]][nb[b]] && !G[nb[a]][nb[d]] && !G[nb[b]][nb[d]]) return [x, nb[a], nb[b], nb[d]]; } return null; };
    function analyze() {
      const n = A.length, vs = [...Array(n).keys()];
      const cls = F.classify(A, vs), comps = F.components(A, vs), { iso, classes, Q } = F.symReduce(A, vs), qv = [...Q.keys()];
      const lineG = n > 0 && comps.every((cc) => F.isLine(A, cc) === true);
      const lineQ = qv.length > 0 && F.components(Q, qv).every((cc) => F.isLine(Q, cc) === true);
      const cname = classes.map((_, i) => "C" + sub(i + 1));
      let root = null;
      if (lineG) { const R = F.rootGraph(A, vs); root = { from: "G", nodes: R.nodes.map((nd) => ({ empty: nd.empty, label: nd.members.map((v) => pr.labels[v]).join(pr.labels.every((l) => l.length === 1) ? "" : ",") })), edges: R.edges.map((e) => ({ ends: e.ends, label: pr.labels[e.v] })) }; }
      else if (lineQ) { const R = F.rootGraph(Q, qv); root = { from: "Q", nodes: R.nodes.map((nd) => ({ empty: nd.empty, label: nd.members.map((i) => cname[i]).join("") })), edges: R.edges.map((e) => ({ ends: e.ends, label: cname[e.v] })) }; }
      const claw = lineG ? null : findClaw(A, vs);
      const clawQ = !lineQ && qv.length ? findClaw(Q, qv) : null;
      info = { cls, comps, iso, classes, Q, cname, lineG, lineQ, root, claw, clawQ };
      rootLay = root ? forceLay(root.nodes.length, root.edges.map((e) => e.ends)) : null;
      // 收拢后的摆位：商图用力导向布局放在上方 400×230 的框里，孤立点排到底边
      const qE = []; for (let i = 0; i < qv.length; i++) for (let j = i + 1; j < qv.length; j++) if (Q[i][j]) qE.push([i, j]);
      const ql = qv.length > 1 ? forceLay(qv.length, qE) : qv.map(() => [0.5, 0.5]);
      info.qCenter = ql.map(([x, y]) => [70 + x * 260, 48 + y * 170]);
      info.isoRow = iso.map((v, k) => [200 + (k - (iso.length - 1) / 2) * Math.min(52, 360 / Math.max(1, iso.length)), 284]);
    }
    function forceLay(n, E) {
      const r = rngOf(n * 31 + E.length);
      const pos = Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [Math.cos(a) + 0.05 * r(), Math.sin(a) + 0.05 * r()]; });
      const k = 1.1 / Math.sqrt(n); let T = 0.12;
      for (let it = 0; it < 600; it++) {
        const d = pos.map(() => [0, 0]);
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1], dd = Math.max(1e-3, Math.hypot(dx, dy)), f = (k * k) / dd; d[i][0] += (dx / dd) * f; d[i][1] += (dy / dd) * f; d[j][0] -= (dx / dd) * f; d[j][1] -= (dy / dd) * f; }
        for (const [a, b] of E) { if (a === b) continue; const dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1], dd = Math.max(1e-3, Math.hypot(dx, dy)), f = (dd * dd) / k; d[a][0] -= (dx / dd) * f; d[a][1] -= (dy / dd) * f; d[b][0] += (dx / dd) * f; d[b][1] += (dy / dd) * f; }
        for (let i = 0; i < n; i++) { d[i][0] -= pos[i][0] * 0.08; d[i][1] -= pos[i][1] * 0.08; const m = Math.hypot(d[i][0], d[i][1]) || 1, s = Math.min(m, T) / m; pos[i][0] += d[i][0] * s; pos[i][1] += d[i][1] * s; }
        T *= 0.993;
      }
      const xs = pos.map((p) => p[0]), ys = pos.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      return pos.map(([x, y]) => [(x - x0) / (x1 - x0 || 1), (y - y0) / (y1 - y0 || 1)]);
    }
    // 收拢孪生类时，每个点的去处：所在类的中心附近的一个小圈；孤立点排到底边
    const targetPos = () => {
      const tp = pr.pos.map((p) => p.slice());
      info.classes.forEach((cl, i) => { const [cx, cy] = info.qCenter[i]; cl.forEach((v, j) => { if (cl.length === 1) { tp[v] = [cx, cy]; return; } const a = (2 * Math.PI * j) / cl.length - Math.PI / 2, rr = 10 + 3.5 * cl.length; tp[v] = [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; }); });
      info.iso.forEach((v, k) => (tp[v] = info.isoRow[k]));
      return tp;
    };
    const posNow = () => { const tp = targetPos(); return pr.pos.map((p, i) => [p[0] + (tp[i][0] - p[0]) * tq, p[1] + (tp[i][1] - p[1]) * tq]); };
    pr = PR.graphs.find((g) => g.id === "fig3"); A = F.graphFromEdges(pr.labels.length, pr.edges); analyze();
    const Vg = view(c, (ctx, w, h, pal) => {
      const n = A.length, fb = fitBox(w, h, 400, 300, n > 12 ? 30 : 34), P0 = posNow().map(([x, y]) => [fb.X(x), fb.Y(y)]);
      const isoSet = new Set(info.iso), clawSet = info.claw && tq < 0.5 ? info.claw : null;
      const big = pr.labels.some((l) => l.length > 2), fs = big ? (w < 480 ? 10 : 11.5) : 13, R = big ? 6 : Math.max(7, Math.min(11, w / 48));
      // 收拢时：类之间画粗笔（商图的边），类内的点围成一圈
      if (tq > 0) {
        const cents = info.classes.map((cl) => [cl.reduce((s, v) => s + P0[v][0], 0) / cl.length, cl.reduce((s, v) => s + P0[v][1], 0) / cl.length]);
        info.classes.forEach((cl, i) => { if (cl.length > 1) { const rr = Math.max(...cl.map((v) => Math.hypot(P0[v][0] - cents[i][0], P0[v][1] - cents[i][1]))) + R + 6; wash(ctx, cents[i][0], cents[i][1], rr * 1.6, { alpha: tq }); ring(ctx, cents[i][0], cents[i][1], rr, { color: pal.ink, w: 1.4, alpha: tq }); } });
        for (let i = 0; i < info.Q.length; i++) for (let j = i + 1; j < info.Q.length; j++) if (info.Q[i][j]) stroke(ctx, seg(cents[i], cents[j]), { w: 4.5, color: pal.ink, alpha: 0.85 * tq, taper: [0.05, 0.05], seed: i * 9 + j });
        info.classes.forEach((cl, i) => { const lab = info.cname[i], up = cents[i][1] - (cl.length > 1 ? Math.max(...cl.map((v) => Math.hypot(P0[v][0] - cents[i][0], P0[v][1] - cents[i][1]))) + R + 18 : R + 16); rich(ctx, [rm(lab)], cents[i][0], up, { size: 13, align: "center", color: pal.red, halo: true }); });
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (A[i][j]) {
        const onC = clawSet && clawSet[0] === i && clawSet.slice(1).includes(j) || clawSet && clawSet[0] === j && clawSet.slice(1).includes(i);
        line(ctx, [P0[i], P0[j]], { w: onC ? 2.6 : 1.3, color: onC ? pal.red : pal.soft, alpha: tq > 0 ? 1 - 0.8 * tq : 1 });
      }
      for (let i = 0; i < n; i++) {
        const [x, y] = P0[i], hollow = isoSet.has(i), on = clawSet && clawSet.includes(i);
        if (hollow) { disc(ctx, x, y, R, pal.paper); ring(ctx, x, y, R, { color: pal.ink, w: 1.5, alpha: tq > 0 ? 1 - 0.6 * tq : 1 }); } else dot(ctx, x, y, R, { color: on ? pal.red : pal.ink });
        if (i === sel) ring(ctx, x, y, R + 6, { color: pal.red, w: 2 });
        const lab = pr.labels[i];
        if (big) rich(ctx, [rm(lab)], x + (x > fb.X(300) ? -R - 4 : R + 4), y, { size: fs, align: x > fb.X(300) ? "right" : "left", color: pal.ink });
        else if (hollow) rich(ctx, [rm(lab)], x, y + 0.5, { size: fs * 0.85, align: "center", color: pal.ink, halo: false });
        else rich(ctx, [rm(lab)], x, y + 0.5, { size: fs * 0.85, align: "center", color: pal.paper, halo: false });
      }
    });
    const pos9 = { "TWC-FF": [0.2, 0.32], "TWC-AC": [0.08, 0.57], FF: [0.38, 0.57], AC: [0.22, 0.8], FC: [0.44, 0.97], "Sym-TWC-FF": [0.7, 0.1], "Sym-TWC-AC": [0.58, 0.35], "Sym-FF": [0.88, 0.35], NC: [0.72, 0.58] };
    const Vh = view(hc, (ctx, w, h, pal) => {
      const X = (x) => 40 + x * (w - 80), Y = (y) => 12 + y * (h - 40);
      rich(ctx, [zh("不带对称")], X(0.0), Y(0.16), { size: 11, color: pal.pale });
      rich(ctx, [zh("带对称（Sym）")], X(1), Y(0.0), { size: 11, align: "right", color: pal.pale });
      for (const [a, b] of PR.inclusions) line(ctx, [[X(pos9[a][0]), Y(pos9[a][1])], [X(pos9[b][0]), Y(pos9[b][1])]], { w: 1, color: pal.line });
      const fs = w < 300 ? 10 : 11.5;
      for (const k of F.CLASSES) {
        const [x, y] = [X(pos9[k][0]), Y(pos9[k][1])], on = info.cls[k];
        if (on) dot(ctx, x, y, 5.5, { color: pal.ink }); else { disc(ctx, x, y, 5, pal.paper); ring(ctx, x, y, 5, { color: pal.pale, w: 1.3 }); }
        rich(ctx, [rm(k)], x, y + 14, { size: fs, align: "center", color: on ? pal.ink : pal.pale });
      }
    });
    const Vr = view(rc, (ctx, w, h, pal) => {
      if (!info.root) {
        const msg = info.clawQ ? "商图里还有爪：不是线图，没有根图" : info.cls.FC ? "没有边：每项自成一块（FC）" : "不是线图，没有根图";
        rich(ctx, [zh(msg)], w / 2, h / 2, { size: 12.5, align: "center", color: pal.pale }); return;
      }
      const R = info.root, P = rootLay.map(([x, y]) => [22 + x * (w - 44), 20 + y * (h - 48)]), many = R.edges.length > 16;
      rich(ctx, [zh(R.from === "G" ? "根图（原图是线图）" : "商图的根图")], 8, h - 10, { size: 11, color: pal.pale });
      R.edges.forEach((e, i) => { const [a, b] = e.ends; stroke(ctx, seg(P[a], P[b], 10), { w: 3, color: pal.ink, taper: [0.08, 0.08], seed: i + 2 }); if (!many) rich(ctx, [rm(e.label)], (P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2, { size: 12, align: "center", color: pal.soft }); });
      R.nodes.forEach((nd, i) => { const [x, y] = P[i]; disc(ctx, x, y, nd.empty ? 4 : 6, pal.paper); ring(ctx, x, y, nd.empty ? 4 : 6, { color: pal.red, w: nd.empty ? 1.2 : 1.8 }); if (R.nodes.length <= 14 && nd.label.length <= 10) rich(ctx, [rm(nd.label)], x, y - 14, { size: nd.empty ? 11 : 12, align: "center", color: nd.empty ? pal.pale : pal.red }); });
    });
    function describe() {
      const I = info, n = A.length, m = F.edgesOf(A).length, yes = F.CLASSES.filter((k) => I.cls[k]);
      let s = `<div class="lines"><p>${n} 个点，${m} 条边，${I.comps.length} 个连通分量。</p>`;
      s += `<p>属于：${yes.length ? yes.map((k) => `<span class="tag on">${k}</span>`).join("") : "九类都不是"}</p>`;
      if (I.iso.length) s += `<p>孤立点（泡利对称）：${I.iso.map((v) => pr.labels[v]).join("、")}</p>`;
      const tw = I.classes.map((cl, i) => [cl, i]).filter(([cl]) => cl.length > 1);
      s += `<p>孪生类：${tw.length ? tw.map(([cl, i]) => `${I.cname[i]} = {${cl.map((v) => pr.labels[v]).join(", ")}}`).join("；") : "没有（每个非孤立点自成一类）"}</p>`;
      if (I.lineG) s += `<p>原图是线图：根图有 ${I.root.nodes.length} 个顶点（马约拉纳模）、${I.root.edges.length} 条边（泡利项）。</p>`;
      else if (I.claw) s += `<p>原图不是线图：含爪，中心 ${pr.labels[I.claw[0]]}，三片叶子 ${I.claw.slice(1).map((v) => pr.labels[v]).join("、")}（朱色）。</p>`;
      else s += `<p>原图不是线图（不含爪，但含 Beineke 的另一个禁用子图）。</p>`;
      if (!I.lineG && I.lineQ) s += `<p>收拢孪生类以后的商图是线图，所以属于带 Sym 的类。</p>`;
      else if (!I.lineG && I.clawQ) s += `<p>商图里仍有爪（中心 ${I.cname[I.clawQ[0]]}），带 Sym 的 FF 类也进不去。</p>`;
      text.innerHTML = s + "</div>";
    }
    const redrawAll = () => { Vg.redraw(); Vh.redraw(); Vr.redraw(); };
    const load = (id) => { pr = PR.graphs.find((g) => g.id === id); A = F.graphFromEdges(pr.labels.length, pr.edges); sel = -1; analyze(); describe(); note.textContent = pr.note; redrawAll(); };
    let raf = 0;
    const animate = (to) => { cancelAnimationFrame(raf); const t0 = performance.now(), from = tq; const stepF = (now) => { const f = Math.min(1, (now - t0) / 650); tq = from + (to - from) * (1 - (1 - f) ** 3); Vg.redraw(); if (f < 1) raf = requestAnimationFrame(stepF); }; if (matchMedia("(prefers-reduced-motion: reduce)").matches) { tq = to; Vg.redraw(); } else raf = requestAnimationFrame(stepF); };
    c.addEventListener("click", (ev) => {
      if (mode !== "g") return;
      const [x, y] = ptr(c, ev), fb = fitBox(c.clientWidth, c.clientHeight, 400, 300, A.length > 12 ? 30 : 34);
      let best = -1, bd = 22; pr.pos.forEach(([px, py], i) => { const d = Math.hypot(fb.X(px) - x, fb.Y(py) - y); if (d < bd) { bd = d; best = i; } });
      if (best < 0) { sel = -1; Vg.redraw(); return; }
      if (sel < 0) sel = best; else if (sel === best) sel = -1;
      else { const v = !A[sel][best]; A[sel][best] = A[best][sel] = v; sel = -1; analyze(); describe(); Vh.redraw(); Vr.redraw(); }
      Vg.redraw();
    });
    load(chips($("#tu-preset"), (k) => { load(k); if (mode === "q") animate(1); }) || "fig3");
    chips($("#tu-view"), (k) => { mode = k; sel = -1; animate(k === "q" ? 1 : 0); });
  })();

  /* ════════ 线：测量线路与扇区表 ════════ */
  (function circuit() {
    const c = $("#circuit"); if (!c) return;
    view(c, (ctx, w, h, pal) => {
      const narrow = w < 520, x0 = narrow ? 34 : 46, x1 = w - (narrow ? 14 : 26), ys = [0, 1, 2, 3].map((k) => h * (0.17 + 0.2 * k)), fs = narrow ? 11.5 : 13;
      const xc = x0 + (x1 - x0) * 0.13, xm = x0 + (x1 - x0) * 0.36, xr = x0 + (x1 - x0) * 0.62, xf = x0 + (x1 - x0) * 0.86;
      ys.forEach((y, k) => { rich(ctx, [mi("q"), rm(String(k), { s: "sub" })], x0 - 8, y, { size: fs + 1, align: "right", color: pal.ink }); line(ctx, [[x0, y], [k === 0 ? xf : xm, y]], { w: 1.2, color: pal.ink }); });
      // CNOT(0→2)
      line(ctx, [[xc, ys[0]], [xc, ys[2] + 9]], { w: 1.4, color: pal.ink }); dot(ctx, xc, ys[0], 4.5, { color: pal.ink, bleed: false }); ring(ctx, xc, ys[2], 9, { color: pal.ink, w: 1.4 }); line(ctx, [[xc - 9, ys[2]], [xc + 9, ys[2]]], { w: 1.4, color: pal.ink });
      rich(ctx, [mi("U"), rm("c", { s: "sub" })], xc, ys[0] - 18, { size: fs, align: "center", color: pal.soft });
      // 量具
      const meter = (x, y, lab) => {
        const bw = narrow ? 26 : 30, bh = narrow ? 20 : 22;
        ctx.save(); ctx.fillStyle = pal.paper; ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.3; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh); ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
        ctx.beginPath(); ctx.arc(x, y + bh * 0.28, bw * 0.3, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y + bh * 0.28); ctx.lineTo(x + bw * 0.22, y - bh * 0.28); ctx.stroke(); ctx.restore();
        if (lab) rich(ctx, lab, x, y - bh / 2 - 9, { size: fs - 1, align: "center", color: pal.soft });
        return bw / 2;
      };
      const half = meter(xm, ys[1], [mi("z"), rm("1", { s: "sub" })]); meter(xm, ys[2], [mi("z"), rm("02", { s: "sub" })]); meter(xm, ys[3], [mi("z"), rm("3", { s: "sub" })]);
      // 经典双线：三个结果汇到 R_y 门
      for (const k of [1, 2, 3]) { line(ctx, [[xm + half, ys[k] - 1.6], [xr - 1.6, ys[k] - 1.6]], { w: 1, color: pal.red }); line(ctx, [[xm + half, ys[k] + 1.6], [xr + 1.6, ys[k] + 1.6]], { w: 1, color: pal.red }); }
      line(ctx, [[xr - 1.6, ys[3] - 1.6], [xr - 1.6, ys[0] + 14]], { w: 1, color: pal.red }); line(ctx, [[xr + 1.6, ys[3] + 1.6], [xr + 1.6, ys[0] + 14]], { w: 1, color: pal.red });
      // R_y 门
      const gw = narrow ? 72 : 86, gh = narrow ? 24 : 28;
      ctx.save(); ctx.fillStyle = pal.paper; ctx.strokeStyle = pal.red; ctx.lineWidth = 1.6; ctx.fillRect(xr - gw / 2, ys[0] - gh / 2, gw, gh); ctx.strokeRect(xr - gw / 2, ys[0] - gh / 2, gw, gh); ctx.restore();
      rich(ctx, [mi("R"), mi("y", { s: "sub" }), rm("(−"), mi("θ"), mi("v", { s: "sub" }), rm(")")], xr, ys[0], { size: fs, align: "center", color: pal.red, halo: false });
      rich(ctx, [zh("李群转动")], xr, ys[0] - gh / 2 - 10, { size: fs - 1.5, align: "center", color: pal.red });
      meter(xf, ys[0], [mi("w")]);
      rich(ctx, [zh(narrow ? "测对称" : "中途测量：对称算符")], xm, ys[3] + (narrow ? 22 : 26), { size: fs - 1.5, align: "center", color: pal.soft });
      rich(ctx, [mi("E"), rm(" = "), mi("p"), rm("0", { s: "sub" }), rm("("), mi("v"), rm(") + "), mi("w"), rm("·"), mi("r"), rm("("), mi("v"), rm(")")], (xr + x1) / 2 + (narrow ? 0 : 10), ys[2], { size: fs + 1, align: "center", color: pal.ink });
    });
    const tb = $("#circ-table tbody"), { sch, gIdx } = H2;
    tb.innerHTML = sch.sectors.map((s, i) => { const x = s.v[0] * s.p[1], th = s.r < 1e-12 ? "—" : fmt(Math.atan2(x, s.p[0]) * DEG, 1) + "°"; return `<tr${i === gIdx ? ' class="on"' : ""}><td class="nw">${vTxt(s.v)}</td><td class="r">${fmt(s.p[0], 4)}</td><td class="r">${fmt(x, 4)}</td><td class="r">${th}</td><td class="r">${fmt(s.Em, 4)}</td><td class="r">${fmt(s.Ep, 4)}</td></tr>`; }).join("");
  })();

  /* ════════ 线：ψ(α) 一族态，三种拆法的方差指标与抽样 ════════ */
  (function shots() {
    const cc = $("#curves"), sc = $("#shots"); if (!cc) return;
    const { sch, gs } = H2, nz = sch.terms.filter((t) => !F.isId(t.p));
    const model = (frags) => frags.map((f) => { const M = F.sumMat(f, 4), d = 16, Ar = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (__, j) => M.re[i * d + j])); return F.eigSym(Ar); });
    const strat = [
      { name: "逐项", n: nz.length, eig: model(nz.map((t) => [t])) },
      { name: "FC", n: 2, eig: model(F.sortedInsertion(sch.terms, F.classTest("FC"))) },
      { name: "NC", n: 1, eig: model([nz]) },
    ];
    const c0 = sch.terms.filter((t) => F.isId(t.p)).reduce((s, t) => s + t.c, 0);
    const a0 = Math.atan2(gs.psi.re[4], gs.psi.re[1]) * DEG;
    const psiOf = (deg) => { const a = deg / DEG, v = new Array(16).fill(0); v[1] = Math.cos(a); v[4] = Math.sin(a); return v; };
    // 每一片：本征值与在 ψ 上的概率
    const dist = (e, psi) => e.values.map((val, k) => { const p = e.vectors[k].reduce((s, x, i) => s + x * psi[i], 0); return [val, p * p]; });
    const stats = (st, psi) => { let sq = 0, mean = c0; const parts = st.eig.map((e) => { const d = dist(e, psi), m = d.reduce((s, [v, p]) => s + v * p, 0), v2 = Math.max(0, d.reduce((s, [v, p]) => s + v * v * p, 0) - m * m); sq += Math.sqrt(v2); mean += m; return { d, m, v: v2 }; }); return { parts, metric: sq * sq, mean }; };
    const curve = []; for (let d = -45; d <= 45.001; d += 0.5) { const psi = psiOf(d); curve.push([d, ...strat.map((s) => stats(s, psi).metric)]); }
    const yMax = Math.ceil(Math.max(...curve.flatMap((r) => r.slice(1))) * 10 + 0.5) / 10;
    let alpha = a0, seedN = 1, sim = null;
    const SHOTS = 1000, RUNS = 200;
    function simulate() {
      const psi = psiOf(alpha), r = rngOf(9001 + seedN * 131 + Math.round(alpha * 10));
      sim = strat.map((st) => {
        const S = stats(st, psi), tot = S.parts.reduce((s, p) => s + Math.sqrt(p.v), 0);
        const m = S.parts.map((p) => (tot > 0 ? Math.max(1, Math.round((SHOTS * Math.sqrt(p.v)) / tot)) : 1));
        const cdf = S.parts.map((p) => { let acc = 0; return p.d.map(([v, pp]) => [v, (acc += pp)]); });
        const est = [];
        for (let run = 0; run < RUNS; run++) {
          let e = c0;
          S.parts.forEach((p, k) => { if (p.v === 0) { e += p.m; return; } let s = 0; const C = cdf[k], top = C[C.length - 1][1]; for (let i = 0; i < m[k]; i++) { const u = r() * top; let j = 0; while (j < C.length - 1 && C[j][1] < u) j++; s += C[j][0]; } e += s / m[k]; });
          est.push(e);
        }
        const mu = est.reduce((s, x) => s + x, 0) / RUNS, sd = Math.sqrt(est.reduce((s, x) => s + (x - mu) ** 2, 0) / (RUNS - 1));
        return { est, sd, metric: S.metric, mean: S.mean, sigma: Math.sqrt(S.metric / SHOTS), shots: m.reduce((s, x) => s + x, 0) };
      });
    }
    const Vc = view(cc, (ctx, w, h, pal) => {
      const L = w < 480 ? 40 : 50, Rr = 14, T = 16, Bm = 34, X = (d) => L + ((d + 45) / 90) * (w - L - Rr), Y = (v) => h - Bm - (v / yMax) * (h - Bm - T);
      line(ctx, [[L, T], [L, h - Bm], [w - Rr, h - Bm]], { w: 1, color: pal.ink });
      for (let d = -45; d <= 45; d += 15) { line(ctx, [[X(d), h - Bm], [X(d), h - Bm + 4]], { w: 1, color: pal.ink }); rich(ctx, [rm(minus(String(d)) + "°")], X(d), h - Bm + 15, { size: 11, align: "center", color: pal.soft }); }
      for (let v = 0; v <= yMax + 1e-9; v += 0.1) { line(ctx, [[L - 4, Y(v)], [L, Y(v)]], { w: 1, color: pal.ink }); if (v > 0) line(ctx, [[L, Y(v)], [w - Rr, Y(v)]], { w: 0.6, color: pal.line }); rich(ctx, [rm(fmt(v, 1))], L - 7, Y(v), { size: 11, align: "right", color: pal.soft }); }
      rich(ctx, [mi("ε"), rm("2", { s: "sup" }), mi("M")], L + 6, T + 2, { size: 13, color: pal.soft });
      const pts = (k) => curve.map((r) => [X(r[0]), Y(r[k])]);
      stroke(ctx, pts(2), { w: 5, color: pal.ink, alpha: 0.35, taper: [0, 0] });
      line(ctx, pts(1), { w: 1.6, color: pal.ink, dash: [6, 4] });
      line(ctx, pts(3), { w: 2.4, color: pal.red });
      const lx = w < 480 ? X(-42) : X(-40);
      rich(ctx, [zh("逐项 = FC")], lx, Y(curve[curve.length - 1][1]) - 14, { size: 12, color: pal.ink });
      rich(ctx, [zh("NC：整片")], X(20) + 6, Y(stats(strat[2], psiOf(20)).metric) + 16, { size: 12, color: pal.red });
      for (const [d, lab] of [[0, "HF"], [a0, "基态"]]) { line(ctx, [[X(d), h - Bm], [X(d), T + 18]], { w: 0.8, color: pal.pale, dash: [2, 3] }); rich(ctx, [zh(lab)], X(d), T + 8, { size: 11, align: "center", color: pal.soft }); }
      const now = [stats(strat[0], psiOf(alpha)).metric, stats(strat[2], psiOf(alpha)).metric];
      line(ctx, [[X(alpha), h - Bm], [X(alpha), Y(Math.max(...now)) - 8]], { w: 1.3, color: pal.red });
      dot(ctx, X(alpha), Y(now[0]), 4.5, { color: pal.ink }); dot(ctx, X(alpha), Y(now[1]), 4.5, { color: pal.red });
      rich(ctx, [mi("α")], w - Rr - 4, h - Bm - 10, { size: 13, align: "right", color: pal.soft });
    });
    const Vs = view(sc, (ctx, w, h, pal) => {
      if (!sim) return;
      const L = w < 480 ? 74 : 104, Rr = 16, T = 10, Bm = 30, rowH = (h - T - Bm) / 3;
      const E = sim[0].mean, half = Math.max(4 * Math.max(...sim.map((s) => s.sigma)), 0.002), X = (e) => L + ((e - E + half) / (2 * half)) * (w - L - Rr);
      line(ctx, [[L, h - Bm], [w - Rr, h - Bm]], { w: 1, color: pal.ink });
      const tick = half > 0.02 ? 0.01 : half > 0.008 ? 0.005 : 0.002;
      for (let e = Math.ceil((E - half) / tick) * tick; e <= E + half + 1e-12; e += tick) { line(ctx, [[X(e), h - Bm], [X(e), h - Bm + 4]], { w: 1, color: pal.ink }); rich(ctx, [rm(fmt(e, 3))], X(e), h - Bm + 15, { size: 10.5, align: "center", color: pal.soft }); }
      line(ctx, [[X(E), T], [X(E), h - Bm]], { w: 1.2, color: pal.red });
      const r = rngOf(77);
      sim.forEach((s, k) => {
        const y0 = T + rowH * k, yc = y0 + rowH / 2;
        rich(ctx, [zh(`${strat[k].name}（${strat[k].n} 片）`)], 6, yc, { size: w < 480 ? 11 : 12.5, color: k === 2 ? pal.red : pal.ink });
        if (k) line(ctx, [[L, y0], [w - Rr, y0]], { w: 0.5, color: pal.line });
        for (const e of s.est) { const x = clamp(X(e), L, w - Rr); dot(ctx, x, yc + (r() - 0.5) * rowH * 0.6, 2.1, { color: k === 2 ? pal.red : pal.ink, alpha: 0.55, bleed: false }); }
      });
    });
    const panel = $("#sh-panel");
    function upd() {
      const s = sim, psi = psiOf(alpha);
      let h = `<div class="p-big"><b>${fmt(s[0].mean, 5)}</b><span>⟨ψ(α)|Ĥ|ψ(α)⟩，哈特里；基态 ${fmt(gs.E, 5)}</span></div>`;
      h += `<div class="tbl-wrap"><table class="small"><thead><tr><th>拆法</th><th class="r">ε²M</th><th class="r">σ 理论</th><th class="r">σ 抽样</th></tr></thead><tbody>`;
      s.forEach((x, k) => { h += `<tr><td>${strat[k].name}</td><td class="r">${fmt(x.metric, 4)}</td><td class="r">${fmt(x.sigma * 1000, 2)}</td><td class="r">${fmt(x.sd * 1000, 2)}</td></tr>`; });
      h += `</tbody></table></div><p class="hint">σ 的单位是毫哈特里：每次实验共 ${SHOTS} 发，按 m<sub>α</sub> ∝ √Var<sub>α</sub> 分给各片，σ 理论 = √(ε²M / ${SHOTS})。化学精度约 1.6 毫哈特里。</p>`;
      if (Math.abs(alpha - a0) < 0.06) h += `<p class="ok">基态是 Ĥ 的本征态：NC 一片的方差为 0，每发都读出 ${fmt(gs.E, 5)}。</p>`;
      else if (Math.abs(alpha) < 0.06) h += `<p>HF 态是计算基态，方差全部来自 4 个 x、y 型项，三种拆法一样。</p>`;
      panel.innerHTML = h;
    }
    const out = $("#sh-a-o");
    let raf = 0;
    const refresh = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { simulate(); upd(); Vc.redraw(); Vs.redraw(); }); };
    const sl = slider("sh-a", (v) => { alpha = v / 10; out.textContent = fmt(alpha, 1) + "°"; refresh(); });
    $("#sh-ground").addEventListener("click", () => { sl.el.value = String(Math.round(a0 * 10)); alpha = a0; out.textContent = fmt(alpha, 1) + "°"; refresh(); });
    $("#sh-again").addEventListener("click", () => { seedN++; refresh(); });
    out.textContent = fmt(alpha, 1) + "°"; simulate(); upd(); Vc.redraw(); Vs.redraw();
  })();

  /* ════════ 果：论文表 I、表 II，H₂ 一行附本页重算 ════════ */
  (function bars() {
    const c = $("#bars"); if (!c) return;
    const { sch, gs } = H2, nz = sch.terms.filter((t) => !F.isId(t.p));
    const repro = { Pauli: { m: F.metric(nz.map((t) => [t]), 4, gs.psi).value } };
    for (const k of F.CLASSES) { const fr = F.sortedInsertion(sch.terms, F.classTest(k)); const big = fr.map((f) => [F.l1(f), f.length]).sort((a, b) => b[0] - a[0])[0]; repro[k] = { m: F.metric(fr, 4, gs.psi).value, l1: big[0], n: big[1] }; }
    repro.Pauli.l1 = F.l1(nz); repro.Pauli.n = nz.length;
    let mol = "LiH", tab = "I";
    const names = (k) => (k === "Pauli" ? (tab === "I" ? "逐项" : "Ĥe 全部") : k);
    const title = $("#bars-title"), panel = $("#guo-panel");
    const V = view(c, (ctx, w, h, pal) => {
      const M = PR.methods, vals = tab === "I" ? PR.tableI[mol] : PR.tableII[mol].map((x) => x[0]);
      const nzv = vals.filter((v) => v > 0), lo = 10 ** Math.floor(Math.log10(Math.min(...nzv)) - (tab === "I" && mol === "H2" ? 0 : 0)), hi = 10 ** Math.ceil(Math.log10(Math.max(...nzv)));
      const L = w < 480 ? 96 : 118, Rr = w < 480 ? 58 : 72, T = 10, Bm = 30, rowH = (h - T - Bm) / M.length;
      const X = (v) => L + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (w - L - Rr);
      for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e++) { const v = 10 ** e, x = X(v); line(ctx, [[x, T], [x, h - Bm]], { w: 0.6, color: pal.line }); rich(ctx, [rm(v >= 1 ? String(v) : v.toPrecision(1))], x, h - Bm + 15, { size: 11, align: "center", color: pal.soft }); }
      const cand = M.map((k, i) => [k, vals[i]]).slice(1);
      const best = tab === "I" ? Math.min(...cand.map((x) => x[1])) : Math.max(...cand.map((x) => x[1]));
      if (tab === "I") { const fx = X(vals[1]); line(ctx, [[fx, T], [fx, h - Bm]], { w: 1.2, color: pal.ink, dash: [4, 4] }); }
      M.forEach((k, i) => {
        const v = vals[i], y = T + rowH * (i + 0.5), isBest = i > 0 && v === best, col = isBest ? pal.red : pal.ink;
        rich(ctx, [rm(names(k))], L - 10, y, { size: w < 480 ? 11 : 12.5, align: "right", color: isBest ? pal.red : i === 0 ? pal.soft : pal.ink });
        if (v > 0) { stroke(ctx, seg([L, y], [X(v), y], 12), { w: Math.min(12, rowH * 0.5), color: col, alpha: i === 0 ? 0.45 : 0.9, taper: [0.02, 0.12], seed: i + 5 }); rich(ctx, [rm(tab === "I" ? PR.tableIText[mol][i] : PR.tableIIText[mol][i])], X(v) + 6, y, { size: 11.5, color: col }); }
        else rich(ctx, [rm("0")], L + 4, y, { size: 12, color: col });
        if (mol === "H2") { const rv = tab === "I" ? repro[k].m : repro[k].l1, x = rv > 1e-6 ? Math.max(L + 2, X(rv)) : L + 2; ring(ctx, x, y, Math.min(9, rowH * 0.4), { color: pal.red, w: 1.4 }); }
      });
    });
    function upd() {
      const m = PR.molecules.find((x) => x.id === mol), M = PR.methods, T1 = PR.tableI[mol], T2 = PR.tableII[mol];
      title.innerHTML = `<span class="ev">论文</span>${tab === "I" ? "表 I：方差指标 ε²M（对数刻度，越短越好；竖虚线是 FC）" : "表 II：排序插入得到的最大碎片的 L1 范数，括号里是项数（越长越大）"}${mol === "H2" ? "；朱圈是本页在浏览器里重算的值" : ""}`;
      const cls = M.slice(1).map((k) => [k, T1[M.indexOf(k)]]), mn = Math.min(...cls.map((x) => x[1])), best = cls.filter((x) => x[1] === mn).map((x) => x[0]);
      let s = `<div class="p-big"><b>${m.name}</b><span>${m.qubits} 个量子比特，${T2[0][1]} 个非常数泡利项（STO-3G，BK）</span></div><dl class="kv">`;
      const TX = PR.tableIText[mol];
      s += `<dt>ε²M 最小</dt><dd>${best.join("、")}：${TX[M.indexOf(best[0])]}</dd><dt>FC</dt><dd>${TX[1]}</dd><dt>逐项</dt><dd>${TX[0]}</dd>`;
      if (mn > 0) s += `<dt>比 FC 少</dt><dd>${fmt((1 - mn / T1[1]) * 100, 0)}%（测量次数之比 ${fmt(T1[1] / mn, 2)} 倍）</dd>`;
      s += `</dl>`;
      if (mol === "H2") {
        const ok = M.every((k, i) => Math.abs(repro[k].m - T1[i]) <= 0.0005 + 1e-12);
        s += `<p class="${ok ? "ok" : "no"}">本页重算的 ε²M：${M.map((k) => `${names(k)} ${fmt(repro[k].m, 3)}`).join("，")}。${ok ? "十个数与论文一致。" : ""}</p><p>NC 与三种 Sym 类都把整个 Ĥ 放进一片，基态是它的本征态，方差为 0。</p>`;
      } else if (mol === "H2O") s += `<p>只有 H₂O 是 Sym-TWC-AC 最好；Sym-TWC-FF 是更大的类，排序插入却给出 5.31。</p>`;
      else if (mol === "LiH") s += `<p>TWC-FF（0.870）在这里略好于 FC（0.882），是 TWC 两类唯一胜过 FC 的一格。</p>`;
      panel.innerHTML = s;
    }
    mol = chips($("#guo-mol"), (k) => { mol = k; upd(); V.redraw(); }) || mol;
    tab = chips($("#guo-tab"), (k) => { tab = k; upd(); V.redraw(); }) || tab;
    upd(); V.redraw();
  })();
})();
