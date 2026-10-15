/* app.js — 卷首圆相与七幅互动图。依赖 lie.js（Lie）和 ink.js（Ink），无其他依赖。 */
(() => {
  "use strict";
  const { $, clamp, D, view, stroke, line, dot, ring, head, midHead, rich, mi, rm, zh, wash, fmt, sci, slider, chips, player } = Ink;
  const PI = Math.PI, TAU = 2 * PI;
  const circle = (cx, cy, r, n = 180, a0 = 0, a1 = TAU) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; });
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mat = (M, d = 3) => `<span class="mat">${M.flat().map((x) => `<span>${fmt(x, d)}</span>`).join("")}</span>`;
  /* 一团球：淡墨晕 + 一笔圆边 */
  const ball = (ctx, cx, cy, r, p, w = 2.4) => {
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, p.wash);
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.restore();
    stroke(ctx, circle(cx, cy, r, 200, 0.6, 0.6 + TAU * 0.995), { w, w1: w * 0.7, color: p.ink, alpha: 0.85, taper: [0.03, 0.08] });
  };

  /* ───────── 卷首：一笔圆相 = 圆周群；朱线 = 切空间；虚线 = 指数映射（圆的渐开线） ───────── */
  (function hero() {
    const cv = $("#hero"); if (!cv) return;
    view(cv, (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w * 0.43, cy = h * 0.54, R = s * 0.31;
      const at = (phi, r = R) => [cx + r * Math.cos(phi), cy - r * Math.sin(phi)];
      // 一笔：从 112° 起笔，顺时针绕到 −172° 收笔，末段枯
      const pts = [], a0 = 112 * D, a1 = -172 * D;
      for (let i = 0; i <= 280; i++) { const t = i / 280, phi = a0 + (a1 - a0) * t; pts.push(at(phi, R * (1 + 0.013 * Math.sin(2.3 * phi + 0.4) - 0.012 * t))); }
      stroke(ctx, pts, { w: s * 0.062, w1: s * 0.024, color: p.ink, alpha: 0.93, taper: [0.03, 0.1], dry: 0.45, seed: 11, bleed: 2.5 });
      // 墨晕放到笔触后面
      ctx.save(); ctx.globalCompositeOperation = "destination-over"; wash(ctx, cx - R * 0.1, cy + R * 0.15, R * 1.7); ctx.restore();
      // 连珠：由疏到密，接上起笔
      const beads = []; let a = 176 * D, gap = 14 * D;
      while (a > 118 * D) { beads.push(a); a -= gap; gap *= 0.8; }
      beads.forEach((b, k) => { const f = (k + 1) / beads.length, [x, y] = at(b); dot(ctx, x, y, s * (0.007 + 0.019 * f), { color: p.ink, alpha: 0.5 + 0.45 * f }); });
      // 切线：过 e 的竖直朱线
      const E = at(0);
      stroke(ctx, [[E[0], cy + 0.55 * R], [E[0], cy - 1.36 * R]], { w: 2.6, color: p.red, taper: [0.2, 0.08] });
      // 绕线：切线上高 φR 的点沿渐开线卷到圆上转角 φ 处
      for (const phiK of [0.45, 0.9, 1.3]) {
        const inv = [];
        for (let i = 0; i <= 40; i++) { const al = (phiK * i) / 40, L = (phiK - al) * R; inv.push([cx + R * Math.cos(al) - L * Math.sin(al), cy - R * Math.sin(al) - L * Math.cos(al)]); }
        line(ctx, inv, { w: 1.4, color: p.red, dash: [3, 4], alpha: 0.9 });
        dot(ctx, inv[0][0], inv[0][1], 2.6, { color: p.red, bleed: false });
        const q = inv[inv.length - 1], q0 = inv[inv.length - 4];
        head(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), { size: 8, color: p.red });
      }
      dot(ctx, E[0], E[1], s * 0.022, { color: p.red });
      const fs = Math.max(14, s * 0.056);
      rich(ctx, [mi("e")], E[0] + 10, E[1] + fs * 0.75, { size: fs, color: p.red });
      rich(ctx, [mi("G")], at(-138 * D, R * 1.24)[0], at(-138 * D, R * 1.24)[1], { size: fs * 1.1, color: p.ink, align: "center" });
      rich(ctx, [{ t: "g", f: "KaTeX_Fraktur, serif" }, rm(" = "), mi("T"), mi("e", { s: "sub" }), mi("G")], E[0] - 10, cy - 1.3 * R, { size: fs, color: p.red, align: "right" });
      // exp 标在中间那条绕线外侧
      const mid = [cx + R * Math.cos(0.45) - 0.45 * R * Math.sin(0.45), cy - R * Math.sin(0.45) - 0.45 * R * Math.cos(0.45)];
      rich(ctx, [rm("exp")], mid[0] + fs * 0.5, mid[1] - fs * 0.2, { size: fs * 0.92, color: p.red });
      // 朱印：李群
      const sw = s * 0.075, sx = w - sw - s * 0.06, sy = h - sw * 2 - s * 0.06;
      ctx.save(); ctx.translate(sx + sw / 2, sy + sw); ctx.rotate(-3 * D); ctx.fillStyle = p.red; ctx.globalAlpha = 0.88;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-sw / 2, -sw, sw, sw * 2, 3) : ctx.rect(-sw / 2, -sw, sw, sw * 2); ctx.fill();
      ctx.fillStyle = p.paper; ctx.globalAlpha = 1; ctx.font = `${sw * 0.78}px ${p.brush}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("李", 0, -sw * 0.48); ctx.fillText("群", 0, sw * 0.48); ctx.restore();
    });
  })();

  /* ───────── 连：C_n 的风车，n → ∞ 成为 SO(2) ───────── */
  (function lian() {
    const cv = $("#lian"); if (!cv) return;
    const st = { n: 6, th: 45 };
    const v = view(cv, (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w / 2, cy = h / 2, Rr = s * 0.42, Rf = s * 0.3, inf = !isFinite(st.n);
      const at = (phi, r) => [cx + r * Math.cos(phi), cy - r * Math.sin(phi)];
      // 风车（或圆盘）
      const mill = (rot, color, alpha) => {
        if (inf) {
          ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = p.wash; ctx.beginPath(); ctx.arc(cx, cy, Rf, 0, TAU); ctx.fill(); ctx.restore();
          for (const f of [0.3, 0.55, 0.8, 1]) stroke(ctx, circle(cx, cy, Rf * f, 160, 0.3 + f, 0.3 + f + TAU * 0.97), { w: s * (0.006 + 0.012 * f), color, alpha, taper: [0.05, 0.2] });
          return;
        }
        const wd = Math.min(s * 0.075, ((TAU * Rf) / st.n) * 0.38);
        for (let k = 0; k < st.n; k++) {
          const a = (TAU * k) / st.n + rot, pts = [];
          for (let i = 0; i <= 26; i++) { const u = i / 26; pts.push(at(a + 0.62 * u * u, Rf * (0.12 + 0.88 * u))); }
          stroke(ctx, pts, { w: wd, w1: wd * 0.55, color, alpha, taper: [0.35, 0.55] });
        }
      };
      mill(0, p.pale, 0.55);
      mill(st.th * D, p.ink, 0.88);
      dot(ctx, cx, cy, s * 0.012, { color: p.ink });
      // 外圈：群元
      if (inf) {
        stroke(ctx, circle(cx, cy, Rr, 240, 0.25, 0.25 + TAU * 0.985), { w: s * 0.02, w1: s * 0.011, color: p.ink, alpha: 0.85, taper: [0.04, 0.15], bleed: 1.5 });
      } else {
        line(ctx, circle(cx, cy, Rr, 180), { w: 1, color: p.pale, alpha: 0.7, dash: [1, 5] });
        for (let k = 1; k < st.n; k++) { const [x, y] = at((TAU * k) / st.n, Rr); dot(ctx, x, y, s * 0.012, { color: p.ink }); }
      }
      const e = at(0, Rr);
      dot(ctx, e[0], e[1], s * 0.016, { color: p.red });
      rich(ctx, [mi("e")], e[0] + 9, e[1] + 14, { size: Math.max(14, s * 0.045), color: p.red });
      // 当前 θ：外侧一道朱弧加箭头
      const th = st.th * D, ra = Rr + s * 0.045;
      if (th > 0.02) {
        line(ctx, circle(cx, cy, ra, Math.max(4, Math.round(st.th / 3)), 0, th), { w: 1.6, color: p.red, alpha: 0.9 });
        const q = at(th, ra), q0 = at(th - 0.05, ra); head(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), { size: 9, color: p.red });
      }
      const tip = at(th, Rr + s * 0.02), tip2 = at(th, Rr - s * 0.035);
      line(ctx, [tip, tip2], { w: 2, color: p.red });
      // 命中群元：朱圈
      const step = 360 / st.n, k = Math.round(st.th / step);
      if (inf || Math.abs(st.th - k * step) < 0.5) { const q = at(inf ? th : (k * step) * D, Rr); ring(ctx, q[0], q[1], s * 0.03, { color: p.red, w: 1.8 }); }
      rich(ctx, [mi("θ"), rm(` = ${st.th}°`)], 14, 22, { size: Math.max(14, s * 0.042), color: p.soft });
    });
    function panel() {
      const inf = !isFinite(st.n), step = 360 / st.n, k = Math.round(st.th / step), d = Math.abs(st.th - k * step);
      const on = inf || d < 0.5, stepS = Number.isInteger(step) ? String(step) : fmt(step, 2), kk = k % st.n;
      $("#lian-panel").innerHTML = inf
        ? `<div class="p-big"><b>∞</b><span>个转动：转多少度都和自己重合</span></div>
           <dl class="kv"><dt>群</dt><dd><i>SO</i>(2)</dd><dt><i>θ</i></dt><dd>${st.th}°</dd><dt>重合吗</dt><dd>重合</dd></dl>
           <p class="ok">群元不再是一颗颗珠子，连成了一整条圆。<i>θ</i> 可以连续地变，于是可以对 <i>θ</i> 求导：这就是下一节的李代数。</p>`
        : `<div class="p-big"><b>${st.n}</b><span>个转动，组成 <i>C</i><sub>${st.n}</sub>。最小转角 360°/${st.n} = ${stepS}°</span></div>
           <dl class="kv"><dt><i>θ</i></dt><dd>${st.th}°</dd><dt>重合吗</dt><dd class="${on ? "" : "red"}">${on ? `重合：<i>θ</i> ${d < 1e-9 ? "=" : "≈"} ${k} × ${stepS}°` : `不重合：${st.th}° 不是 ${stepS}° 的整数倍`}</dd>
           <dt>对应群元</dt><dd>${on ? (kk === 0 ? "<i>e</i>（不转）" : `第 ${kk} 个`) : "无"}</dd></dl>
           <p class="${on ? "ok" : "no"}">${on ? "这个转动在群里。" : "转到两颗珠子之间，就不在群里了：有限群的元素彼此断开。"}把 <i>n</i> 拖到最右端（∞）看看。</p>`;
    }
    const sn = slider("lian-n", (x, out) => { st.n = x >= 25 ? Infinity : x; out.textContent = x >= 25 ? "∞" : String(x); v.redraw(); panel(); });
    const sth = slider("lian-th", (x, out) => { st.th = x; out.textContent = x + "°"; v.redraw(); panel(); });
    sn.fire(); sth.fire();
    let acc = 0;
    player($("#lian-play"), (dt) => { acc = (acc + dt * 40) % 360; sth.set(Math.round(acc)); }, { onStart: () => { acc = sth.get(); } });
  })();

  /* ───────── 切：放大单位元附近 ───────── */
  (function qie() {
    const cv = $("#qie"); if (!cv) return;
    const st = { k: 6 };
    const v = view(cv, (ctx, w, h, p) => {
      const k = st.k, H = 1.3 / k, sc = h / 2 / H, c0 = 1 - 1 / k, fs = Math.max(14, Math.min(w, h) * 0.045);
      const X = (x) => w / 2 + (x - c0) * sc, Y = (y) => h / 2 - y * sc;
      line(ctx, [[0, Y(0)], [w, Y(0)]], { color: p.pale, w: 1, alpha: 0.45 });
      // 圆
      const pts = [];
      if (H > 0.75) for (let i = 0; i <= 360; i++) { const a = (i / 360) * TAU; pts.push([X(Math.cos(a)), Y(Math.sin(a))]); }
      else { const A = Math.asin(Math.min(1, H * 1.2)); for (let i = 0; i <= 240; i++) { const a = -A + (2 * A * i) / 240; pts.push([X(Math.cos(a)), Y(Math.sin(a))]); } }
      stroke(ctx, pts, { w: 4, color: p.ink, taper: [0, 0], cap: false, bleed: 1.5 });
      // 切线
      line(ctx, [[X(1), Y(-1.3 * H)], [X(1), Y(1.3 * H)]], { w: 1.6, color: p.red, dash: [7, 5] });
      // 偏离：在高度 y0 处，圆离切线 δ
      const y0 = 0.78 * H;
      if (y0 < 0.98) {
        const xa = Math.sqrt(1 - y0 * y0), A = [X(xa), Y(y0)], B = [X(1), Y(y0)];
        line(ctx, [A, B], { w: 2, color: p.red });
        line(ctx, [[A[0], A[1] - 5], [A[0], A[1] + 5]], { w: 1.5, color: p.red });
        line(ctx, [[B[0], B[1] - 5], [B[0], B[1] + 5]], { w: 1.5, color: p.red });
        rich(ctx, [mi("δ")], Math.min(A[0], B[0]) - 8, A[1], { size: fs, color: p.red, align: "right" });
      }
      // 切向量 J·e = (0,1)
      const e = [X(1), Y(0)], tipY = Y(0.55 * H);
      stroke(ctx, [e, [e[0], tipY + 6]], { w: 3, color: p.red, taper: [0, 0.1] });
      head(ctx, e[0], tipY, -PI / 2, { size: 11, color: p.red });
      rich(ctx, [mi("J")], e[0] + 10, tipY + 6, { size: fs, color: p.red });
      dot(ctx, e[0], e[1], 5.5, { color: p.red });
      rich(ctx, [mi("e")], e[0] + 10, e[1] + fs * 0.8, { size: fs, color: p.red });
      rich(ctx, [mi("T"), mi("e", { s: "sub" }), mi("G")], e[0] + 10, Y(1.15 * H), { size: fs, color: p.red });
      // 圆的标签
      const yl = -0.62 * H;
      if (Math.abs(yl) < 0.98) rich(ctx, [mi("G"), rm(" = "), mi("SO"), rm("(2)")], X(Math.sqrt(1 - yl * yl)) - 10, Y(yl), { size: fs * 0.92, color: p.soft, align: "right" });
      else rich(ctx, [mi("G"), rm(" = "), mi("SO"), rm("(2)")], X(-0.3), Y(-0.55), { size: fs * 0.92, color: p.soft, align: "center" });
      // 比例尺
      const Ww = w / sc, raw = Ww * 0.22, pw = 10 ** Math.floor(Math.log10(raw)), m = raw / pw, L = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pw;
      const bx = 16, by = h - 18, bl = L * sc;
      line(ctx, [[bx, by], [bx + bl, by]], { w: 1.5, color: p.soft });
      line(ctx, [[bx, by - 4], [bx, by + 4]], { w: 1.2, color: p.soft }); line(ctx, [[bx + bl, by - 4], [bx + bl, by + 4]], { w: 1.2, color: p.soft });
      rich(ctx, [rm(L >= 0.01 ? String(+L.toPrecision(2)) : sci(L)), zh("（半径 = 1）")], bx, by - 12, { size: fs * 0.72, color: p.soft });
    });
    function panel() {
      const k = st.k, H = 1.3 / k, y0 = 0.78 * H;
      const ok = y0 < 0.98, del = ok ? 1 - Math.sqrt(1 - y0 * y0) : NaN, rel = del / y0;
      const msg = !ok ? "整个圆都在视野里，是弯的。往右拖，放大单位元附近。"
        : rel > 0.08 ? "还看得出弯。继续放大。"
        : rel > 0.01 ? "开始变直了：δ 只有所在高度的百分之几。"
        : "几乎看不出弯。在这么小的范围里，圆和切线难分彼此。";
      $("#qie-panel").innerHTML = `
        <div class="p-big"><b>${ok ? (rel * 100 < 0.1 ? sci(rel * 100) : fmt(rel * 100, rel * 100 < 10 ? 2 : 1)) + "%" : "—"}</b><span><i>δ</i> / <i>y</i>：圆离切线的距离，占所在高度的比例</span></div>
        <dl class="kv"><dt>放大</dt><dd>${k < 10 ? fmt(k, 1) : Math.round(k)} 倍</dd><dt>视野半高</dt><dd>${sci(H)}</dd>
        <dt>取高度 <i>y</i></dt><dd>${ok ? sci(y0) : "—"}</dd><dt>圆离切线 <i>δ</i></dt><dd class="red">${ok ? sci(del) : "—"}</dd><dt><i>y</i>²/2</dt><dd>${ok ? sci((y0 * y0) / 2) : "—"}</dd></dl>
        <p class="${ok && rel < 0.01 ? "ok" : "no"}">${msg}</p>
        <p><i>δ</i> = 1 − √(1 − <i>y</i>²) ≈ <i>y</i>²/2，比 <i>y</i> 高一阶。放大 10 倍，<i>δ</i>/<i>y</i> 就小 10 倍：这正是“切线是圆的一阶近似”。</p>`;
    }
    slider("qie-k", (x, out) => { st.k = 300 ** (x / 1000); out.textContent = (st.k < 10 ? fmt(st.k, 1) : Math.round(st.k)) + "×"; v.redraw(); panel(); }).fire();
  })();

  /* ───────── 卷：exp(iθ) 的级数一项项卷回圆上 ───────── */
  (function juan() {
    const cv = $("#juan"); if (!cv) return;
    const st = { th: 1.8, N: 4 };
    const v = view(cv, (ctx, w, h, p) => {
      const { sums } = Lie.expSeries(st.th, st.N), fs = Math.max(13, Math.min(w, h) * 0.04);
      let x0 = -1.2, x1 = 1.2, y0 = -1.2, y1 = 1.25;
      for (const [x, y] of sums) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const pad = 30, sc = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
      const ox = w / 2 - ((x0 + x1) / 2) * sc, oy = h / 2 + ((y0 + y1) / 2) * sc;
      const X = (x) => ox + x * sc, Y = (y) => oy - y * sc;
      line(ctx, [[0, Y(0)], [w, Y(0)]], { color: p.pale, w: 1, alpha: 0.45 });
      line(ctx, [[X(0), 0], [X(0), h]], { color: p.pale, w: 1, alpha: 0.45 });
      line(ctx, circle(X(0), Y(0), sc, 160), { w: 1.2, color: p.pale, dash: [2, 4] });
      // 卷回来的弧：圆上从 1 到 e^{iθ}
      if (st.th > 0.01) stroke(ctx, circle(X(0), Y(0), sc, Math.max(8, Math.round(st.th * 30)), 0, st.th), { w: 3.2, color: p.red, alpha: 0.55, taper: [0, 0.1] });
      let prev = [0, 0];
      sums.forEach((S, k) => {
        const a = [X(prev[0]), Y(prev[1])], b = [X(S[0]), Y(S[1])], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 0.6) {
          if (k === 1) stroke(ctx, [a, b], { w: 3.8, color: p.red, taper: [0.04, 0.08] });
          else stroke(ctx, [a, b], { w: Math.max(1.4, 4.2 - 0.32 * k), color: p.ink, alpha: Math.max(0.55, 1 - 0.035 * k), taper: [0.04, 0.08] });
          if (len > 14) head(ctx, b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), { size: Math.min(9, len * 0.35), color: k === 1 ? p.red : p.ink, alpha: 0.9 });
          if (len > 26 && k <= 9 && k < sums.length - 1) {
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
            rich(ctx, [rm(String(k))], mx + nx * 13, my + ny * 13, { size: fs * 0.8, color: k === 1 ? p.red : p.pale, align: "center" });
          }
        }
        prev = S;
      });
      const ex = [X(Math.cos(st.th)), Y(Math.sin(st.th))], SN = sums[sums.length - 1];
      ring(ctx, ex[0], ex[1], 8, { color: p.red, w: 2 });
      dot(ctx, X(SN[0]), Y(SN[1]), 4.5, { color: p.ink });
      dot(ctx, X(0), Y(0), 3, { color: p.ink, bleed: false });
      rich(ctx, [mi("e"), mi("iθ", { s: "sup" })], ex[0] + 12 * Math.cos(st.th) + (Math.cos(st.th) < 0 ? -8 : 8), ex[1] - 14 * Math.sin(st.th) - 6, { size: fs, color: p.red, align: Math.cos(st.th) < -0.2 ? "right" : "left" });
      rich(ctx, [rm("0")], X(0) - 8, Y(0) + 12, { size: fs * 0.85, color: p.pale, align: "right" });
      rich(ctx, [rm("1")], X(1) + 6, Y(0) + 12, { size: fs * 0.85, color: p.pale });
      rich(ctx, [mi("S"), mi("N", { s: "sub" })], X(SN[0]), Y(SN[1]) + fs * 1.3, { size: fs, color: p.ink, align: "center" });
    });
    function panel() {
      const { th, N } = st, S = Lie.expSeries(th, N).sums[N], err = Math.hypot(S[0] - Math.cos(th), S[1] - Math.sin(th)), bound = Lie.tailBound(th, N);
      const kmax = Math.floor(th);
      $("#juan-panel").innerHTML = `
        <div class="p-big"><b>${sci(err)}</b><span>|<i>S<sub>N</sub></i> − <i>e<sup>iθ</sup></i>|：部分和离圆上那一点的距离</span></div>
        <dl class="kv"><dt><i>θ</i></dt><dd>${fmt(th, 2)} rad（${fmt(th / D, 1)}°）</dd><dt><i>N</i></dt><dd>${N}</dd>
        <dt><i>S<sub>N</sub></i></dt><dd>(${fmt(S[0], 4)}, ${fmt(S[1], 4)})</dd><dt><i>e<sup>iθ</sup></i></dt><dd class="red">(${fmt(Math.cos(th), 4)}, ${fmt(Math.sin(th), 4)})</dd>
        <dt>余项上界</dt><dd>Σ<sub><i>k</i>&gt;<i>N</i></sub> <i>θ<sup>k</sup></i>/<i>k</i>! = ${sci(bound)}</dd></dl>
        <p class="${err < 1e-3 ? "ok" : "no"}">${err < 1e-3 ? "已经看不出差别。" : N < kmax ? `项还在变长：第 <i>k</i> 项长 <i>θ<sup>k</sup></i>/<i>k</i>!，<i>k</i> 小于 <i>θ</i> ≈ ${fmt(th, 1)} 时一项比一项长。` : "项开始迅速变短：过了 <i>k</i> ≈ <i>θ</i> 以后，阶乘压过了乘方。"}</p>
        <p>误差总在余项上界之下：这就是朱批里“被收敛的正项级数压住”的具体样子。<i>θ</i> 越大，要的项越多。</p>`;
    }
    slider("juan-th", (x, out) => { st.th = x; out.textContent = fmt(x, 2); v.redraw(); panel(); }).fire();
    slider("juan-n", (x, out) => { st.N = x; out.textContent = String(x); v.redraw(); panel(); }).fire();
  })();

  /* ───────── 卷：2×2 矩阵的流，字在流里变形 ───────── */
  (function liu() {
    const cv = $("#liu"); if (!cv) return;
    const A = { rot: [[0, -1], [1, 0]], shear: [[0, 1], [0, 0]], squeeze: [[1, 0], [0, -1]], spiral: [[0.25, -1], [1, 0.25]] };
    const seeds = {
      rot: [0.5, 1, 1.5, 2, 2.5, 3].map((r) => ({ x: [r, 0], s: [0, TAU] })),
      shear: [-2.25, -1.5, -0.75, 0.75, 1.5, 2.25].map((y) => ({ x: [0, y], s: [-9 / Math.abs(y), 9 / Math.abs(y)] })),
      squeeze: [0.35, 1, 2].flatMap((c) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => ({ x: [a * Math.sqrt(c), b * Math.sqrt(c)], s: [-3.5, 3.5] }))),
      spiral: [0, PI].map((a) => ({ x: [0.6 * Math.cos(a), 0.6 * Math.sin(a)], s: [-14, 9] })),
    };
    const st = { kind: "shear", t: 0.9 };
    const v = view(cv, (ctx, w, h, p) => {
      const Hv = 2.5, sc = h / 2 / Hv, Wv = w / 2 / sc, M = Lie.exp2(A[st.kind], st.t);
      const X = (x) => w / 2 + x * sc, Y = (y) => h / 2 - y * sc;
      line(ctx, [[0, Y(0)], [w, Y(0)]], { color: p.pale, w: 1, alpha: 0.4 });
      line(ctx, [[X(0), 0], [X(0), h]], { color: p.pale, w: 1, alpha: 0.4 });
      // 流线
      for (const sd of seeds[st.kind]) {
        const pts = [];
        for (let i = 0; i <= 260; i++) { const s = sd.s[0] + ((sd.s[1] - sd.s[0]) * i) / 260, q = Lie.apply(Lie.exp2(A[st.kind], s), sd.x); if (Math.abs(q[0]) < 3 * Wv && Math.abs(q[1]) < 3 * Hv) pts.push([X(q[0]), Y(q[1])]); }
        line(ctx, pts, { w: 1.1, color: p.soft, alpha: 0.55 });
        const vis = pts.filter((q) => q[0] > 8 && q[0] < w - 8 && q[1] > 8 && q[1] < h - 8);
        if (vis.length > 6) for (const f of st.kind === "rot" ? [0.12, 0.62] : [0.5]) midHead(ctx, vis, f, { size: 7, color: p.soft, alpha: 0.8 });
      }
      if (st.kind === "shear") line(ctx, [[0, Y(0)], [w, Y(0)]], { w: 1.4, color: p.soft, dash: [1, 5], alpha: 0.9 });
      // 字：淡墨原位，浓墨 exp(tA) 之后
      const glyph = (T, color, alpha, bl) => {
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(sc, -sc); ctx.transform(T[0][0], T[1][0], T[0][1], T[1][1], 0, 0); ctx.scale(0.01, -0.01);
        ctx.font = `190px ${p.brush}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = color; ctx.globalAlpha = alpha;
        if (bl) { ctx.shadowColor = color; ctx.shadowBlur = bl; }
        ctx.fillText("李", 0, 8); ctx.restore();
      };
      glyph([[1, 0], [0, 1]], p.pale, 0.38, 0);
      glyph(M, p.ink, 0.9, 2);
      // 单位圆与它的像
      line(ctx, circle(X(0), Y(0), sc, 120), { w: 1.2, color: p.red, alpha: 0.45, dash: [2, 4] });
      const img = Array.from({ length: 161 }, (_, i) => { const a = (i / 160) * TAU, q = Lie.apply(M, [Math.cos(a), Math.sin(a)]); return [X(q[0]), Y(q[1])]; });
      line(ctx, img, { w: 2, color: p.red, alpha: 0.9 });
      rich(ctx, [mi("t"), rm(` = ${fmt(st.t, 2)}`)], 14, 22, { size: Math.max(14, Math.min(w, h) * 0.042), color: p.soft });
    });
    const names = {
      rot: ["椭圆型", "det <i>A</i> &gt; 0：流线是闭合的圆，<i>t</i> = 2π 时字转回原样。"],
      shear: ["抛物型", "det <i>A</i> = 0：流线是平行直线，<i>x</i> 轴上的点不动，越往上走得越快。"],
      squeeze: ["双曲型", "det <i>A</i> &lt; 0：流线是双曲线，横向拉长多少，纵向就压扁多少。"],
      spiral: ["迹不为零", "tr <i>A</i> = 0.5：流线是对数螺线，<i>A</i> 不在 sl(2,ℝ) 里。"],
    };
    function panel() {
      const Am = A[st.kind], M = Lie.exp2(Am, st.t), det = Lie.det(M), et = Math.exp(st.t * Lie.tr(Am)), tr0 = st.kind !== "spiral";
      $("#liu-panel").innerHTML = `
        <div class="p-big"><b>${fmt(det, 3)}</b><span>det exp(<i>tA</i>)。单位圆被送成的椭圆，面积是 π 乘它</span></div>
        <dl class="kv"><dt>类型</dt><dd>${names[st.kind][0]}</dd><dt><i>A</i></dt><dd>${mat(Am, 2)}</dd><dt>exp(<i>tA</i>)</dt><dd>${mat(M, 3)}</dd>
        <dt><i>e</i><sup><i>t</i>·tr <i>A</i></sup></dt><dd class="red">${fmt(et, 3)}</dd></dl>
        <p>${names[st.kind][1]}</p>
        <p class="${tr0 ? "ok" : "no"}">${tr0 ? "迹为 0，面积不变：exp(<i>tA</i>) 一直在 <i>SL</i>(2,ℝ) 里。" : "面积按 <i>e</i><sup>0.5<i>t</i></sup> 变：exp(<i>tA</i>) 离开了 <i>SL</i>(2,ℝ)，但仍在 <i>GL</i>(2,ℝ) 里。"}</p>`;
    }
    const tS = slider("liu-t", (x, out) => { st.t = x; out.textContent = fmt(x, 2); v.redraw(); panel(); });
    st.kind = chips($("#liu-kind"), (k) => { st.kind = k; v.redraw(); panel(); }) || "shear";
    tS.fire();
    let dir = 1, acc = 0;
    player($("#liu-play"), (dt) => { acc += dir * dt * 0.7; if (acc > 2) { acc = 2; dir = -1; } if (acc < -2) { acc = -2; dir = 1; } tS.set(Math.round(acc * 100) / 100); }, { onStart: () => { acc = tS.get(); } });
  })();

  /* ───────── 括：球面上的四段弧，回程差 ≈ 绕 z 转 ε² ───────── */
  (function kuo() {
    const cv = $("#kuo"); if (!cv) return;
    const nrm = Math.hypot(1, 1, 0.3), p0 = [1 / nrm, -1 / nrm, 0.3 / nrm];
    const seq = [["y", -1], ["x", -1], ["y", 1], ["x", 1]], tags = ["①", "②", "③", "④"];
    const st = { e: 30, u: 4, yaw: -32 * D, pitch: 24 * D };
    const legs = (eps) => { let q = p0; return seq.map(([ax, sg]) => { const pts = []; for (let i = 0; i <= 48; i++) pts.push(Lie.apply(Lie.rot(ax, (sg * eps * i) / 48), q)); q = pts[48]; return pts; }); };
    const v = view(cv, (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w / 2, cy = h / 2, Rs = s * 0.36, fs = Math.max(13, s * 0.042);
      const cyw = Math.cos(st.yaw), syw = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      const V = [cp * cyw, cp * syw, sp], Er = [-syw, cyw, 0], Eu = [-sp * cyw, -sp * syw, cp];
      const pr = (q) => [cx + Rs * dot3(q, Er), cy - Rs * dot3(q, Eu), dot3(q, V)];
      // 按前后分段画：前面用实笔，背面用淡虚线
      const draw3 = (pts3, front, back) => {
        let run = [], fr = null;
        const flush = () => { if (run.length > 1) (fr ? front : back)(run); };
        for (const q of pts3) { const P = pr(q), f = P[2] >= 0; if (fr !== null && f !== fr) { flush(); run = [run[run.length - 1]]; } fr = f; run.push(P); }
        flush();
      };
      ball(ctx, cx, cy, Rs, p);
      const gc = (fn) => Array.from({ length: 121 }, (_, i) => fn((i / 120) * TAU));
      for (const g of [gc((a) => [Math.cos(a), Math.sin(a), 0]), gc((a) => [Math.cos(a), 0, Math.sin(a)]), gc((a) => [0, Math.cos(a), Math.sin(a)])])
        draw3(g, (r) => line(ctx, r, { w: 1, color: p.pale, alpha: 0.9 }), (r) => line(ctx, r, { w: 1, color: p.pale, alpha: 0.4, dash: [2, 4] }));
      // 坐标轴
      [["x", [1, 0, 0]], ["y", [0, 1, 0]], ["z", [0, 0, 1]]].forEach(([name, e]) => {
        const O = pr([0, 0, 0]), A1 = pr(e), A2 = pr(e.map((c) => c * 1.3)), front = A1[2] >= 0;
        line(ctx, [O, A1], { w: 1, color: p.soft, alpha: 0.5, dash: [3, 4] });
        line(ctx, [A1, A2], { w: 1.4, color: p.soft, alpha: front ? 0.9 : 0.45 });
        const A3 = pr(e.map((c) => c * 1.42));
        rich(ctx, [mi(name)], A3[0], A3[1], { size: fs, color: p.soft, align: "center" });
      });
      // 四段弧
      const L4 = legs(st.e * D);
      let cur = null;
      L4.forEach((pts, i) => {
        const part = clamp(st.u - i, 0, 1); if (part <= 0) return;
        const sub = pts.slice(0, 1 + Math.round(48 * part));
        draw3(sub, (r) => stroke(ctx, r, { w: 2.8, color: p.ink, taper: [0, 0], cap: true }), (r) => line(ctx, r, { w: 1.8, color: p.ink, alpha: 0.35, dash: [3, 4] }));
        const a = pr(sub[Math.max(0, sub.length - 4)]), b = pr(sub[sub.length - 1]);
        if (sub.length > 6) head(ctx, b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), { size: 9, color: p.ink, alpha: b[2] >= 0 ? 1 : 0.4 });
        if (part === 1) {
          const m = pr(pts[24]), dx = m[0] - cx, dy = m[1] - cy, dl = Math.hypot(dx, dy) || 1;
          rich(ctx, [zh(tags[i])], m[0] + (dx / dl) * 15, m[1] + (dy / dl) * 15, { size: fs * 0.95, color: p.soft, align: "center" });
        }
        cur = b;
      });
      const P0 = pr(p0);
      dot(ctx, P0[0], P0[1], 5, { color: p.ink });
      rich(ctx, [mi("p"), rm("0", { s: "sub" })], P0[0] - 10, P0[1] - 12, { size: fs, color: p.ink, align: "right" });
      if (st.u >= 4) {
        const eps = st.e * D, pz = pr(Lie.apply(Lie.rot("z", eps * eps), p0)), P4 = pr(L4[3][48]);
        line(ctx, [P0, P4], { w: 1.6, color: p.red, dash: [4, 3] });
        ring(ctx, pz[0], pz[1], 9, { color: p.red, w: 1.8 });
        dot(ctx, P4[0], P4[1], 5, { color: p.red });
      } else if (cur) dot(ctx, cur[0], cur[1], 4.5, { color: p.ink });
    });
    // 收敛表：ε 越小，φ/ε² 越接近 1
    const rows = [40, 20, 10, 5, 2.5].map((d) => { const e = d * D, { angle, axis } = Lie.axisAngle(Lie.groupComm(Lie.L.x, Lie.L.y, e)); return `<tr><td class="r">${d}°</td><td class="r">${fmt(angle / (e * e), 4)}</td><td class="r">${fmt(Math.acos(axis[2]) / D, 2)}°</td></tr>`; }).join("");
    function panel() {
      const eps = st.e * D, { angle, axis } = Lie.axisAngle(Lie.groupComm(Lie.L.x, Lie.L.y, eps)), tilt = Math.acos(axis[2]) / D;
      $("#kuo-panel").innerHTML = `
        <div class="p-big"><b>${fmt(angle / (eps * eps), 3)}</b><span><i>φ</i> / <i>ε</i>²：回程差的转角除以 <i>ε</i>²</span></div>
        <dl class="kv"><dt><i>ε</i></dt><dd>${st.e}° = ${fmt(eps, 3)} rad</dd><dt><i>ε</i>²</dt><dd>${fmt(eps * eps, 4)} rad = ${fmt((eps * eps) / D, 2)}°</dd>
        <dt>回程差 <i>φ</i></dt><dd class="red">${fmt(angle / D, 2)}°</dd><dt>它的转轴</dt><dd>与 <i>z</i> 轴夹 ${fmt(tilt, 1)}°</dd></dl>
        <div class="tbl-wrap"><table class="small"><thead><tr><th class="r"><i>ε</i></th><th class="r"><i>φ</i>/<i>ε</i>²</th><th class="r">转轴偏离 <i>z</i></th></tr></thead><tbody>${rows}</tbody></table></div>
        <p>${st.e > 20 ? "<i>ε</i> 大时三阶项还看得出来：转轴歪向一边。把 <i>ε</i> 调小，" : "<i>ε</i> 越小，"}<i>φ</i>/<i>ε</i>² 越接近 1，转轴越接近 <i>z</i> 轴：回程差 ≈ exp(<i>ε</i>²[<i>L<sub>x</sub></i>, <i>L<sub>y</sub></i>]) = 绕 <i>z</i> 转 <i>ε</i>²。</p>`;
    }
    slider("kuo-e", (x, out) => { st.e = x; out.textContent = x + "°"; v.redraw(); panel(); }).fire();
    player($("#kuo-play"), (dt) => { st.u = Math.min(4, st.u + dt * 1.1); v.redraw(); return st.u < 4; }, { onStart: () => { st.u = 0; } });
    // 拖动换视角
    let drag = null;
    cv.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      st.yaw -= (e.clientX - drag[0]) * 0.01; if (e.pointerType === "mouse") st.pitch = clamp(st.pitch + (e.clientY - drag[1]) * 0.01, -1.3, 1.3);
      drag = [e.clientX, e.clientY]; v.redraw();
    });
    const end = () => { drag = null; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key]; if (!k) return;
      e.preventDefault(); st.yaw += k[0]; st.pitch = clamp(st.pitch + k[1], -1.3, 1.3); v.redraw();
    });
  })();

  /* ───────── 覆：转盘、SO(3) 的球、SU(2) 的相位 ───────── */
  (function fu() {
    if (!$("#fu-obj")) return;
    const st = { th: 360 };
    const vObj = view($("#fu-obj"), (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w / 2, cy = h * 0.58, rx = s * 0.38, ry = rx * 0.36, th = st.th * D, fs = Math.max(13, s * 0.06);
      const ell = (f = 1, dy = 0, a0 = 0, a1 = TAU) => Array.from({ length: 121 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 120; return [cx + rx * f * Math.cos(a), cy + dy - ry * f * Math.sin(a)]; });
      line(ctx, [[cx, cy - s * 0.44], [cx, cy + s * 0.3]], { w: 1.2, color: p.pale, dash: [4, 4] });
      line(ctx, ell(1, 6, PI, TAU), { w: 1.2, color: p.pale });
      ctx.save(); ctx.fillStyle = p.wash; ctx.beginPath(); ell().forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.fill(); ctx.restore();
      stroke(ctx, ell(), { w: 2.4, color: p.ink, alpha: 0.85, taper: [0, 0], cap: false });
      const mark = (a, color, alpha, tip) => {
        const pts = []; for (let i = 0; i <= 20; i++) { const r = 0.08 + 0.78 * (i / 20); pts.push([cx + rx * r * Math.cos(a), cy - ry * r * Math.sin(a)]); }
        stroke(ctx, pts, { w: s * 0.045, w1: s * 0.016, color, alpha, taper: [0.15, 0.3] });
        if (tip) dot(ctx, pts[20][0], pts[20][1], s * 0.022, { color: p.red });
      };
      mark(0, p.pale, 0.5, false);
      mark(th, p.ink, 0.92, true);
      // 转向：盘上方一道小弧
      const arc = ell(0.42, -s * 0.3, -0.3 * PI, 1.25 * PI);
      line(ctx, arc, { w: 1.4, color: p.red, alpha: 0.85 });
      const q = arc[arc.length - 1], q0 = arc[arc.length - 6]; head(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), { size: 8, color: p.red });
      rich(ctx, [mi("θ"), rm(` = ${st.th}°`)], 12, 20, { size: fs * 0.8, color: p.soft });
    });
    const vSo3 = view($("#fu-so3"), (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w / 2, cy = h / 2, r = s * 0.34, fs = Math.max(13, s * 0.06), th = st.th;
      ball(ctx, cx, cy, r, p, 2.2);
      line(ctx, [[cx, cy - r], [cx, cy + r]], { w: 1, color: p.pale, dash: [1, 4] });
      rich(ctx, [rm("+"), mi("z")], cx - 8, cy - r - fs * 0.55, { size: fs * 0.75, color: p.soft, align: "right" });
      rich(ctx, [rm("−"), mi("z")], cx - 8, cy + r + fs * 0.6, { size: fs * 0.75, color: p.soft, align: "right" });
      rich(ctx, [mi("I")], cx - 9, cy, { size: fs * 0.8, color: p.soft, align: "right" });
      const Yf = (f) => cy - f * r;
      for (let k = 0; k < 2; k++) {
        const base = 360 * k, ox = k === 0 ? -4 : 4, done = th - base; if (done <= 0) break;
        const up = Math.min(done, 180) / 180;
        stroke(ctx, [[cx + ox, Yf(0)], [cx + ox, Yf(up)]], { w: 2.6, color: p.ink, taper: [0, 0] });
        if (up > 0.15) head(ctx, cx + ox, Yf(up * 0.6), -PI / 2, { size: 8, color: p.ink });
        if (done >= 180) {
          const rr = r + 10 + 7 * k, side = k === 0 ? 1 : -1;
          const arc = Array.from({ length: 61 }, (_, i) => { const a = -PI / 2 + (PI * i) / 60; return [cx + side * rr * Math.cos(a), cy + rr * Math.sin(a)]; });
          line(ctx, arc, { w: 1.5, color: p.red, dash: [4, 4] });
          const q = arc[60], q0 = arc[56]; head(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), { size: 8, color: p.red });
          const back = Math.min(done - 180, 180) / 180;
          if (back > 0) {
            stroke(ctx, [[cx + ox, Yf(-1)], [cx + ox, Yf(-1 + back)]], { w: 2.6, color: p.ink, taper: [0, 0] });
            if (back > 0.15) head(ctx, cx + ox, Yf(-1 + back * 0.6), -PI / 2, { size: 8, color: p.ink });
          }
        }
      }
      const psi = th % 360, f = psi <= 180 ? psi / 180 : -(360 - psi) / 180, ox = th > 360 || th === 720 ? 4 : -4;
      dot(ctx, cx + ox, Yf(f), 5.5, { color: p.ink });
      ring(ctx, cx + ox, Yf(f), 9, { color: p.red, w: 1.8 });
      if (th > 0 && psi === 0) rich(ctx, [zh("回到 "), mi("I")], cx + 16, cy + fs * 0.9, { size: fs * 0.75, color: p.red });
    });
    const vSu2 = view($("#fu-su2"), (ctx, w, h, p) => {
      const s = Math.min(w, h), cx = w / 2, cy = h / 2, r = s * 0.33, fs = Math.max(13, s * 0.06), half = (st.th * D) / 2;
      line(ctx, [[cx - r * 1.25, cy], [cx + r * 1.25, cy]], { w: 1, color: p.pale, alpha: 0.6 });
      stroke(ctx, circle(cx, cy, r, 200, 0.4, 0.4 + TAU * 0.99), { w: 1.8, color: p.ink, alpha: 0.7, taper: [0.03, 0.08] });
      if (half > 0.01) {
        const n = Math.max(6, Math.round(half * 40)), pts = Array.from({ length: n + 1 }, (_, i) => { const a = (-half * i) / n; return [cx + r * 0.86 * Math.cos(a), cy - r * 0.86 * Math.sin(a)]; });
        stroke(ctx, pts, { w: 3.2, color: p.red, alpha: 0.8, taper: [0.02, 0.1] });
      }
      dot(ctx, cx + r, cy, 3.5, { color: p.ink, bleed: false }); dot(ctx, cx - r, cy, 3.5, { color: p.ink, bleed: false });
      rich(ctx, [rm("+1")], cx + r + 8, cy - fs * 0.55, { size: fs * 0.75, color: p.soft });
      rich(ctx, [rm("−1")], cx - r - 8, cy - fs * 0.55, { size: fs * 0.75, color: p.soft, align: "right" });
      const z = [cx + r * Math.cos(-half), cy - r * Math.sin(-half)];
      dot(ctx, z[0], z[1], 6, { color: p.red });
      rich(ctx, [mi("e"), rm("−", { s: "sup" }), mi("iθ/2", { s: "sup" })], cx, cy + r + fs * 0.95, { size: fs * 0.85, color: p.red, align: "center" });
    });
    function panel() {
      const th = st.th, psi = th % 360, half = (th * D) / 2, c = Math.cos(half), sn = -Math.sin(half);
      const U = th % 720 === 0 ? "I" : th % 720 === 360 ? "−I" : null;
      const msg = th === 0 ? "从单位元出发。拖动 <i>θ</i>，或按“转两圈”。"
        : th < 360 ? "三处一起走。注意 <i>SU</i>(2) 的相位只走了 <i>θ</i>/2。"
        : th === 360 ? "转盘回到原样，<i>SO</i>(3) 回到 <i>I</i>，<i>SU</i>(2) 却停在 −<i>I</i>：自旋 ½ 的态乘上了 −1。"
        : th < 720 ? "第二圈：<i>SO</i>(3) 里的点把同一条路再走一遍，<i>SU</i>(2) 的相位走另外半个圆。"
        : "两圈之后，三处都回到起点。";
      $("#fu-panel").innerHTML = `
        <div class="p-big"><b>${U ? U.replace("I", "<i>I</i>") : `${fmt(c, 2)} ${sn < 0 ? "−" : "+"} ${fmt(Math.abs(sn), 2)}<i>i</i>`}</b><span>${U ? "<i>SU</i>(2) 里的 <i>U<sub>z</sub></i>(<i>θ</i>)" : "<i>U<sub>z</sub></i> 左上角的 <i>e</i><sup>−<i>iθ</i>/2</sup>"}</span></div>
        <dl class="kv"><dt><i>θ</i></dt><dd>${th}°</dd>
        <dt>转盘</dt><dd>${th > 0 && psi === 0 ? "回到原样" : `转了 ${th}°`}</dd>
        <dt><i>SO</i>(3)</dt><dd>${psi === 0 ? "<i>R</i> = <i>I</i>" : `<i>R<sub>z</sub></i>(${psi}°)`}</dd>
        <dt><i>SU</i>(2)</dt><dd class="red">${U ? "<i>U</i> = " + U.replace("I", "<i>I</i>") : `<i>U</i> = diag(<i>e</i><sup>−<i>iθ</i>/2</sup>, <i>e</i><sup><i>iθ</i>/2</sup>)`}</dd></dl>
        <p class="${th === 360 ? "no" : "ok"}">${msg}</p>`;
    }
    const sth = slider("fu-th", (x, out) => { st.th = x; out.textContent = x + "°"; vObj.redraw(); vSo3.redraw(); vSu2.redraw(); panel(); });
    sth.fire();
    let acc = 0;
    player($("#fu-play"), (dt) => { acc = Math.min(720, acc + dt * 100); sth.set(Math.round(acc)); return acc < 720; }, { onStart: () => { if (sth.get() >= 720) sth.set(0); acc = sth.get(); } });
  })();

  /* ───────── 覆：SO(3) 球截面上的闭路，试着收缩 ───────── */
  (function loop() {
    const cv = $("#loop"); if (!cv) return;
    const st = { mode: "4", s: 0.6 };
    const v = view(cv, (ctx, w, h, p) => {
      const sm = Math.min(w, h), cx = w / 2, cy = h / 2, r = sm * 0.36, fs = Math.max(13, sm * 0.045);
      ball(ctx, cx, cy, r, p);
      // 沿“从 +z 倒过 α 度”的转轴，从有符号距离 a 走到 b（单位：半径）；off 是屏幕上的水平错开，两圈各占一边
      const spoke = (al, a, b, off) => {
        if (Math.abs(b - a) < 1e-3) return;
        const d = [Math.sin(al * D), -Math.cos(al * D)];
        const P = (f) => [cx + d[0] * f * r + off, cy + d[1] * f * r];
        const pts = Array.from({ length: 21 }, (_, i) => P(a + ((b - a) * i) / 20));
        stroke(ctx, pts, { w: 2.6, color: p.ink, taper: [0, 0] });
        if (Math.abs(b - a) > 0.18) midHead(ctx, pts, 0.62, { size: 9, color: p.ink });
      };
      // 从轴 al 的 +端跳到 −端：球外的朱色虚弧
      const jump = (al, idx, alpha = 1) => {
        if (alpha <= 0) return;
        const rr = r + 11 + 8 * idx, a0 = (al - 90) * D, side = idx % 2 ? -1 : 1;
        const pts = Array.from({ length: 61 }, (_, i) => { const a = a0 + side * (PI * i) / 60; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; });
        line(ctx, pts, { w: 1.6, color: p.red, dash: [4, 4], alpha });
        const q = pts[60], q0 = pts[56]; head(ctx, q[0], q[1], Math.atan2(q[1] - q0[1], q[0] - q0[0]), { size: 8, color: p.red, alpha });
        for (const f of [1, -1]) { const d = [Math.sin(al * D), -Math.cos(al * D)]; dot(ctx, cx + d[0] * f * r, cy + d[1] * f * r, 3.5, { color: p.red, alpha, bleed: false }); }
      };
      const loop2pi = (al, off, idx) => { spoke(al, 0, 1, off); jump(al, idx); spoke(al, -1, 0, off); };
      let shrunk = false;
      if (st.mode === "2") loop2pi(180 * st.s, 0, 0);
      else if (st.s <= 1) { loop2pi(0, -4, 0); loop2pi(180 * st.s, 4, 1); }
      else {
        const u = st.s - 1, mid = Math.min(1, 2 * u), f = u <= 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4), ja = u < 0.5 ? 1 : clamp(1 - (u - 0.5) / 0.1, 0, 1);
        spoke(0, 0, f, -4); spoke(0, f, 0, 4);                     // 上半：第一圈出去、第二圈回来
        if (mid < 1) { spoke(0, -1, -mid, -4); spoke(0, -mid, -1, 4); } // 下半：第一圈回来、第二圈出去，正在收回
        jump(0, 0, ja); jump(180, 1, ja);
        shrunk = u >= 1;
      }
      dot(ctx, cx, cy, 4, { color: p.ink });
      rich(ctx, [mi("I")], cx - 12, cy + fs * 0.9, { size: fs, color: p.soft, align: "right" });
      if (shrunk) { ring(ctx, cx, cy, 12, { color: p.red, w: 2 }); rich(ctx, [zh("缩成一点")], cx + 18, cy + 2, { size: fs * 0.85, color: p.red }); }
      rich(ctx, [rm("+"), mi("z")], cx + 8, cy - r - fs * 1.4, { size: fs * 0.8, color: p.pale });
      rich(ctx, [zh("球半径 = 转角 "), rm("π")], 14, h - 18, { size: fs * 0.8, color: p.pale });
    });
    function panel() {
      const { mode, s } = st;
      let big, cap, msg, cls = "no";
      if (mode === "2") {
        big = `${Math.round(180 * s)}°`; cap = "转轴从 +<i>z</i> 倒过的角度";
        msg = s < 0.995 ? "闭路一直是“从球心走到球面，跳到对径点，再走回球心”。倒转轴只是把这条直径换了个方向。"
          : "转轴倒到了 −<i>z</i>：现在是绕 −<i>z</i> 转 2π，等于原来那一圈反着走。那一对跳跃点还在，这条闭路缩不掉。";
      } else if (s <= 1) {
        big = `${Math.round(180 * s)}°`; cap = "第二圈的转轴从 +<i>z</i> 倒过的角度";
        msg = s < 0.995 ? "第一圈不动，只倒第二圈的转轴。每一刻都还是“转 2π 再转 2π”。" : "第二圈现在是绕 −<i>z</i> 转 2π，正好是第一圈倒着走。继续往右拖。";
      } else {
        const u = s - 1; big = `${Math.round(u * 100)}%`; cap = "收回的进度";
        msg = u < 0.5 ? "下半段是“第一圈走回球心、第二圈又走出去”，一来一回，可以收回到球面那一点。"
          : u < 0.6 ? "两次跳跃一去一回（上→下、下→上），抵消。"
          : u < 0.995 ? "剩下“走上去再走回来”，也一来一回，收回球心。"
          : "整条闭路缩成了球心一点：转 4π 的闭路在 <i>SO</i>(3) 里可以缩掉。";
        if (u >= 0.995) cls = "ok";
      }
      $("#loop-panel").innerHTML = `
        <div class="p-big"><b>${big}</b><span>${cap}</span></div>
        <dl class="kv"><dt>闭路</dt><dd>${mode === "2" ? "绕 <i>z</i> 转 2π（一圈）" : "绕 <i>z</i> 转 4π（两圈）"}</dd><dt>能缩成一点吗</dt><dd class="red">${mode === "2" ? "不能" : "能"}</dd>
        <dt>在 <i>SU</i>(2) 里</dt><dd>${mode === "2" ? "从 <i>I</i> 走到 −<i>I</i>，没闭合" : "从 <i>I</i> 走回 <i>I</i>"}</dd></dl>
        <p class="${cls}">${msg}</p>`;
    }
    const sS = slider("loop-s", (x, out) => { st.s = x; out.textContent = fmt(x, 2); v.redraw(); panel(); });
    st.mode = chips($("#loop-kind"), (k) => { st.mode = k; sS.el.max = k === "2" ? "1" : "2"; sS.set(Math.min(sS.get(), +sS.el.max)); }) || "4";
    sS.el.max = st.mode === "2" ? "1" : "2";
    sS.fire();
    let acc = 0;
    player($("#loop-play"), (dt) => { const mx = +sS.el.max; acc = Math.min(mx, acc + dt * 0.32); sS.set(Math.round(acc * 1000) / 1000); return acc < mx; }, { onStart: () => { if (sS.get() >= +sS.el.max) sS.set(0); acc = sS.get(); } });
  })();
})();
