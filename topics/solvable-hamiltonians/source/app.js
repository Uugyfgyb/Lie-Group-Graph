/* app.js — 卷首与七幅互动图。依赖 solv.js（Solv）和 ink.js（Ink），无其他依赖。 */
(() => {
  "use strict";
  const { $, $$, clamp, D, view, stroke, line, dot, ring, head, rich, mi, rm, zh, wash, fmt, slider, chips, player } = Ink;
  const S = Solv;
  const PI = Math.PI, TAU = 2 * PI;
  const circle = (cx, cy, r, n = 180, a0 = 0, a1 = TAU) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; });
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  const ball = (ctx, cx, cy, r, p, w = 2.4) => {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, p.wash);
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.restore();
    stroke(ctx, circle(cx, cy, r, 200, 0.6, 0.6 + TAU * 0.995), { w, w1: w * 0.7, color: p.ink, alpha: 0.85, taper: [0.03, 0.08] });
  };
  /* 泡利串 → HTML：XIZ → X₁Z₃ */
  const pstr = (s) => (/[XYZ]/.test(s) ? [...s].map((c, q) => (c === "I" ? "" : `<i>${c}</i><sub>${q + 1}</sub>`)).join("") : "1");
  const signed = (x, d = 2) => (x < 0 ? "−" : "+") + fmt(Math.abs(x), d);
  const vecTxt = (v, d = 2) => `(${v.map((x) => fmt(x, d)).join(", ")})`;
  const deg = (r) => fmt(r / D, 1) + "°";
  const SL = S.SLAB;

  /* ───────── 共用的数：三比特例子四个扇区的 [p₁, p₂, p₃, p₀]（例一与 verify.mjs 相同） ───────── */
  const PRESET = [[0.52, 0.47, 0.5, -0.2], [-0.18, -0.03, 0.4, 0], [0.48, -0.43, -0.7, 0.5], [-0.62, -0.33, 0.2, -0.1]];
  const store = {
    P: PRESET.map((r) => r.slice()), sel: 0, subs: new Set(),
    set(P) { this.P = P; this.subs.forEach((f) => f()); },
    on(f) { this.subs.add(f); },
  };

  /* ───────── 三维系数空间：正交投影、前后分段、拖箭头或转视角 ───────── */
  function coefSphere(cv, o) {
    const cam = { yaw: -38 * D, pitch: 19 * D };
    let geo = null, drag = null;
    const v = view(cv, (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w / 2, cy = h * 0.54, Rs = s * 0.33, fs = Math.max(13, s * 0.04);
      const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const V = [cp * cyw, cp * syw, sp], Er = [-syw, cyw, 0], Eu = [-sp * cyw, -sp * syw, cp];
      const pr = (q) => [cx + Rs * dot3(q, Er), cy - Rs * dot3(q, Eu), dot3(q, V)];
      const draw3 = (pts3, front, back) => {
        let run = [], fr = null;
        const flush = () => { if (run.length > 1) (fr ? front : back)(run); };
        for (const q of pts3) { const P = pr(q), f = P[2] >= 0; if (fr !== null && f !== fr) { flush(); run = [run[run.length - 1]]; } fr = f; run.push(P); }
        flush();
      };
      ball(ctx, cx, cy, Rs, p);
      const gc = (fn) => Array.from({ length: 121 }, (_, i) => fn((i / 120) * TAU));
      for (const g of [gc((a) => [Math.cos(a), Math.sin(a), 0]), gc((a) => [Math.cos(a), 0, Math.sin(a)]), gc((a) => [0, Math.cos(a), Math.sin(a)])])
        draw3(g, (r) => line(ctx, r, { w: 1, color: p.pale, alpha: 0.85 }), (r) => line(ctx, r, { w: 1, color: p.pale, alpha: 0.35, dash: [2, 4] }));
      // 坐标轴：A₃ 是嘉当方向，用朱色
      [[0, [1, 0, 0]], [1, [0, 1, 0]], [2, [0, 0, 1]]].forEach(([k, e]) => {
        const O = pr([0, 0, 0]), A1 = pr(e), A2 = pr(e.map((c) => c * 1.28)), col = k === 2 ? p.red : p.soft;
        line(ctx, [O, A1], { w: 1, color: col, alpha: k === 2 ? 0.75 : 0.5, dash: [3, 4] });
        line(ctx, [A1, A2], { w: k === 2 ? 2 : 1.4, color: col, alpha: A1[2] >= 0 ? 0.95 : 0.5 });
        const A3 = pr(e.map((c) => c * 1.42));
        rich(ctx, [mi("A"), ...(o.prime ? [rm("′", { s: "sup" })] : []), rm(String(k + 1), { s: "sub" })], A3[0], A3[1], { size: fs, color: col, align: "center" });
      });
      const top = pr([0, 0, 1.28]);
      rich(ctx, [zh("嘉当方向")], top[0] + fs * 0.7, top[1] + fs * 0.2, { size: fs * 0.78, color: p.red });
      // 箭
      const t = o.getT(), arrows = o.getArrows(), tips = [];
      arrows.forEach((a, i) => {
        const { th, a: amp } = S.givens(a.p), cur = S.rotCoef(a.p, th, t), col = a.red ? p.red : p.ink, al = a.alpha ?? 1;
        if (t > 0.002) {
          const trail = Array.from({ length: 81 }, (_, j) => pr(S.rotCoef(a.p, th, (t * j) / 80)));
          line(ctx, trail, { w: 1.4, color: p.red, alpha: 0.75 * al, dash: [4, 4] });
          const P0 = pr(a.p); dot(ctx, P0[0], P0[1], 2.6, { color: col, alpha: 0.5 * al, bleed: false });
        }
        const O = pr([0, 0, 0]), T = pr(cur), L = Math.hypot(T[0] - O[0], T[1] - O[1]), fr = T[2] >= -0.02 ? 1 : 0.55;
        if (L > 4) {
          const ang = Math.atan2(T[1] - O[1], T[0] - O[0]), hs = Math.min(13, L * 0.42);
          const B = [T[0] - Math.cos(ang) * hs * 0.75, T[1] - Math.sin(ang) * hs * 0.75];
          stroke(ctx, [O, [(O[0] + B[0]) / 2, (O[1] + B[1]) / 2], B], { w: a.red ? 3.4 : 2.8, w1: a.red ? 2.6 : 2.2, color: col, alpha: al * fr, taper: [0.04, 0], cap: false });
          head(ctx, T[0], T[1], ang, { size: hs, color: col, alpha: al * fr });
        } else dot(ctx, T[0], T[1], 4, { color: col, alpha: al });
        if (a.label) {
          // 转到同一根轴上以后，标签左右交替放，免得叠在一起
          const dx = T[0] - O[0], dy = T[1] - O[1], dl = Math.hypot(dx, dy) || 1, side = t > 1.9;
          rich(ctx, [zh(a.label)], side ? T[0] + (i % 2 ? 1.6 : -1.6) * fs : T[0] + (dx / dl) * fs * 0.95, side ? T[1] : T[1] + (dy / dl) * fs * 0.95, { size: fs * 0.88, color: col, align: "center" });
        }
        if (t >= 1.999 && amp > 0.01) { const Z = pr([0, 0, amp]); ring(ctx, Z[0], Z[1], 6.5, { color: col, w: 1.4, alpha: al }); }
        tips.push(T);
      });
      geo = { tips, Er, Eu, Rs };
      if (o.expose) window[o.expose] = tips.map((T) => [T[0], T[1]]); // 给浏览器自检用：箭头在画布里的位置
    });
    // 拖动：转动滑块在 0 时可以拖箭头，否则拖动只转视角
    const pick = (e) => {
      if (!geo || o.getT() > 0.001) return -1;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, tol = e.pointerType === "mouse" ? 20 : 30;
      let best = -1, bd = tol;
      geo.tips.forEach((T, i) => { const d = Math.hypot(T[0] - x, T[1] - y); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    cv.addEventListener("pointerdown", (e) => {
      const i = pick(e);
      drag = { x: e.clientX, y: e.clientY, i };
      cv.setPointerCapture(e.pointerId);
      if (i >= 0 && o.onPick) o.onPick(i);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) { cv.style.cursor = pick(e) >= 0 ? "move" : ""; return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      if (drag.i >= 0) {
        const a = o.getArrows()[drag.i].p, d = [0, 1, 2].map((k) => (dx / geo.Rs) * geo.Er[k] - (dy / geo.Rs) * geo.Eu[k]);
        let q = a.map((x, k) => x + d[k]); const L = len3(q);
        if (L > 1.3) q = q.map((x) => (x * 1.3) / L);
        if (L < 0.06) return;
        o.onDrag(drag.i, q);
      } else {
        cam.yaw -= dx * 0.01; if (e.pointerType === "mouse") cam.pitch = clamp(cam.pitch + dy * 0.01, -1.3, 1.3);
        v.redraw();
      }
    });
    const end = () => { drag = null; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key]; if (!k) return;
      e.preventDefault(); cam.yaw += k[0]; cam.pitch = clamp(cam.pitch + k[1], -1.3, 1.3); v.redraw();
    });
    return v;
  }

  /* ───────── 卷首：一笔圆相 = 系数空间；朱线 = 嘉当方向；四支箭各沿朱弧转上去 ───────── */
  (function hero() {
    const cv = $("#hero"); if (!cv) return;
    view(cv, (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w * 0.45, cy = h * 0.56, R = s * 0.33, fs = Math.max(13, s * 0.05);
      const at = (phi, r = R) => [cx + r * Math.cos(phi), cy - r * Math.sin(phi)];
      const pts = [], a0 = 104 * D, a1 = -178 * D;
      for (let i = 0; i <= 280; i++) { const t = i / 280, phi = a0 + (a1 - a0) * t; pts.push(at(phi, R * (1 + 0.012 * Math.sin(2.1 * phi + 0.5) - 0.012 * t))); }
      stroke(ctx, pts, { w: s * 0.05, w1: s * 0.02, color: p.ink, alpha: 0.9, taper: [0.03, 0.1], dry: 0.45, seed: 23, bleed: 2.5 });
      ctx.save(); ctx.globalCompositeOperation = "destination-over"; wash(ctx, cx - R * 0.1, cy + R * 0.12, R * 1.7); ctx.restore();
      // 嘉当方向
      stroke(ctx, [[cx, cy + 0.3 * R], [cx, cy - 1.36 * R]], { w: 2.6, color: p.red, taper: [0.15, 0.06] });
      rich(ctx, [mi("A"), mi("L", { s: "sub" })], cx + 10, cy - 1.3 * R, { size: fs, color: p.red });
      // 四支箭：角度与长短各不相同；朱弧把每支转到竖线上
      const arr = [[22, 0.92, "++"], [148, 0.62, "+−"], [218, 0.84, "−+"], [318, 0.7, "−−"]];
      arr.forEach(([a, l, lab], k) => {
        const phi = a * D, r = l * R, tip = at(phi, r);
        let d = 90 - a; while (d > 180) d -= 360; while (d < -180) d += 360;
        const arc = Array.from({ length: 50 }, (_, i) => at(phi + (d * D * i) / 49, r));
        line(ctx, arc, { w: 1.4, color: p.red, dash: [3, 4], alpha: 0.85 });
        const q = arc[arc.length - 1], q0 = arc[arc.length - 4];
        head(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), { size: 7, color: p.red });
        dot(ctx, q[0], q[1], 2.8, { color: p.red, bleed: false });
        const ang = Math.atan2(tip[1] - cy, tip[0] - cx), hs = 11;
        stroke(ctx, [[cx, cy], [(cx + tip[0]) / 2, (cy + tip[1]) / 2], [tip[0] - Math.cos(ang) * hs * 0.75, tip[1] - Math.sin(ang) * hs * 0.75]], { w: s * 0.012, w1: s * 0.008, color: p.ink, alpha: 0.92, taper: [0.05, 0], cap: false, seed: k + 3 });
        head(ctx, tip[0], tip[1], ang, { size: hs, color: p.ink });
        const lp = at(phi + 0.3, r * 0.78);
        rich(ctx, [rm(lab)], lp[0], lp[1], { size: fs * 0.8, color: p.soft, align: "center" });
      });
      dot(ctx, cx, cy, s * 0.012, { color: p.ink });
      // 朱印：可解
      const sw = s * 0.075, sx = w - sw - s * 0.05, sy = h - sw * 2 - s * 0.05;
      ctx.save(); ctx.translate(sx + sw / 2, sy + sw); ctx.rotate(-3 * D); ctx.fillStyle = p.red; ctx.globalAlpha = 0.88;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-sw / 2, -sw, sw, sw * 2, 3) : ctx.rect(-sw / 2, -sw, sw, sw * 2); ctx.fill();
      ctx.fillStyle = p.paper; ctx.globalAlpha = 1; ctx.font = `${sw * 0.78}px ${p.brush}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("可", 0, -sw * 0.48); ctx.fillText("解", 0, sw * 0.48); ctx.restore();
    });
  })();

  /* ───────── 旧：一支箭，按式 (20)(21) 两步转到 A₃ ───────── */
  (function jiu() {
    const cv = $("#jiu"); if (!cv) return;
    const st = { p: [0.62, 0.48, 0.35], t: 0 };
    const v = coefSphere(cv, {
      getT: () => st.t,
      getArrows: () => [{ p: st.p, red: false, label: "" }],
      onDrag: (i, q) => { st.p = q; v.redraw(); panel(); },
    });
    function panel() {
      const { th, a } = S.givens(st.p), cur = S.rotCoef(st.p, th, st.t);
      const stage = st.t <= 0.001 ? "拖动箭头改系数；把“转动”拉到 1，第一步在 (<i>A</i><sub>1</sub>, <i>A</i><sub>3</sub>) 平面里转 <i>θ</i><sub>1</sub>，<i>A</i><sub>1</sub> 的系数归零。"
        : st.t <= 1.001 ? "第一步：只动 <i>A</i><sub>1</sub> 和 <i>A</i><sub>3</sub> 两个系数，<i>A</i><sub>2</sub> 的系数不变。走完时 <i>p</i><sub>1</sub> = 0，<i>A</i><sub>3</sub> 的系数变成 √(<i>p</i><sub>1</sub>² + <i>p</i><sub>3</sub>²)。"
          : st.t < 1.999 ? "第二步：在 (<i>A</i><sub>2</sub>, <i>A</i><sub>3</sub>) 平面里转 <i>θ</i><sub>2</sub>，把 <i>A</i><sub>2</sub> 的系数也并进 <i>A</i><sub>3</sub>。"
            : "转到了嘉当方向：<i>U H U</i><sup>†</sup> = ‖<i>p</i>‖ <i>A</i><sub>3</sub>。本征值 ±‖<i>p</i>‖，本征态就是 <i>A</i><sub>3</sub> 的本征态转回去。";
      $("#jiu-panel").innerHTML = `
        <div class="p-big"><b>${fmt(a, 3)}</b><span>‖<i>p</i>‖：两个本征值是 ±${fmt(a, 3)}</span></div>
        <dl class="kv">
          <dt>系数 <i>p</i></dt><dd>${vecTxt(st.p)}</dd>
          <dt><i>θ</i><sub>1</sub> = atan2(<i>p</i><sub>1</sub>, <i>p</i><sub>3</sub>)</dt><dd>${deg(th[0])}</dd>
          <dt><i>θ</i><sub>2</sub></dt><dd>${deg(th[1])}</dd>
          <dt>现在的系数</dt><dd class="red">${vecTxt(cur)}</dd>
        </dl>
        <p class="${st.t >= 1.999 ? "ok" : ""}">${stage}</p>
        ${st.p[2] < 0 ? `<p class="no"><i>p</i><sub>3</sub> &lt; 0：<i>θ</i><sub>1</sub> 超过 90°。若用 arctan(<i>p</i><sub>1</sub>/<i>p</i><sub>3</sub>) 取另一个解，会转到 −‖<i>p</i>‖ <i>A</i><sub>3</sub>。</p>` : ""}`;
    }
    const sl = slider("jiu-t", (x, out) => { st.t = x; out.textContent = fmt(x, 2); v.redraw(); panel(); });
    sl.fire();
    player($("#jiu-play"), (dt) => { sl.set(Math.min(2, st.t + dt * 0.7)); return st.t < 2; }, { onStart: () => sl.set(0) });
    $("#jiu-flip").addEventListener("click", () => { st.p = [st.p[0], st.p[1], -st.p[2]]; v.redraw(); panel(); });
  })();

  /* ───────── 符：四个扇区四支箭 ───────── */
  (function fu() {
    const cv = $("#fu"); if (!cv) return;
    const st = { t: 0 };
    const v = coefSphere(cv, {
      prime: true, expose: "__fuTips",
      getT: () => st.t,
      getArrows: () => store.P.map((x, k) => ({ p: x.slice(0, 3), red: k === store.sel, alpha: k === store.sel ? 1 : 0.82, label: SL[k] })),
      onPick: (i) => selSector(i),
      onDrag: (i, q) => { const P = store.P.map((r) => r.slice()); P[i] = [...q, P[i][3]]; store.set(P); },
    });
    const lv = view($("#fu-lv"), (ctx, w, h, p) => {
      const P = store.P, rots = S.sectorRot(P), fs = Math.max(11, Math.min(w, h) * 0.07);
      const ymax = Math.max(1.2, ...P.map((x, k) => Math.abs(x[3]) + rots[k].a)) + 0.12;
      const top = h * 0.07, bot = h * 0.84, Y = (e) => top + ((ymax - e) / (2 * ymax)) * (bot - top), colW = w / 4;
      line(ctx, [[w * 0.03, Y(0)], [w * 0.97, Y(0)]], { w: 1, color: p.pale, dash: [3, 4] });
      rich(ctx, [rm("0")], w * 0.015, Y(0), { size: fs * 0.8, color: p.pale });
      P.forEach((x, k) => {
        const xc = colW * (k + 0.5), hw = colW * 0.28, on = k === store.sel, col = on ? p.red : p.ink;
        for (const sg of [1, -1]) {
          const e = x[3] + sg * rots[k].a;
          stroke(ctx, [[xc - hw, Y(e)], [xc + hw, Y(e)]], { w: on ? 3.2 : 2.6, color: col, taper: [0.08, 0.12] });
        }
        line(ctx, [[xc, Y(x[3] + rots[k].a)], [xc, Y(x[3] - rots[k].a)]], { w: 1, color: col, alpha: 0.45, dash: [2, 3] });
        rich(ctx, [rm(SL[k])], xc, h * 0.93, { size: fs, color: on ? p.red : p.soft, align: "center" });
      });
    });
    function selSector(k) { store.sel = k; $$("#fu-sec button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.k === k))); refresh(); }
    function refresh() { v.redraw(); lv.redraw(); panel(); }
    function panel() {
      const P = store.P, rots = S.sectorRot(P), k = store.sel;
      const poly = [0, 1, 2, 3].map((i) => S.toPoly(P.map((x) => x[i])));
      const nTerms = poly.flat().filter((c) => Math.abs(c) > 5e-4).length;
      const rows = P.map((x, j) => `<tr><td><span class="sect${j === k ? " on" : ""}">${SL[j]}</span></td><td class="r">${vecTxt(x.slice(0, 3))}</td><td class="r">${fmt(rots[j].a, 3)}</td><td class="r">${fmt(x[3] - rots[j].a, 2)}, ${fmt(x[3] + rots[j].a, 2)}</td></tr>`).join("");
      const prow = (i, name) => `<tr><td>${name}</td>${poly[i].map((c) => `<td class="r">${fmt(c, 3)}</td>`).join("")}</tr>`;
      $("#fu-panel").innerHTML = `
        <div class="p-big"><b>${fmt(rots[k].a, 3)}</b><span>扇区 ${SL[k]} 的 <i>a</i>(<i>v</i>) = ‖<i>p</i>(<i>v</i>)‖；转角 <i>θ</i><sub>1</sub> = ${deg(rots[k].th[0])}，<i>θ</i><sub>2</sub> = ${deg(rots[k].th[1])}</span></div>
        <dl class="kv"><dt>扇区 ${SL[k]} 现在的系数</dt><dd class="red">${vecTxt(S.rotCoef(P[k].slice(0, 3), rots[k].th, st.t))}</dd></dl>
        <div class="tbl-wrap"><table class="small"><thead><tr><th><i>v</i></th><th class="r">(<i>p</i><sub>1</sub>, <i>p</i><sub>2</sub>, <i>p</i><sub>3</sub>)</th><th class="r"><i>a</i></th><th class="r">能级</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p>同一组数写成多项式的系数（群代数里的元素）：</p>
        <div class="tbl-wrap"><table class="small"><thead><tr><th></th><th class="r">1</th><th class="r"><i>z</i><sub>1</sub></th><th class="r"><i>z</i><sub>2</sub></th><th class="r"><i>z</i><sub>1</sub><i>z</i><sub>2</sub></th></tr></thead><tbody>${prow(0, "<i>p</i><sub>1</sub>")}${prow(1, "<i>p</i><sub>2</sub>")}${prow(2, "<i>p</i><sub>3</sub>")}${prow(3, "<i>p</i><sub>0</sub>")}</tbody></table></div>
        <p>${nTerms <= 4 ? "四个扇区相同：只剩常数列，回到旧办法里的一支箭。" : `非零系数 ${nTerms} 个，展开成 ${nTerms} 个泡利项（含常数项）；每一块仍只要转一支箭。`}</p>`;
    }
    store.on(refresh);
    chips($("#fu-sec"), (kk) => selSector(+kk));
    const sl = slider("fu-t", (x, out) => { st.t = x; out.textContent = fmt(x, 2); v.redraw(); lv.redraw(); panel(); });
    sl.fire();
    player($("#fu-play"), (dt) => { sl.set(Math.min(2, st.t + dt * 0.7)); return st.t < 2; }, { onStart: () => sl.set(0) });
    $("#fu-ex").addEventListener("click", () => { sl.set(0); store.set(PRESET.map((r) => r.slice())); });
    $("#fu-rand").addEventListener("click", () => {
      sl.set(0);
      store.set(store.P.map(() => {
        const u = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], L = len3(u) || 1, r = 0.35 + 0.65 * Math.random();
        return [...u.map((x) => (x * r) / L), +(Math.random() - 0.5).toFixed(2)];
      }));
    });
    $("#fu-flat").addEventListener("click", () => {
      sl.set(0);
      const avg = [0, 1, 2, 3].map((i) => store.P.reduce((s, x) => s + x[i], 0) / 4);
      store.set(store.P.map(() => avg.slice()));
    });
    panel();
  })();

  /* ───────── 块：8×8 矩阵，U_T(s) 分块，再按扇区转成对角 ───────── */
  (function kuai() {
    const cv = $("#kuai"); if (!cv) return;
    const st = { s: 0 };
    let cache = null;
    const data = () => {
      if (cache && cache.P === store.P) return cache;
      const P = store.P, H0 = S.Horig(P), rots = S.sectorRot(P);
      cache = { P, H0, rots, hmax: Math.max(...P.map((x, k) => Math.abs(x[3]) + rots[k].a)), orig: S.decompose(H0), tf: S.termsT(P) };
      return cache;
    };
    const v = view(cv, (ctx, w, h, p) => {
      const d = data(), M = S.stageMatrix(d.P, st.s, d.H0), fs = Math.max(11, Math.min(w, h) * 0.03);
      const G = Math.min(w * 0.66, h * 0.8), x0 = w - G - w * 0.04, y0 = (h - G) / 2 + h * 0.035, c = G / 8;
      const blk = clamp((st.s - 0.55) / 0.45, 0, 1);
      // 对角格的淡墨底
      ctx.save(); ctx.fillStyle = p.wash; for (let i = 0; i < 8; i++) ctx.fillRect(x0 + i * c + 1, y0 + i * c + 1, c - 2, c - 2); ctx.restore();
      // 格线
      for (let i = 0; i <= 8; i++) {
        line(ctx, [[x0, y0 + i * c], [x0 + G, y0 + i * c]], { w: 0.6, color: p.line });
        line(ctx, [[x0 + i * c, y0], [x0 + i * c, y0 + G]], { w: 0.6, color: p.line });
      }
      // 2×2 块的框
      if (blk > 0) for (let k = 0; k < 4; k++) {
        const a = x0 + 2 * k * c, b = y0 + 2 * k * c;
        line(ctx, [[a, b], [a + 2 * c, b], [a + 2 * c, b + 2 * c], [a, b + 2 * c], [a, b]], { w: 2, color: k === store.sel ? p.red : p.ink, alpha: 0.8 * blk });
      }
      // 墨点 + 相位指针
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const re = M.re[i * 8 + j], im = M.im[i * 8 + j], m = Math.hypot(re, im); if (m < 2e-3 * d.hmax) continue;
        const r = c * 0.44 * Math.sqrt(m / d.hmax), X = x0 + (j + 0.5) * c, Y = y0 + (i + 0.5) * c, ph = Math.atan2(im, re);
        dot(ctx, X, Y, r, { color: p.ink, alpha: 0.85, bleed: false });
        if (r > 3) line(ctx, [[X, Y], [X + r * 1.12 * Math.cos(ph), Y - r * 1.12 * Math.sin(ph)]], { w: 1.8, color: p.red });
      }
      // 行、列标签
      for (let i = 0; i < 8; i++) {
        const lab = "|" + i.toString(2).padStart(3, "0") + "⟩";
        rich(ctx, [rm(lab)], x0 - 6, y0 + (i + 0.5) * c, { size: fs, color: p.soft, align: "right" });
      }
      for (let j = 0; j < 8; j++) rich(ctx, [rm(j.toString(2).padStart(3, "0"))], x0 + (j + 0.5) * c, y0 - fs * 0.8, { size: fs * 0.85, color: p.pale, align: "center" });
      if (blk > 0) for (let k = 0; k < 4; k++) rich(ctx, [mi("v"), rm(" = " + SL[k])], x0 - fs * 3.7, y0 + (2 * k + 1) * c, { size: fs, color: k === store.sel ? p.red : p.ink, align: "right" });
    });
    function panel() {
      const d = data(), M = S.stageMatrix(d.P, st.s, d.H0), ob = S.offBlock(M), od = S.offDiag(M), s = st.s;
      const name = s < 0.005 ? "原始基：对称是 <i>Z</i><sub>1</sub><i>Z</i><sub>3</sub>、<i>Z</i><sub>2</sub><i>Z</i><sub>3</sub>，矩阵看不出结构" : s < 0.995 ? "克利福德变换 <i>U</i><sub>T</sub>(<i>s</i>) 进行中" : s < 1.005 ? "经 <i>U</i><sub>T</sub>：对称变成 <i>Z</i><sub>1</sub>、<i>Z</i><sub>2</sub>，矩阵成了四个 2×2 块" : s < 1.995 ? "第一步：每块各转自己的 <i>θ</i><sub>1</sub>(<i>v</i>)" : s < 2.995 ? "第二步：每块各转自己的 <i>θ</i><sub>2</sub>(<i>v</i>)" : "对角了：<i>V U</i><sub>T</sub> <i>H U</i><sub>T</sub><sup>†</sup><i>V</i><sup>†</sup> = Σ<sub><i>v</i></sub> [<i>a</i>(<i>v</i>) <i>Z</i><sub>3</sub> + <i>p</i><sub>0</sub>(<i>v</i>)] <i>P</i><sub><i>v</i></sub>";
      const big = s < 1.005 ? [ob, "块外的模（弗罗贝尼乌斯范数）"] : [od, "对角线外的模"];
      const fmtTerm = (t) => { const c = typeof t.c === "number" ? t.c : t.c[0]; return `<li>${signed(c, 3)} ${pstr(t.s)}</li>`; };
      let list;
      if (s < 1.005) list = `<p>${s < 0.995 ? "原始基" : "（<i>U</i><sub>T</sub> 之前）原始基"}里的 <i>H</i>，${d.orig.length} 个泡利项：</p><ul class="terms">${d.orig.map(fmtTerm).join("")}</ul>`;
      if (s >= 0.995 && s < 2.995) list = `<p><i>U</i><sub>T</sub> 之后的 ${d.tf.filter((t) => Math.abs(t.c) > 5e-4).length} 个泡利项（前两位只有 <i>Z</i>：都是对称的多项式）：</p><ul class="terms">${d.tf.filter((t) => Math.abs(t.c) > 5e-4).map(fmtTerm).join("")}</ul>`;
      if (s >= 2.995) list = `<p>对角元（从上到下）：</p><ul class="terms">${Array.from({ length: 8 }, (_, i) => `<li>${"|" + i.toString(2).padStart(3, "0") + "⟩"}　${fmt(M.re[i * 9], 3)}</li>`).join("")}</ul><p>每块两个数是 <i>p</i><sub>0</sub>(<i>v</i>) ± <i>a</i>(<i>v</i>)，和“符”一节能级图里的数一样。</p>`;
      $("#kuai-panel").innerHTML = `
        <div class="p-big"><b>${fmt(big[0], 3)}</b><span>${big[1]}</span></div>
        <p class="${s >= 2.995 ? "ok" : ""}">${name}</p>
        <dl class="kv"><dt>块外</dt><dd>${fmt(ob, 3)}</dd><dt>对角线外</dt><dd>${fmt(od, 3)}</dd></dl>
        ${list}`;
    }
    const sl = slider("kuai-s", (x, out) => { st.s = x; out.textContent = fmt(x, 2); v.redraw(); panel(); });
    sl.fire();
    player($("#kuai-play"), (dt) => { sl.set(Math.min(3, st.s + dt * 0.6)); return st.s < 3; }, { onStart: () => sl.set(0) });
    store.on(() => { v.redraw(); panel(); });
  })();

  /* ───────── 比：非上下文判定 ───────── */
  (function bi() {
    const cv = $("#bi"); if (!cv) return;
    const ALL = S.allStrings(2).filter((s) => s !== "II");
    const PRE = { ac: ["XI", "YI", "ZX", "ZY", "ZZ"], fc: ["XX", "YY", "ZZ"], nc: ["ZZ", "XX", "YY", "ZI", "IZ"], ctx: ["XI", "ZI", "IX", "IZ"] };
    const sel = new Set(PRE.nc);
    const box = $("#bi-pick");
    box.innerHTML = ALL.map((s) => `<button type="button" data-s="${s}" aria-pressed="${sel.has(s)}" title="${s[0] === "I" ? "" : s[0] + "₁"}${s[1] === "I" ? "" : s[1] + "₂"}">${s}</button>`).join("");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const s = b.dataset.s; if (sel.has(s)) sel.delete(s); else sel.add(s);
      b.setAttribute("aria-pressed", String(sel.has(s)));
      $$("#bi-pre button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      update();
    });
    chips($("#bi-pre"), (k) => { sel.clear(); PRE[k].forEach((s) => sel.add(s)); $$("#bi-pick button").forEach((b) => b.setAttribute("aria-pressed", String(sel.has(b.dataset.s)))); update(); });
    const list = () => ALL.filter((s) => sel.has(s));
    const v = view(cv, (ctx, w, h, p) => {
      const Sx = list(), cls = S.classify(Sx), fs = Math.max(12, Math.min(w, h) * 0.045);
      if (!Sx.length) { rich(ctx, [zh("点上面的按钮选几个泡利串")], w / 2, h / 2, { size: fs, color: p.pale, align: "center" }); return; }
      const cx = w / 2, cy = h / 2, groups = cls.classes, G = groups.length, R = Math.min(w, h) * (G > 1 ? 0.33 : 0.18), nr = Math.max(14, Math.min(22, Math.min(w, h) * 0.05));
      const pos = new Map();
      const place = (ids, gx, gy, big) => { const m = ids.length, rr = m === 1 ? 0 : big ? Math.min(w, h) * 0.26 : (nr * (m <= 2 ? 1.25 : 1.7)) / Math.sin(PI / Math.max(m, 2)); ids.forEach((id, i) => { const a = -PI / 2 + (TAU * i) / m; pos.set(id, [gx + rr * Math.cos(a), gy + rr * Math.sin(a)]); }); };
      if (cls.Z.length) place(cls.Z, cx, cy);
      groups.forEach((g, k) => { const a = (G === 2 ? PI : -PI / 2) + (TAU * k) / Math.max(G, 1), r = cls.Z.length || G > 1 ? R : 0; place(g, cx + r * Math.cos(a) * (w > h ? 1.25 : 1), cy + r * Math.sin(a), r === 0 && g.length > 2); });
      // 组的淡墨底与名字
      const hull = (ids, lab, red) => {
        const pts = ids.map((i) => pos.get(i)), gx = pts.reduce((s, q) => s + q[0], 0) / pts.length, gy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
        const rr = Math.max(...pts.map((q) => Math.hypot(q[0] - gx, q[1] - gy))) + nr * 1.6;
        wash(ctx, gx, gy, rr, { color: red ? p.red : p.wash, alpha: red ? 0.12 : 1 });
        if (lab) rich(ctx, lab, gx, gy - rr - fs * 0.1, { size: fs * 0.85, color: p.soft, align: "center" });
      };
      if (cls.Z.length) hull(cls.Z, [mi("𝒵")]);
      groups.forEach((g, k) => hull(g, cls.nc ? [mi("𝒞"), rm(String(k + 1), { s: "sub" })] : [zh("连通块")], false));
      // 对易边：墨线；与 𝒵 的边很淡
      const zset = new Set(cls.Z);
      for (let i = 0; i < Sx.length; i++) for (let j = i + 1; j < Sx.length; j++) {
        if (!S.commutes(Sx[i], Sx[j])) continue;
        const a = pos.get(i), b = pos.get(j), withZ = zset.has(i) || zset.has(j);
        line(ctx, [a, b], { w: withZ ? 0.9 : 1.6, color: p.ink, alpha: withZ ? 0.18 : 0.6 });
      }
      if (cls.witness) {
        const [a, b, c] = cls.witness.map((i) => pos.get(i));
        line(ctx, [a, b], { w: 2.6, color: p.red }); line(ctx, [b, c], { w: 2.6, color: p.red });
        line(ctx, [a, c], { w: 2, color: p.red, dash: [5, 4] });
        const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        rich(ctx, [zh("反对易")], m[0], m[1] - fs * 0.6, { size: fs * 0.8, color: p.red, align: "center" });
      }
      Sx.forEach((s, i) => {
        const [x, y] = pos.get(i), red = cls.witness && cls.witness.includes(i);
        ctx.save(); ctx.fillStyle = p.paper; ctx.beginPath(); ctx.arc(x, y, nr, 0, TAU); ctx.fill(); ctx.restore();
        ring(ctx, x, y, nr, { color: red ? p.red : p.ink, w: red ? 2.2 : 1.4 });
        rich(ctx, [rm(s)], x, y + 1, { size: nr * 0.78, color: red ? p.red : p.ink, align: "center", halo: false });
      });
    });
    function update() {
      const Sx = list(), cls = S.classify(Sx), grp = S.symmetryGroup(Sx, cls);
      const L = (ids) => ids.map((i) => pstr(Sx[i])).join("，") || "（空）";
      let html;
      if (!Sx.length) html = `<p>还没有选泡利串。</p>`;
      else if (cls.nc) {
        const gens = [...new Set(grp.gens)];
        html = `<div class="p-big"><b>非上下文</b><span>${Sx.length} 项；𝒯 分成 ${cls.classes.length} 个对易类</span></div>
          <dl class="kv"><dt>𝒵</dt><dd>${L(cls.Z)}</dd>${cls.classes.map((c, k) => `<dt>𝒞<sub>${k + 1}</sub></dt><dd>${L(c)}</dd>`).join("")}
          <dt>代表 <i>A<sub>i</sub></i></dt><dd>${grp.reps.map(pstr).join("，") || "无"}</dd>
          <dt>对称 <i>C<sub>ij</sub></i>、𝒵</dt><dd>${gens.map(pstr).join("，") || "无"}</dd>
          <dt>独立生成元 <i>K</i></dt><dd class="red">${grp.K}</dd></dl>
          <p class="ok">${cls.classes.length >= 2 ? `代表们两两反对易，生成 so(${cls.classes.length + 1})；对称群 ℤ<sub>2</sub><sup>${grp.K}</sup> 有 ${2 ** grp.K} 个扇区。按式 (16) 它就是“系数换成对称多项式”的那一类。` : cls.classes.length === 1 ? "只有一个对易类：全部两两对易，是全对易组（FC）的情形。" : "全部在 𝒵 里：两两对易，是全对易组。"}</p>`;
      } else {
        const [a, b, c] = cls.witness.map((i) => pstr(Sx[i]));
        html = `<div class="p-big"><b style="color:var(--ink)">上下文</b><span>${Sx.length} 项；对易在 𝒯 上不传递</span></div>
          <p class="no">${a} 与 ${b} 对易，${b} 与 ${c} 对易，可 ${a} 与 ${c} 反对易（图中朱线）。</p>
          <dl class="kv"><dt>𝒵</dt><dd>${L(cls.Z)}</dd></dl>
          <p>这样的集合不能写成式 (16)。它对应的哈密顿量仍可能可解（比如两个独立比特），但不靠这篇论文的构造。</p>`;
      }
      $("#bi-panel").innerHTML = html;
      v.redraw();
    }
    update();
  })();

  /* ───────── 比：海森堡型链的两种分组 ───────── */
  (function chain() {
    const cv = $("#chain"); if (!cv) return;
    const st = { n: 3, mode: "nc" };
    const v = view(cv, (ctx, w, h, p) => {
      const N = 2 * st.n, terms = S.chainGroups(st.n, st.mode), fs = Math.max(12, Math.min(w * 0.024, h * 0.05));
      const x0 = w * 0.07, x1 = w * 0.93, y = h * 0.56, dx = (x1 - x0) / (N - 1), X = (q) => x0 + (q - 1) * dx;
      const style = [{ color: p.ink, w: 3, alpha: 0.9 }, { color: p.red, w: 3, alpha: 0.9 }, { color: p.soft, w: 2.4, alpha: 0.8, dash: [5, 4] }];
      // 非上下文分组：H₁ 是不相交比特对上的块
      if (st.mode === "nc") for (let i = 1; i <= st.n; i++) {
        const a = X(2 * i - 1) - dx * 0.32, b = X(2 * i) + dx * 0.32, t = y - dx * 0.62, u = y + h * 0.2;
        ctx.save(); ctx.fillStyle = p.wash; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(a, t, b - a, u - t, 10) : ctx.rect(a, t, b - a, u - t); ctx.fill(); ctx.restore();
      }
      line(ctx, [[x0 - dx * 0.4, y], [x1 + dx * 0.4, y]], { w: 1, color: p.pale, alpha: 0.6 });
      for (const t of terms) {
        if (t.kind === "bond" && t.c !== "X") continue; // 一条键的三项画成一道弧
        const sty = style[t.g];
        if (t.kind === "bond") {
          const a = X(t.i), b = X(t.i + 1), hgt = dx * 0.5;
          const arc = Array.from({ length: 30 }, (_, j) => { const u = j / 29; return [a + (b - a) * u, y - 6 - hgt * Math.sin(PI * u)]; });
          if (sty.dash) line(ctx, arc, { w: sty.w, color: sty.color, alpha: sty.alpha, dash: sty.dash });
          else stroke(ctx, arc, { w: sty.w, color: sty.color, alpha: sty.alpha, taper: [0.15, 0.15] });
          if (t.i === 1) rich(ctx, [mi("xx"), rm("+"), mi("yy"), rm("+"), mi("zz")], (a + b) / 2, y - 6 - hgt - fs * 1.5, { size: fs * 0.8, color: p.soft, align: "center" });
        } else {
          const q = X(t.i);
          if (sty.dash) line(ctx, [[q, y + 8], [q, y + h * 0.15]], { w: sty.w, color: sty.color, alpha: sty.alpha, dash: [3, 3] });
          else stroke(ctx, [[q, y + 8], [q, y + h * 0.15]], { w: sty.w, color: sty.color, alpha: sty.alpha, taper: [0.1, 0.3] });
          rich(ctx, [mi("z"), rm(String(t.i), { s: "sub" })], q, y + h * 0.15 + fs * 0.8, { size: fs * 0.85, color: p.soft, align: "center" });
        }
      }
      for (let q = 1; q <= N; q++) dot(ctx, X(q), y, Math.max(4.5, dx * 0.09), { color: p.ink });
      // 全对易至少三片：x₁x₂、y₂y₃、z₂ 两两反对易
      if (st.mode === "fc") {
        const c1 = [(X(1) + X(2)) / 2, y - 6 - dx * 0.5], c2 = [(X(2) + X(3)) / 2, y - 6 - dx * 0.5], c3 = [X(2), y + h * 0.1];
        [c1, c2, c3].forEach((c) => ring(ctx, c[0], c[1], 9, { color: p.red, w: 1.6 }));
        line(ctx, [c1, c2, c3, c1], { w: 1, color: p.red, alpha: 0.6, dash: [2, 3] });
        rich(ctx, [mi("x"), rm("₁"), mi("x"), rm("₂"), zh("、"), mi("y"), rm("₂"), mi("y"), rm("₃"), zh("、"), mi("z"), rm("₂"), zh(" 两两反对易")], X(3) + dx * 0.2, y + h * 0.31, { size: fs * 0.85, color: p.red });
      }
      // 图例
      const names = st.mode === "fc" ? ["奇数键", "偶数键", "纵场"] : ["H₁：奇数键 + 纵场", "H₂：偶数键"];
      names.forEach((nm, g) => {
        const lx = w * 0.04, ly = h * 0.08 + g * fs * 1.35, sty = style[g];
        if (sty.dash) line(ctx, [[lx, ly], [lx + 26, ly]], { w: sty.w, color: sty.color, dash: sty.dash });
        else stroke(ctx, [[lx, ly], [lx + 26, ly]], { w: sty.w, color: sty.color, taper: [0.1, 0.1] });
        rich(ctx, [zh(`片 ${g + 1}　${nm}`)], lx + 32, ly, { size: fs * 0.82, color: p.soft });
      });
    });
    function panel() {
      const n = st.n, terms = S.chainGroups(n, st.mode), cnt = [0, 1, 2].map((g) => terms.filter((t) => t.g === g).length).filter((c) => c > 0);
      $("#chain-panel").innerHTML = `
        <div class="p-big"><b>${cnt.length}</b><span>片（${2 * n} 个比特、${terms.length} 个泡利项）</span></div>
        <dl class="kv">${cnt.map((c, g) => `<dt>片 ${g + 1}</dt><dd>${c} 项</dd>`).join("")}</dl>
        ${st.mode === "fc" ? `<p>三片各自两两对易。为什么不能更少：<i>x</i><sub>1</sub><i>x</i><sub>2</sub>、<i>y</i><sub>2</sub><i>y</i><sub>3</sub>、<i>z</i><sub>2</sub> 两两反对易（朱圈），任何两项都不能进同一个全对易片。</p>`
          : `<p>H₂ 是 ${n - 1} 条偶数键，两两对易。H₁ 是 ${n} 个淡墨框里的块，每块 5 项 {<i>xx</i>, <i>yy</i>, <i>zz</i>, <i>z</i>, <i>z</i>}：<i>zz</i> 在 𝒵 里，{<i>xx</i>, <i>yy</i>} 与 {<i>z</i>, <i>z</i>} 是两个对易类，所以每块非上下文；块与块作用在不同比特上，各解各的。</p>
             <p class="no">H₁ 整体并不是非上下文的：<i>x</i><sub>1</sub><i>x</i><sub>2</sub> ~ <i>z</i><sub>3</sub> ~ <i>z</i><sub>1</sub>，而 <i>x</i><sub>1</sub><i>x</i><sub>2</sub> 与 <i>z</i><sub>1</sub> 反对易。</p>`}`;
    }
    chips($("#chain-mode"), (k) => { st.mode = k; v.redraw(); panel(); });
    slider("chain-n", (x, out) => { st.n = x; out.textContent = `${x}（${2 * x} 比特）`; v.redraw(); panel(); }).fire();
  })();

  /* ───────── 费：S₂ 的占据决定 S₁ 上的轨道 ───────── */
  (function fei() {
    const cv = $("#fei"); if (!cv) return;
    const st = { v: [0, 0], occ: [true, true, false, false] };
    let geo = null;
    const v = view(cv, (ctx, w, h, p) => {
      const sec = S.fermiSector(st.v), base = S.fermiSector([0, 0]), fs = Math.max(12, Math.min(w, h) * 0.042);
      // 左：S₁ 链与 S₂ 两个轨道
      const sx = (i) => w * 0.06 + i * w * (w < 560 ? 0.088 : 0.105), sy = h * 0.66, s2 = [[w * 0.12, h * 0.27], [w * 0.33, h * 0.27]], rs = Math.max(11, Math.min(w, h) * 0.035);
      rich(ctx, [mi("S"), rm("1", { s: "sub" })], sx(0) - rs * 0.4, sy + rs * 2.6, { size: fs, color: p.soft });
      rich(ctx, [mi("S"), rm("2", { s: "sub" })], s2[0][0] - rs * 2.6, s2[0][1], { size: fs, color: p.soft });
      // 耦合：h⁽¹⁾ 碰格点 1、2；h⁽²⁾ 碰键 2–3 与格点 4
      const links = [[0, [[sx(0), sy], [sx(1), sy]]], [1, [[(sx(1) + sx(2)) / 2, sy], [sx(3), sy]]]];
      links.forEach(([k, targets]) => targets.forEach((tg) => line(ctx, [s2[k], tg], { w: st.v[k] ? 1.8 : 1, color: st.v[k] ? p.red : p.pale, dash: [4, 4], alpha: st.v[k] ? 0.85 : 0.6 })));
      for (let i = 0; i < 3; i++) stroke(ctx, [[sx(i) + rs, sy], [sx(i + 1) - rs, sy]], { w: 2.4, color: p.ink, alpha: i === 1 && st.v[1] ? 0.3 : 0.85, taper: [0.1, 0.1] });
      for (let i = 0; i < 4; i++) { ring(ctx, sx(i), sy, rs, { color: p.ink, w: 1.6 }); rich(ctx, [rm(String(i + 1))], sx(i), sy + 1, { size: fs * 0.9, color: p.ink, align: "center", halo: false }); }
      s2.forEach(([x, y], k) => {
        if (st.v[k]) dot(ctx, x, y, rs, { color: p.red, alpha: 0.9 }); else ring(ctx, x, y, rs, { color: p.ink, w: 1.6 });
        rich(ctx, [rm(String(k + 5))], x, y + 1, { size: fs * 0.9, color: st.v[k] ? p.paper : p.ink, align: "center", halo: false });
        rich(ctx, [mi("n"), rm(String(k + 5), { s: "sub" }), rm(" = " + st.v[k])], x, y - rs - fs * 0.7, { size: fs * 0.85, color: st.v[k] ? p.red : p.soft, align: "center" });
      });
      // 右：能级与轨道形状
      const lo = -2.0, hi = 2.6, top = h * 0.08, bot = h * 0.92, Y = (e) => bot - ((e - lo) / (hi - lo)) * (bot - top);
      const xl = w * 0.5, xr = w * 0.63, thx = w * 0.69, step = Math.min(w * 0.065, 40);
      line(ctx, [[w * 0.46, top], [w * 0.46, bot]], { w: 1, color: p.line });
      rich(ctx, [zh("能量")], w * 0.46, top - fs * 0.4, { size: fs * 0.8, color: p.pale, align: "center" });
      if (st.v[0] || st.v[1]) base.gam.forEach((g) => line(ctx, [[xl - w * 0.03, Y(g)], [xl - w * 0.005, Y(g)]], { w: 1.5, color: p.pale, dash: [3, 3] }));
      // 形状小图按能量排开，太挤时往上下推开
      const ys = sec.gam.map(Y), lab = ys.slice(), gap = Math.max(30, step * 0.95);
      for (let it = 0; it < 30; it++) for (let m = 1; m < 4; m++) if (lab[m - 1] - lab[m] < gap) { const d = (gap - (lab[m - 1] - lab[m])) / 2; lab[m - 1] += d; lab[m] -= d; }
      const hits = [];
      sec.gam.forEach((g, m) => {
        const yy = ys[m], occ = st.occ[m];
        stroke(ctx, [[xl, yy], [xr, yy]], { w: 3, color: occ ? p.ink : p.soft, alpha: occ ? 1 : 0.6, taper: [0.06, 0.08] });
        if (occ) dot(ctx, (xl + xr) / 2, yy - 7, 4.5, { color: p.red });
        rich(ctx, [rm(fmt(g, 2))], xl - 6, yy, { size: fs * 0.78, color: p.soft, align: "right" });
        line(ctx, [[xr + 3, yy], [thx - 6, lab[m]]], { w: 0.8, color: p.pale });
        const W = sec.orb[m], R0 = Math.min(step * 0.42, 15);
        line(ctx, [[thx, lab[m]], [thx + 3 * step, lab[m]]], { w: 0.8, color: p.line });
        W.forEach((c, i) => { const r = R0 * Math.sqrt(Math.abs(c)); if (r < 0.8) return; dot(ctx, thx + i * step, lab[m], r, { color: c >= 0 ? p.ink : p.red, alpha: 0.9, bleed: false }); });
        hits.push({ m, y: yy });
      });
      rich(ctx, [zh("轨道形状（格点 1–4）")], thx + 1.5 * step, top - fs * 0.4, { size: fs * 0.78, color: p.pale, align: "center" });
      geo = { s2, rs, hits, xl, xr };
    });
    cv.addEventListener("click", (e) => {
      if (!geo) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const k = geo.s2.findIndex(([a, b]) => Math.hypot(a - x, b - y) < geo.rs * 1.6);
      if (k >= 0) { const vv = st.v.slice(); vv[k] = 1 - vv[k]; setV(vv); return; }
      if (x > geo.xl - 30 && x < geo.xr + 10) { const hit = geo.hits.find((hh) => Math.abs(hh.y - y) < 12); if (hit) { st.occ[hit.m] = !st.occ[hit.m]; syncNe(); v.redraw(); panel(); } }
    });
    function setV(vv) { st.v = vv; $$("#fei-v button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === vv.join("")))); v.redraw(); panel(); }
    function syncNe() { const ne = st.occ.filter(Boolean).length, el = $("#fei-ne"); el.value = ne; $("#fei-ne-o").textContent = ne; }
    function panel() {
      const sec = S.fermiSector(st.v), base = S.fermiSector([0, 0]), occIdx = st.occ.map((o, m) => (o ? m : -1)).filter((m) => m >= 0);
      const E = occIdx.reduce((s, m) => s + sec.gam[m], 0) + sec.e2;
      // 占据轨道张成的子空间与 v = 00 同样占据的子空间之间的重叠 |det(Wᵀ W₀₀)|
      const ov = (() => { const k = occIdx.length; if (!k) return 1; const M = occIdx.map((a) => occIdx.map((b) => sec.orb[a].reduce((s, x, i) => s + x * base.orb[b][i], 0))); const det = (A) => (A.length === 1 ? A[0][0] : A[0].reduce((s, a, j) => s + (j % 2 ? -1 : 1) * a * det(A.slice(1).map((r) => r.filter((_, c) => c !== j))), 0)); return Math.abs(det(M)); })();
      const ne = occIdx.length;
      const gs = [[0, 0], [0, 1], [1, 0], [1, 1]].map((vv) => { const s = S.fermiSector(vv); return { v: vv.join(""), e: s.gam.slice(0, ne).reduce((a, b) => a + b, 0) + s.e2 }; });
      const best = gs.reduce((a, b) => (b.e < a.e ? b : a));
      $("#fei-panel").innerHTML = `
        <div class="p-big"><b>${fmt(E, 3)}</b><span>这个斯莱特行列式的能量 = Σ<i>γ<sub>m</sub></i> + Σ<i>λ<sub>kl</sub>v<sub>k</sub>v<sub>l</sub></i></span></div>
        <dl class="kv">
          <dt><i>v</i> = (<i>n</i><sub>5</sub>, <i>n</i><sub>6</sub>)</dt><dd>(${st.v.join(", ")})</dd>
          <dt><i>γ<sub>m</sub></i>(<i>v</i>)</dt><dd>${sec.gam.map((g) => fmt(g, 3)).join("，")}</dd>
          <dt>S₂ 上的能量</dt><dd>${fmt(sec.e2, 2)}</dd>
          <dt>与 <i>v</i> = 00 的轨道重叠</dt><dd class="red">${fmt(ov, 3)}</dd>
        </dl>
        <p>${st.v[0] || st.v[1] ? `轨道换了一组：占据轨道张成的子空间与 <i>v</i> = 00 时的重叠是 ${fmt(ov, 3)}（1 表示完全相同）。左边淡虚线是 <i>v</i> = 00 的能级。` : "<i>v</i> = 00：只剩常数项 <i>h</i><sup>(0)</sup>，四条轨道是一条均匀链的驻波。点上方的圆 5、6，看轨道怎样变。"}</p>
        <div class="tbl-wrap"><table class="small"><thead><tr><th><i>v</i></th><th class="r">S₁ 放 ${ne} 个电子时的最低能量</th></tr></thead><tbody>${gs.map((g) => `<tr><td>${g.v}</td><td class="r"${g === best ? ' style="color:var(--cinnabar)"' : ""}>${fmt(g.e, 3)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    chips($("#fei-v"), (k) => setV([+k[0], +k[1]]));
    slider("fei-ne", (x, out) => { st.occ = [0, 1, 2, 3].map((m) => m < x); out.textContent = x; v.redraw(); panel(); }).fire();
  })();

  /* ───────── 路：测量电路与累计平均 ───────── */
  (function lu() {
    const cv = $("#lu"); if (!cv) return;
    const rand = S.seeded(20230918);
    const st = { mode: "b", shots: [], sum: 0, means: [], last: null };
    let oc = null, E = 0, sig = 1;
    const recompute = () => {
      oc = S.outcomes(store.P); E = S.exactE(store.P);
      sig = Math.sqrt(oc.reduce((s, o) => s + o.pv * (o.pUp * (o.p0 + o.a - E) ** 2 + (1 - o.pUp) * (o.p0 - o.a - E) ** 2), 0));
      st.shots = []; st.sum = 0; st.means = []; st.last = null;
    };
    recompute();
    const meter = (ctx, x, y, s, p, col) => {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.fillStyle = p.paper;
      ctx.beginPath(); ctx.rect(x - s, y - s * 0.8, 2 * s, 1.6 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + s * 0.45, s * 0.75, PI * 1.12, PI * 1.88); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.45); ctx.lineTo(x + s * 0.55, y - s * 0.45); ctx.stroke(); ctx.restore();
    };
    const gbox = (ctx, x, y, bw, bh, segs, p, col, fs, dash) => {
      ctx.save(); ctx.fillStyle = p.paper; ctx.strokeStyle = col; ctx.lineWidth = 1.6; if (dash) ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.rect(x - bw / 2, y - bh / 2, bw, bh); ctx.fill(); ctx.stroke(); ctx.restore();
      rich(ctx, segs, x, y + 1, { size: fs, color: col, align: "center", halo: false });
    };
    const v = view(cv, (ctx, w, h, p) => {
      const fs = Math.max(11, Math.min(w * 0.024, h * 0.042)), Hc = h * 0.56, wy = [Hc * 0.22, Hc * 0.48, Hc * 0.78], xa = w * 0.1, xb = w * 0.96;
      const lst = st.last, red = (cond) => (cond ? p.red : p.ink);
      ["q₁", "q₂", "q₃"].forEach((q, i) => rich(ctx, [rm(q)], xa - 8, wy[i], { size: fs, color: p.soft, align: "right" }));
      const xT = w * 0.18, bw = Math.max(34, w * 0.06), bh = Math.max(24, fs * 1.9);
      if (st.mode === "a") {
        wy.forEach((y) => line(ctx, [[xa, y], [w * 0.86, y]], { w: 1.3, color: p.ink }));
        const xs = [0.32, 0.43, 0.54, 0.65].map((f) => w * f);
        xs.forEach((x, k) => {
          const on = lst && lst.k === k, col = red(on), [v1, v2] = S.SECT[k];
          line(ctx, [[x, wy[0]], [x, wy[2]]], { w: 1.4, color: col });
          [[0, v1], [1, v2]].forEach(([q, vv]) => { if (vv === 1) { ctx.save(); ctx.fillStyle = p.paper; ctx.beginPath(); ctx.arc(x, wy[q], 5.5, 0, TAU); ctx.fill(); ctx.restore(); ring(ctx, x, wy[q], 5.5, { color: col, w: 1.6 }); } else dot(ctx, x, wy[q], 5.5, { color: col, bleed: false }); });
          gbox(ctx, x, wy[2], bw * 0.95, bh, [mi("U"), rm(SL[k], { s: "sub" })], p, col, fs * 0.9);
        });
        gbox(ctx, w * 0.76, wy[2], bw * 0.9, bh, [mi("R"), rm("=1")], p, p.soft, fs * 0.8, true);
        wy.forEach((y, i) => meter(ctx, w * 0.88, y, fs * 0.75, p, p.ink));
        if (lst) { const bitsv = [(1 - S.SECT[lst.k][0]) / 2, (1 - S.SECT[lst.k][1]) / 2, (1 - lst.z) / 2]; bitsv.forEach((b, i) => rich(ctx, [rm(String(b))], w * 0.93, wy[i], { size: fs, color: p.red })); }
        rich(ctx, [rm("2"), mi("K", { s: "sup" }), zh(" = 4 个受控门")], w * 0.485, Hc * 0.98, { size: fs * 0.82, color: p.soft, align: "center" });
      } else {
        const xm = w * 0.3, xU = w * 0.64, xR = w * 0.76;
        [0, 1].forEach((i) => line(ctx, [[xa, wy[i]], [xm, wy[i]]], { w: 1.3, color: p.ink }));
        line(ctx, [[xa, wy[2]], [w * 0.86, wy[2]]], { w: 1.3, color: p.ink });
        [0, 1].forEach((i) => meter(ctx, xm, wy[i], fs * 0.75, p, p.ink));
        // 经典线（双线）：测量 → CPU → U_v
        const cpu = [w * 0.47, (wy[0] + wy[1]) / 2], cw = w * 0.17, ch = wy[1] - wy[0] + bh * 0.9;
        [0, 1].forEach((i) => { line(ctx, [[xm + fs * 0.8, wy[i] - 1.6], [cpu[0] - cw / 2, wy[i] - 1.6]], { w: 1, color: p.soft }); line(ctx, [[xm + fs * 0.8, wy[i] + 1.6], [cpu[0] - cw / 2, wy[i] + 1.6]], { w: 1, color: p.soft }); });
        line(ctx, [[xU - 1.6, cpu[1] + ch / 2], [xU - 1.6, wy[2] - bh / 2]], { w: 1, color: p.soft }); line(ctx, [[xU + 1.6, cpu[1] + ch / 2], [xU + 1.6, wy[2] - bh / 2]], { w: 1, color: p.soft });
        line(ctx, [[cpu[0] + cw / 2, cpu[1]], [xU, cpu[1]], [xU, cpu[1] + ch / 2]], { w: 1, color: p.soft });
        ctx.save(); ctx.fillStyle = p.wash; ctx.strokeStyle = lst ? p.red : p.soft; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.rect(cpu[0] - cw / 2, cpu[1] - ch / 2, cw, ch); ctx.fill(); ctx.stroke(); ctx.restore();
        rich(ctx, [zh("经典计算")], cpu[0], cpu[1] - fs * 0.6, { size: fs * 0.8, color: p.soft, align: "center", halo: false });
        rich(ctx, lst ? [mi("v"), rm(" = " + SL[lst.k] + " → "), mi("θ"), rm("(", {}), mi("v"), rm(")")] : [mi("v"), rm(" → "), mi("θ"), rm("("), mi("v"), rm(")")], cpu[0], cpu[1] + fs * 0.65, { size: fs * 0.82, color: lst ? p.red : p.ink, align: "center", halo: false });
        gbox(ctx, xU, wy[2], bw * 1.05, bh, [mi("U"), lst ? rm(SL[lst.k], { s: "sub" }) : mi("v", { s: "sub" })], p, red(!!lst), fs * 0.9);
        gbox(ctx, xR, wy[2], bw * 0.9, bh, [mi("R"), rm("=1")], p, p.soft, fs * 0.8, true);
        meter(ctx, w * 0.88, wy[2], fs * 0.75, p, p.ink);
        if (lst) { [0, 1].forEach((i) => rich(ctx, [rm(String((1 - S.SECT[lst.k][i]) / 2))], xm + fs * 1.3, wy[i] - fs * 0.75, { size: fs, color: p.red })); rich(ctx, [rm(String((1 - lst.z) / 2))], w * 0.93, wy[2], { size: fs, color: p.red }); }
        rich(ctx, [zh("只做 1 个门，参数由测得的 "), mi("v"), zh(" 决定")], w * 0.5, Hc * 0.98, { size: fs * 0.82, color: p.soft, align: "center" });
      }
      gbox(ctx, xT, (wy[0] + wy[2]) / 2, bw, wy[2] - wy[0] + bh, [mi("U"), rm("T", { s: "sub" })], p, p.ink, fs);
      // 下：累计平均（横轴对数）
      const px0 = w * 0.1, px1 = w * 0.96, py0 = h * 0.64, py1 = h * 0.93, span = 1.1;
      const N = st.shots.length, nmax = Math.max(100, N), lx = (n) => px0 + (Math.log10(n) / Math.log10(nmax)) * (px1 - px0);
      const Yv = (e) => py0 + ((E + span - e) / (2 * span)) * (py1 - py0);
      line(ctx, [[px0, py1], [px1, py1]], { w: 1, color: p.line });
      for (let d = 1; d <= nmax; d *= 10) { line(ctx, [[lx(d), py1], [lx(d), py1 + 4]], { w: 1, color: p.pale }); rich(ctx, [rm(String(d))], lx(d), py1 + fs * 0.8, { size: fs * 0.75, color: p.pale, align: "center" }); }
      rich(ctx, [zh("测量次数")], px1, py1 - fs * 0.7, { size: fs * 0.75, color: p.pale, align: "right" });
      // ±2σ/√n 的淡墨带
      ctx.save(); ctx.fillStyle = p.wash; ctx.beginPath();
      const band = Array.from({ length: 60 }, (_, i) => 10 ** ((i / 59) * Math.log10(nmax)));
      band.forEach((n, i) => { const yy = Yv(E + Math.min(span, (2 * sig) / Math.sqrt(n))); i ? ctx.lineTo(lx(n), yy) : ctx.moveTo(lx(n), yy); });
      band.slice().reverse().forEach((n) => ctx.lineTo(lx(n), Yv(E - Math.min(span, (2 * sig) / Math.sqrt(n)))));
      ctx.closePath(); ctx.fill(); ctx.restore();
      line(ctx, [[px0, Yv(E)], [px1, Yv(E)]], { w: 1.6, color: p.red, dash: [6, 4] });
      rich(ctx, [rm("⟨"), mi("H"), rm("⟩ = " + fmt(E, 3))], px0 + 4, Yv(E) - fs * 0.75, { size: fs * 0.8, color: p.red });
      if (N) {
        const pts = [], stepN = Math.max(1, Math.floor(N / 400));
        for (let n = 1; n <= N; n += stepN) pts.push([lx(n), Yv(clamp(st.means[n - 1], E - span, E + span))]);
        pts.push([lx(N), Yv(clamp(st.means[N - 1], E - span, E + span))]);
        if (pts.length > 1) line(ctx, pts, { w: 1.8, color: p.ink }); else dot(ctx, pts[0][0], pts[0][1], 3, { color: p.ink });
        dot(ctx, lx(N), Yv(clamp(st.means[N - 1], E - span, E + span)), 3.5, { color: p.ink });
      } else rich(ctx, [zh("点“测 1 次”或“测 200 次”")], (px0 + px1) / 2, py0 + (py1 - py0) * 0.8, { size: fs * 0.9, color: p.pale, align: "center" });
    });
    function panel() {
      const N = st.shots.length, mean = N ? st.sum / N : NaN, se = sig / Math.sqrt(Math.max(N, 1)), lst = st.last;
      $("#lu-panel").innerHTML = `
        <div class="p-big"><b>${N ? fmt(mean, 3) : "—"}</b><span>${N} 次读数的平均；准确值 ⟨<i>H</i>⟩ = ${fmt(E, 3)}</span></div>
        <dl class="kv">
          <dt>上一次</dt><dd class="red">${lst ? `<i>v</i> = ${SL[lst.k]}，<i>z</i> = ${lst.z > 0 ? "+1" : "−1"}，读数 ${fmt(lst.e, 3)}` : "—"}</dd>
          <dt>标准误 <i>σ</i>/√<i>N</i></dt><dd>${N ? fmt(se, 3) : "—"}（单次 <i>σ</i> = ${fmt(sig, 3)}）</dd>
          <dt>偏差</dt><dd>${N ? `${fmt(Math.abs(mean - E) / se, 2)} 个标准误` : "—"}</dd>
        </dl>
        <div class="tbl-wrap"><table class="small"><thead><tr><th><i>v</i></th><th class="r">Pr(<i>v</i>)</th><th class="r">Pr(<i>z</i> = +1 | <i>v</i>)</th><th class="r">两个读数</th></tr></thead><tbody>
          ${oc.map((o, k) => `<tr><td><span class="sect${lst && lst.k === k ? " on" : ""}">${SL[k]}</span></td><td class="r">${fmt(o.pv, 3)}</td><td class="r">${fmt(o.pUp, 3)}</td><td class="r">${fmt(o.p0 + o.a, 2)}, ${fmt(o.p0 - o.a, 2)}</td></tr>`).join("")}
        </tbody></table></div>
        <p>${st.mode === "a" ? "全受控电路：四个受控门里只有和 <i>v</i> 对上的那个真正起作用。" : "中途测量：先读出 <i>v</i>，经典计算机算出 <i>θ</i><sub>1</sub>(<i>v</i>)、<i>θ</i><sub>2</sub>(<i>v</i>)，只做一个门。"}两种电路的读数分布完全一样。</p>`;
    }
    const take = (k) => { for (let i = 0; i < k && st.shots.length < 50000; i++) { const r = S.shot(oc, rand); st.shots.push(r.e); st.sum += r.e; st.means.push(st.sum / st.shots.length); st.last = r; } v.redraw(); panel(); };
    chips($("#lu-mode"), (k) => { st.mode = k; v.redraw(); panel(); });
    $("#lu-one").addEventListener("click", () => take(1));
    $("#lu-many").addEventListener("click", () => take(200));
    $("#lu-reset").addEventListener("click", () => { st.shots = []; st.sum = 0; st.means = []; st.last = null; v.redraw(); panel(); });
    store.on(() => { recompute(); v.redraw(); panel(); });
    panel();
  })();

  /* ───────── 表 I、表 II：行内墨条，朱字是一行里的最小值 ───────── */
  $$("table.bars tbody tr").forEach((tr) => {
    const cells = $$("td[data-v]", tr), vals = cells.map((c) => +c.dataset.v), mx = Math.max(...vals), mn = Math.min(...vals);
    cells.forEach((c, i) => { c.innerHTML = `<div class="barcell${vals[i] === mn ? " min" : ""}"><b>${vals[i]}</b><i style="width:${((vals[i] / mx) * 4.6).toFixed(2)}rem"></i></div>`; });
  });
})();
