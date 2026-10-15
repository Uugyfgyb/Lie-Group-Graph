// 数值核验：页面上每一条能用数检查的结论，都在这里用 frag.js（页面用的同一份代码）复算一遍。
// 运行：node source/verify.mjs（或 deno run -A source/verify.mjs）。结果写到 ../verification.json，任何一条不过就退出码 1。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const F = new Function(fs.readFileSync(path.join(here, "frag.js"), "utf8") + "\nreturn Frag;")();
const P = fs.readFileSync(path.join(here, "presets.js"), "utf8");
const Presets = new Function(P + "\nreturn Presets;")();

const checks = [];
const check = (name, ok, detail = {}) => checks.push({ name, ok: !!ok, ...detail });
let seed = 20240215;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed / 2147483648) * 2 - 1; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const sig3 = (x) => (x === 0 ? 0 : +x.toPrecision(3));

// 1. 泡利串乘法（含 i 的幂）与矩阵乘积一致；对易判据
{
  let worst = 0, commOk = true;
  for (let t = 0; t < 400; t++) {
    const n = 3, a = { x: Math.floor(Math.random() * 8), z: Math.floor(Math.random() * 8) }, b = { x: Math.floor(Math.random() * 8), z: Math.floor(Math.random() * 8) };
    const { p, k } = F.mul(a, b), [cr, ci] = F.IPOW[k];
    const lhs = F.cmul(F.pauliMat(a, n), F.pauliMat(b, n)), C = F.pauliMat(p, n);
    const rhs = F.zeros(8); for (let i = 0; i < 64; i++) { rhs.re[i] = cr * C.re[i] - ci * C.im[i]; rhs.im[i] = cr * C.im[i] + ci * C.re[i]; }
    worst = Math.max(worst, F.fro(F.axpy(lhs, -1, rhs)));
    const ab = F.cmul(F.pauliMat(a, n), F.pauliMat(b, n)), ba = F.cmul(F.pauliMat(b, n), F.pauliMat(a, n));
    if ((F.fro(F.axpy(ab, -1, ba)) < 1e-12) !== F.commutes(a, b)) commOk = false;
  }
  check("泡利串乘法表（含 i 的幂）与矩阵乘积一致（400 组随机三比特串）", worst < 1e-12, { maxResidual: worst });
  check("对易判据：反对易位置的个数为偶数 ⇔ 矩阵对易", commOk);
  let symOk = true;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) { const M = F.pauliMat({ x, z }, 4); let s = 0; for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) s += Math.abs(M.re[i * 16 + j] - M.re[j * 16 + i]) + Math.abs(M.im[i * 16 + j] - M.im[j * 16 + i]); if ((s < 1e-12) !== F.isSym({ x, z })) symOk = false; }
  check("计算基下泡利串的矩阵是对称的 ⇔ Y 的个数为偶数（四比特全部 256 个）", symOk);
}

// 2. 误差函数与积分：Szabo–Ostlund 表 3.5（R = 1.4 玻尔）
{
  const ref = [[0.5, 0.5204998778130465], [1, 0.8427007929497149], [2, 0.9953222650189527], [3.5, 0.9999992569016276], [4, 0.9999999845827421]];
  const e = Math.max(...ref.map(([x, v]) => Math.abs(F.erf(x) - v)));
  check("erf 与参考值一致（5 个点）", e < 1e-14, { maxResidual: e });
  const I = F.h2Integrals(1.4);
  const got = { S12: I.S[0][1], T11: I.T[0][0], T12: I.T[0][1], V11: I.V[0][0], V12: I.V[0][1], g1111: I.G[0][0][0][0], g1122: I.G[0][0][1][1], g2111: I.G[1][0][0][0], g2121: I.G[1][0][1][0] };
  const want = { S12: 0.6593, T11: 0.76, T12: 0.2365, V11: -1.8804, V12: -1.1948, g1111: 0.7746, g1122: 0.5697, g2111: 0.4441, g2121: 0.297 };
  const bad = Object.keys(want).filter((k) => Math.abs(got[k] - want[k]) > 6e-5);
  check("STO-3G 的重叠、动能、核吸引与双电子积分与 Szabo–Ostlund 的表一致（R = 1.4 玻尔，四位小数）", bad.length === 0, { bad, got: Object.fromEntries(Object.entries(got).map(([k, v]) => [k, +v.toFixed(5)])) });
  const mo = F.h2MO(1.4), q = F.h2Qubit(1.4), g = F.groundState(q.M);
  check("R = 1.4 玻尔：E_HF = −1.1167、FCI = −1.1373 哈特里（Szabo–Ostlund）", Math.abs(mo.Ehf + 1.1167) < 1e-4 && Math.abs(g.E + 1.1373) < 1e-4, { Ehf: +mo.Ehf.toFixed(5), Efci: +g.E.toFixed(5) });
}

// 3. 论文所用的 H₂：R = 1 Å，STO-3G，Bravyi–Kitaev
const h2 = F.h2Scheme();
const gs = F.groundState(h2.M);
const nz = h2.terms.filter((t) => !F.isId(t.p));
{
  const inv = new Map(); for (let o = 0; o < 16; o++) inv.set(F.bkOfOcc(o), o);
  let N = 0; gs.psi.re.forEach((a, b) => (N += a * a * F.pc(inv.get(b))));
  check("H₂（1 Å）：BK 哈密顿量有 15 个泡利项（含常数项），全部是实对称的", h2.terms.length === 15 && h2.terms.every((t) => F.isSym(t.p)), { terms: h2.terms.map((t) => `${t.c.toFixed(6)} ${F.sub(t.p, 4)}`) });
  check("H₂：福克空间里的基态有 2 个电子，E₀ = −1.10115 哈特里", Math.abs(N - 2) < 1e-10 && Math.abs(gs.E + 1.10115) < 5e-6, { N, E0: +gs.E.toFixed(6), Ehf: +h2.mo.Ehf.toFixed(6) });
  const l1 = F.l1(nz);
  check("表 II 的 Ĥe 列：H₂ 的 L1 范数 1.58、14 项", r3(l1) === 1.575 && nz.length === 14, { L1: l1 });
}

// 4. 表 I、表 II 的 H₂ 一行：十列都用排序插入复算，并对 384 种并列次序都试一遍
const paperI = { Pauli: 0.136, FC: 0.136, AC: 0, NC: 0, "TWC-AC": 0.136, "Sym-TWC-AC": 0, FF: 0.032, "Sym-FF": 0, "TWC-FF": 0.136, "Sym-TWC-FF": 0 };
const paperII = { FC: [1.38, 10], AC: [0.186, 2], NC: [1.58, 14], "TWC-AC": [1.38, 10], "Sym-TWC-AC": [1.58, 14], FF: [0.24, 3], "Sym-FF": [1.58, 14], "TWC-FF": [1.38, 10], "Sym-TWC-FF": [1.58, 14] };
const repro = {};
{
  repro.Pauli = { metric: F.metric(nz.map((t) => [t]), 4, gs.psi).value };
  for (const name of F.CLASSES) {
    const fr = F.sortedInsertion(h2.terms, F.classTest(name));
    const big = fr.map((f) => ({ l1: F.l1(f), n: f.length })).sort((a, b) => b.l1 - a.l1)[0];
    repro[name] = { metric: F.metric(fr, 4, gs.psi).value, nfrag: fr.length, largestL1: big.l1, largestN: big.n, frags: fr.map((f) => f.map((t) => F.sub(t.p, 4))) };
  }
  const matchI = Object.keys(paperI).filter((k) => r3(repro[k].metric) === paperI[k]);
  check("表 I 的 H₂ 一行：十个方差指标 ε²M 全部复现（三位小数）", matchI.length === 10, { reproduced: Object.fromEntries(Object.entries(repro).map(([k, v]) => [k, +v.metric.toFixed(4)])), paper: paperI });
  // 论文给几位就比几位：差不超过末位的一半
  const near = (x, v) => { const dec = (String(v).split(".")[1] || "").length; return Math.abs(x - v) <= 0.5 * 10 ** -dec + 1e-12; };
  const matchII = Object.keys(paperII).filter((k) => near(repro[k].largestL1, paperII[k][0]) && repro[k].largestN === paperII[k][1]);
  check("表 II 的 H₂ 一行：九类最大碎片的 L1 范数与项数全部复现", matchII.length === 9, { reproduced: Object.fromEntries(F.CLASSES.map((k) => [k, `${repro[k].largestL1.toFixed(3)}(${repro[k].largestN})`])) });
  // 并列：|系数| 相同的项有 4 组两两相同、1 组四个相同，共 2⁴·4! = 384 种次序
  const sorted = nz.slice().sort((a, b) => Math.abs(b.c) - Math.abs(a.c)), groups = [];
  for (const t of sorted) { const g = groups[groups.length - 1]; if (g && Math.abs(Math.abs(g[0].c) - Math.abs(t.c)) < 1e-9) g.push(t); else groups.push([t]); }
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const orders = groups.reduce((acc, g) => acc.flatMap((o) => perms(g).map((p) => [...o, ...p])), [[]]);
  const si = (order, test) => { const frags = []; for (const t of order) { let ok = false; for (const f of frags) if (test([...f.map((u) => u.p), t.p])) { f.push(t); ok = true; break; } if (!ok) frags.push([t]); } return frags; };
  let stable = true;
  for (const name of F.CLASSES) { const test = F.classTest(name); for (const o of orders) if (r3(F.metric(si(o, test), 4, gs.psi).value) !== paperI[name]) { stable = false; break; } }
  check("上面的复现与并列项的先后无关（384 种次序结果都一样）", stable && orders.length === 384, { orderings: orders.length });
  // 若把 FF 只理解成“图是线图”（不要求连通），FF 一列会和 TWC-FF 一样是 0.136
  const lineOnly = (ps) => { const A = F.graphOf(ps); return F.isLine(A) === true; };
  const fr = F.sortedInsertion(h2.terms, lineOnly), mv = F.metric(fr, 4, gs.psi).value;
  check("对照：FF 只要求“图是线图”时得 0.136（与论文的 0.032 不符），要求连通才得 0.032", r3(mv) === 0.136 && r3(repro.FF.metric) === 0.032, { lineGraphOnly: +mv.toFixed(4), connected: +repro.FF.metric.toFixed(4) });
}

// 5. H₂ 的对称结构与测量方案（附录 B）
{
  const fz = h2.fz;
  const allCommute = h2.fz.gens.every((g) => nz.every((t) => F.commutes(g, t.p)));
  check("Z₁、Z₃、Z₀Z₂ 与 H₂ 的每一项都对易，彼此独立", allCommute && fz.ok);
  check("H₂ 的反相容图：6 个孤立点（Z 集），其余 8 项分成两个孪生类，各 4 项，两类之间连满 16 条边", fz.iso.length === 6 && fz.classes.length === 2 && fz.classes.every((c) => c.length === 4) && F.edgesOf(F.graphOf(nz.map((t) => t.p))).length === 16, { classes: fz.cls.map((c) => c.members.map((m) => F.sub(m.term.p, 4))), zset: fz.zset.map((z) => F.sub(z.term.p, 4)) });
  const cl = F.classify(F.graphOf(nz.map((t) => t.p)));
  check("H₂ 整体不是 FF（含爪），但是 NC，也属于三种对称增广类", !cl.FF && !cl["TWC-FF"] && cl.NC && cl["Sym-TWC-AC"] && cl["Sym-FF"] && cl["Sym-TWC-FF"], { classes: cl });
  const sectorE = h2.sectors.flatMap((s) => [s.Em, s.Ep]).sort((a, b) => a - b);
  const d = Math.max(...sectorE.map((e, i) => Math.abs(e - gs.values[i])));
  check("8 个扇区里各解一个 2×2：p₀(v) ± √(p₁² + p₂²) 给出全部 16 个能级，与 16×16 精确对角化一致", d < 1e-12, { maxResidual: d });
  const g0 = h2.sectors.find((s) => Math.abs(s.Em - gs.E) < 1e-10);
  check("基态在扇区 (Z₁, Z₃, Z₀Z₂) = (+1, +1, −1)，即 2 个电子、α 电子 1 个、成键轨道占据数为偶", g0 && g0.v.join() === "1,1,-1", { sector: g0 && g0.v, p0: g0 && +g0.p0.toFixed(5), p1: g0 && +g0.p[0].toFixed(5), p2: g0 && +g0.p[1].toFixed(5) });
  // 线路：CNOT(0→2)，测比特 1、2、3 得到 v，按 v 对比特 0 做 R_y(−θ_v)，再测比特 0；整体幺正把 H 变成对角阵
  const d16 = 16, U = F.zeros(d16), cnot = (b) => b ^ ((b & 1) << 2);
  for (const s of h2.sectors) {
    const th = Math.atan2(s.p[1] * s.v[0], s.p[0]); // 比特 0 上的有效哈密顿量 p₀ + p₁Z + (z₁p₂)X
    const c = Math.cos(th / 2), sn = Math.sin(th / 2); // R_y(−θ) = [[c, s], [−s, c]]
    for (const b of s.basis) {
      const b2 = cnot(b), b0 = b2 & 1, other = b2 ^ 1;
      // R_y(−θ)|0⟩ = c|0⟩ − s|1⟩，R_y(−θ)|1⟩ = s|0⟩ + c|1⟩
      if (b0 === 0) { U.re[b2 * d16 + b] += c; U.re[other * d16 + b] += -sn; } else { U.re[b2 * d16 + b] += c; U.re[other * d16 + b] += sn; }
    }
  }
  const UHU = F.conjBy(U, h2.M), UU = F.cmul(F.dag(U), U);
  let off = 0, uni = F.fro(F.axpy(UU, -1, F.eye(16)));
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if (i !== j) off = Math.max(off, Math.abs(UHU.re[i * 16 + j]) + Math.abs(UHU.im[i * 16 + j]));
  check("测量线路 CNOT(0→2) → 测比特 1、2、3 → R_y(−θ_v) → 测比特 0 把 H₂ 变成对角阵（幺正）", off < 1e-12 && uni < 1e-12, { maxOffDiagonal: off, unitarity: uni });
  // CNOT(0→2) 共轭：X₀Z₁X₂ → X₀Z₁，Z₀Z₂ → Z₂，Y₀Z₁Y₂ → −X₀Z₁Z₂
  const CN = F.zeros(16); for (let b = 0; b < 16; b++) CN.re[cnot(b) * 16 + b] = 1;
  const conjP = (s) => F.conjBy(CN, F.pauliMat(F.parse(s), 4));
  const eqP = (M, s, sg = 1) => F.fro(F.axpy(M, -sg, F.pauliMat(F.parse(s), 4))) < 1e-12;
  check("CNOT(0→2) 把 X₀Z₁X₂ 变成 X₀Z₁、Z₀Z₂ 变成 Z₂、Y₀Z₁Y₂ 变成 −X₀Z₁Z₂、Z₀ 不变", eqP(conjP("XZXI"), "XZII") && eqP(conjP("ZIZI"), "IIZI") && eqP(conjP("YZYI"), "XZZI", -1) && eqP(conjP("ZIII"), "ZIII"));
  // 方差：基态下整个 H 方差为 0；HF 态的方差
  const varH0 = F.variance(h2.M, gs.psi);
  const hf = { re: new Array(16).fill(0), im: new Array(16).fill(0) }; hf.re[1] = 1; // BK 基里的 |1000⟩（比特 0 = 1）
  const varHF = F.variance(h2.M, hf), eHF = F.expect(h2.M, hf);
  const fc = F.sortedInsertion(h2.terms, F.classTest("FC"));
  check("基态是 H 的本征态：Var(H) = 0；HF 态 |1000⟩ 的能量就是 E_HF", varH0 < 1e-12 && Math.abs(eHF - h2.mo.Ehf) < 1e-12, { varGround: varH0, varHF: +varHF.toFixed(6), eHF: +eHF.toFixed(6) });
  // 一族态 ψ(α) = cos α|1000⟩ + sin α|0010⟩：α = 0 是 HF，α₀ ≈ −10.1° 是基态
  const fam = (deg) => { const a = (deg * Math.PI) / 180, s = { re: new Array(16).fill(0), im: new Array(16).fill(0) }; s.re[1] = Math.cos(a); s.re[4] = Math.sin(a); return s; };
  const m3 = (psi) => ({ Pauli: F.metric(nz.map((t) => [t]), 4, psi).value, FC: F.metric(fc, 4, psi).value, NC: F.variance(h2.M, psi) });
  const a0 = (Math.atan2(gs.psi.re[4], gs.psi.re[1]) * 180) / Math.PI;
  const atHF = m3(fam(0)), atG = m3(fam(a0));
  let pfSame = 0, ncLess = true;
  for (let d = -45; d <= 45; d += 0.5) { const m = m3(fam(d)); pfSame = Math.max(pfSame, Math.abs(m.Pauli - m.FC)); if (m.NC > m.FC + 1e-12) ncLess = false; }
  check("ψ(α) 一族态：HF（α = 0）处三种测法都是 0.0387；基态（α₀ = −10.10°）处逐项 = FC = 0.136、NC = 0；逐项与 FC 处处重合，NC 处处不大于它们",
    Math.abs(atHF.Pauli - atHF.NC) < 1e-12 && r3(atHF.NC) === 0.039 && Math.abs(a0 + 10.097) < 1e-3 && atG.NC < 1e-12 && r3(atG.FC) === 0.136 && pfSame < 1e-7 && ncLess,
    { alpha0: +a0.toFixed(3), atHF: +atHF.NC.toFixed(5), atGround: Object.fromEntries(Object.entries(atG).map(([k, v]) => [k, +v.toFixed(5)])), varHF: +varHF.toFixed(5) });
  // 抽样模型：碎片测量 = 按玻恩规则抽本征值；期望值与方差和 ⟨H_α⟩、Var(H_α) 一致
  let wm = 0;
  for (const f of fc) { const M = F.sumMat(f, 4), o = F.outcomeModel(M, gs.psi); const m = o.reduce((s, x) => s + x.prob * x.value, 0), v = o.reduce((s, x) => s + x.prob * x.value ** 2, 0) - m * m; wm = Math.max(wm, Math.abs(m - F.expect(M, gs.psi)), Math.abs(v - F.variance(M, gs.psi)), Math.abs(o.reduce((s, x) => s + x.prob, 0) - 1)); }
  check("抽样模型：本征值的玻恩分布给出正确的均值、方差，概率和为 1", wm < 1e-12, { maxResidual: wm });
}

// 6. so(5)：XI、YI、ZX、ZY 两两反对易，生成 10 个泡利生成元；谱 = ±ε₁ ± ε₂；吉文斯转动 ↔ 泡利指数门
{
  const As = ["XI", "YI", "ZX", "ZY"].map(F.parse);
  const anti = As.every((a, i) => As.every((b, j) => i === j || !F.commutes(a, b)));
  const ops = F.soGenerators(As), gens = [];
  for (let u = 0; u < 5; u++) for (let v = u + 1; v < 5; v++) gens.push(ops[u][v]);
  const distinct = new Set(gens.map((g) => F.key(g.p))).size === 10;
  // 对易子封闭：[O_a, O_b] = 2i·(±O_c) 或 0，且 O_c 在集合里
  let closed = true;
  for (const a of gens) for (const b of gens) { if (F.commutes(a.p, b.p)) continue; const { p } = F.mul(a.p, b.p); if (!gens.some((g) => F.same(g.p, p))) closed = false; }
  check("XI、YI、ZX、ZY 两两反对易；连同 iA_iA_j 共 10 = 5·4/2 个不同的泡利串，对易子封闭：so(5)", anti && distinct && closed, { generators: gens.map((g) => (g.s > 0 ? "+" : "−") + F.str(g.p, 2)) });
  const symEdges = []; for (let u = 0; u < 5; u++) for (let v = u + 1; v < 5; v++) if (F.isSym(ops[u][v].p)) symEdges.push([u, v]);
  let triOk = true;
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) if ([[a, b], [b, c], [a, c]].every(([u, v]) => F.isSym(ops[u][v].p))) triOk = false;
  const bip = symEdges.every(([u, v]) => (u % 2) !== (v % 2));
  check("实对称生成元只有 6 个，连成二部图 {γ₀,γ₂,γ₄}–{γ₁,γ₃}；所以 10 个三角形（so(3) 子代数）个个含反对称生成元", symEdges.length === 6 && triOk && bip, { symmetric: symEdges.map(([u, v]) => `O${u}${v}=${(ops[u][v].s > 0 ? "+" : "−") + F.str(ops[u][v].p, 2)}`) });
  let worstSpec = 0, worstRot = 0, worstNF = 0, stepsMax = 0;
  for (let t = 0; t < 60; t++) {
    const h = Array.from({ length: 5 }, () => new Array(5).fill(0));
    for (let u = 0; u < 5; u++) for (let v = u + 1; v < 5; v++) { h[u][v] = t % 3 === 0 && u !== 0 ? 0 : rnd(); h[v][u] = -h[u][v]; } // 每三组里有一组只有星形（AC）
    const nf = F.normalForm(h), H = F.hamFromH(h, ops, 2), ev = F.eigHerm(H).values, [e1, e2] = nf.eps;
    const pred = [e1 + e2, e1 - e2, -e1 + e2, -e1 - e2].sort((a, b) => a - b);
    worstSpec = Math.max(worstSpec, ...ev.map((x, i) => Math.abs(x - pred[i])));
    const QhQ = F.mm(F.mm(nf.Q, h), F.tp(nf.Q));
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { const want = a === 0 && b === 1 ? e1 : a === 1 && b === 0 ? -e1 : a === 2 && b === 3 ? e2 : a === 3 && b === 2 ? -e2 : 0; worstNF = Math.max(worstNF, Math.abs(QhQ[a][b] - want)); }
    worstNF = Math.max(worstNF, Math.abs(F.det(nf.Q) - 1));
    const steps = F.givens(nf.Q); stepsMax = Math.max(stepsMax, steps.length);
    let hh = h, U = F.eye(4);
    for (const s of steps) { hh = F.rotateH(hh, s.i, s.j, s.phi); U = F.cmul(F.pauliExp(ops[s.i][s.j], s.phi, 2), U); }
    let dd = 0; for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) dd = Math.max(dd, Math.abs(hh[a][b] - QhQ[a][b]));
    worstRot = Math.max(worstRot, dd, F.fro(F.axpy(F.conjBy(U, H), -1, F.hamFromH(hh, ops, 2))));
  }
  check("标准形：Q h Qᵀ 只剩 (0,1)、(2,3) 两格，det Q = 1（60 组随机 h，其中 20 组是 AC）", worstNF < 1e-12, { maxResidual: worstNF });
  check("4×4 的 H 精确对角化 = {±ε₁ ± ε₂}（60 组）", worstSpec < 1e-12, { maxResidual: worstSpec });
  check("吉文斯分解至多 10 步（= dim so(5)）；每步 (u,v) 平面转 φ 等于幺正 exp(−iφ/2·O_uv)", worstRot < 1e-11 && stepsMax <= 10, { maxResidual: worstRot, maxSteps: stepsMax });
  // 转完以后剩下 ε₁·O₀₁ + ε₂·O₂₃ = ε₁ XI − ε₂ XX：两项对易
  check("转完剩下 O₀₁ = XI 与 O₂₃ = −XX，二者对易，H⊗H 把它们变成 ZI、ZZ", F.str(ops[0][1].p, 2) === "XI" && ops[0][1].s === 1 && F.str(ops[2][3].p, 2) === "XX" && ops[2][3].s === -1 && F.commutes(ops[0][1].p, ops[2][3].p));
}

// 7. 直和：{XX, ZI} ⊕ {ZZ, IX}，块内反对易、块间对易；谱 = ±r₁ ± r₂；两块的转动对易
{
  const b1 = ["XX", "ZI"].map(F.parse), b2 = ["ZZ", "IX"].map(F.parse);
  const ok = !F.commutes(...b1) && !F.commutes(...b2) && b1.every((a) => b2.every((b) => F.commutes(a, b)));
  let worst = 0, worstC = 0;
  const o1 = F.soGenerators(b1)[1][2], o2 = F.soGenerators(b2)[1][2];
  for (let t = 0; t < 40; t++) {
    const a1 = rnd(), c1 = rnd(), a2 = rnd(), c2 = rnd();
    const H = F.sumMat([{ p: b1[0], c: a1 }, { p: b1[1], c: c1 }, { p: b2[0], c: a2 }, { p: b2[1], c: c2 }], 2);
    const r1 = Math.hypot(a1, c1), r2 = Math.hypot(a2, c2), pred = [r1 + r2, r1 - r2, -r1 + r2, -r1 - r2].sort((a, b) => a - b);
    const ev = F.eigHerm(H).values; worst = Math.max(worst, ...ev.map((x, i) => Math.abs(x - pred[i])));
    const U1 = F.pauliExp(o1, Math.atan2(c1, a1), 2), U2 = F.pauliExp(o2, Math.atan2(c2, a2), 2);
    worstC = Math.max(worstC, F.fro(F.axpy(F.cmul(U1, U2), -1, F.cmul(U2, U1))));
    const fin = F.conjBy(F.cmul(U2, U1), H), want = F.sumMat([{ p: b1[0], c: r1 }, { p: b2[0], c: r2 }], 2);
    worstC = Math.max(worstC, F.fro(F.axpy(fin, -1, want)));
  }
  check("{XX, ZI} 与 {ZZ, IX}：块内反对易、块间对易", ok, { o1: (o1.s > 0 ? "+" : "−") + F.str(o1.p, 2), o2: (o2.s > 0 ? "+" : "−") + F.str(o2.p, 2) });
  check("直和的谱 = ±r₁ ± r₂（40 组）", worst < 1e-12, { maxResidual: worst });
  check("U = U₁U₂ = U₂U₁，把 H 转成 r₁XX + r₂ZZ", worstC < 1e-12, { maxResidual: worstC });
}

// 8. 图论：论文图 1、图 2、图 3 与几个对照图
{
  const g = (k) => { const pr = Presets.graphs.find((x) => x.id === k); return { pr, A: F.graphFromEdges(pr.labels.length, pr.edges) }; };
  { const { A } = g("fig1"), c = F.classify(A), comps = F.components(A);
    check("图 1：20 个点、8 个连通分量都是团，是 TWC-AC 而不是 AC", c["TWC-AC"] && !c.AC && comps.length === 8 && A.length === 20, { components: comps.map((x) => x.length) }); }
  { const { pr, A } = g("fig2"), R = F.rootGraph(A);
    const names = R.nodes.map((n) => n.members.map((v) => pr.labels[v]).join("")).sort();
    check("图 2：是线图；Krausz 分解得根图顶点 0、014、12、23、34（与论文一致）", JSON.stringify(names) === JSON.stringify(["0", "014", "12", "23", "34"]), { rootNodes: names }); }
  { const { pr, A } = g("fig3"), { classes, Q } = F.symReduce(A), R = F.rootGraph(Q);
    const cls = classes.map((c) => c.map((v) => pr.labels[v]).join(",")).sort();
    const qEdges = F.edgesOf(Q).length;
    check("图 3：孪生类 {0,1,2}、{3,4}、{5,6,7,8}、{9}；商图 4 点 4 边（爪形加一条边），是线图，根图 5 个点", JSON.stringify(cls) === JSON.stringify(["0,1,2", "3,4", "5,6,7,8", "9"]) && qEdges === 4 && R && R.nodes.length === 5 && F.classify(A)["Sym-TWC-FF"] && !F.classify(A)["TWC-FF"], { classes: cls }); }
  { const { A } = g("claw"), c = F.classify(A);
    check("爪 K₁,₃ 不是线图（不是 FF），但三片叶子互为孪生，商图是一条边：NC", !c.FF && !c["TWC-FF"] && c.NC, { classes: c }); }
  { const { A } = g("spider"), c = F.classify(A);
    check("蛛形图（爪的三条腿各接一个点）：无孪生，商图仍含爪，九类都不是", F.CLASSES.every((k) => !c[k]), { classes: c }); }
  { const { pr, A } = g("h2"), B = F.graphOf(nz.map((t) => t.p));
    const same = pr.labels.every((lab, i) => pr.labels.every((lab2, j) => A[i][j] === B[nz.findIndex((t) => F.sub(t.p, 4) === lab)][nz.findIndex((t) => F.sub(t.p, 4) === lab2)]));
    check("预设“H₂ 的 14 项”与 BK 哈密顿量真实的反相容图一致", same); }
  // 包含关系：随机图上逐条检查 Hasse 图里的每一条“⊂”
  const incl = Presets.inclusions; let bad = null, nG = 0;
  for (let t = 0; t < 600 && !bad; t++) {
    const n = 2 + (t % 7), p = 0.15 + 0.7 * ((t * 37) % 100) / 100, E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if ((rnd() + 1) / 2 < p) E.push([i, j]);
    const c = F.classify(F.graphFromEdges(n, E)); nG++;
    for (const [a, b] of incl) if (c[a] && !c[b]) { bad = { a, b, n, E }; break; }
  }
  check(`Hasse 图里的 ${incl.length} 条包含关系在 ${nG} 个随机图上都成立`, !bad, { counterexample: bad });
}

// 9. 测量次数的最优分配：M ε² = Σ V_α/x_α 在 Σ x_α = 1 下最小值 (Σ√V_α)²，取 x_α ∝ √V_α
{
  let worst = 0;
  for (let t = 0; t < 30; t++) {
    const V = [Math.abs(rnd()) + 0.01, Math.abs(rnd()) + 0.01];
    let best = Infinity; for (let k = 1; k < 20000; k++) { const x = k / 20000; best = Math.min(best, V[0] / x + V[1] / (1 - x)); }
    worst = Math.max(worst, Math.abs(best - (Math.sqrt(V[0]) + Math.sqrt(V[1])) ** 2) / best);
  }
  check("两块碎片：扫一遍分配比例，最小值等于 (√V₁ + √V₂)²（式 24）", worst < 1e-6, { maxRelResidual: worst });
}

// 10. 正文与小题里的其他断言
{
  // 小题一：两比特上 5 个两两反对易的串，连同 10 个 iA_iA_j 恰好是全部 15 个非恒等泡利串，对易子封闭（so(6) ≅ su(4)）
  const As = ["XI", "YI", "ZX", "ZY", "ZZ"].map(F.parse);
  const ops = F.soGenerators(As), gens = [];
  for (let u = 0; u < 6; u++) for (let v = u + 1; v < 6; v++) gens.push(ops[u][v].p);
  const keys = new Set(gens.map(F.key));
  let closed = true; for (const a of gens) for (const b of gens) if (!F.commutes(a, b) && !keys.has(F.key(F.mul(a, b).p))) closed = false;
  check("小题一：XI、YI、ZX、ZY、ZZ 两两反对易，连同 10 个 iA_iA_j 恰是两比特全部 15 个非恒等泡利串，对易子封闭", keys.size === 15 && !keys.has(0) && closed && As.every((a, i) => As.every((b, j) => i === j || !F.commutes(a, b))));
  // 小题四：Z₀；X₀、X₀Z₁、X₀Z₂ 的图是爪，叶子互为孪生，孪生之积 Z₁、Z₂ 是对称算符；整体是 NC 不是 FF
  const cl = ["ZII", "XII", "XZI", "XIZ"].map(F.parse), A = F.graphOf(cl), c = F.classify(A);
  const isClaw = F.edgesOf(A).length === 3 && [1, 2, 3].every((i) => A[0][i]);
  const prods = [F.mul(cl[1], cl[2]).p, F.mul(cl[1], cl[3]).p];
  check("小题四：Z₀ 与 X₀、X₀Z₁、X₀Z₂ 组成爪；孪生之积是 Z₁、Z₂，与四项都对易；是 NC 而不是 FF", isClaw && c.NC && !c.FF && F.same(prods[0], F.parse("IZI")) && F.same(prods[1], F.parse("IIZ")) && prods.every((p) => cl.every((q) => F.commutes(p, q))));
  // 式 (f)：p₁、p₂、p₀ 的因式分解写法与因式分解算法给出的多项式在 8 个扇区上都相等（系数取 5 位小数，差 < 3×10⁻⁵）
  let worst = 0;
  for (const s of h2.sectors) {
    const [z1, z3, z02] = s.v;
    const p1 = 0.13717 * (1 + z1) - 0.13036 * z02 * (1 + z1 * z3);
    const p2 = 0.0492 * (1 - z02) * (1 + z3);
    const p0 = -0.32761 + 0.1566 * z1 + 0.16327 * z1 * z3 + z02 * (1 + z3) * (0.10623 + 0.15543 * z1);
    worst = Math.max(worst, Math.abs(p1 - s.p[0]), Math.abs(p2 - s.p[1]), Math.abs(p0 - s.p0));
  }
  check("“称”一节 H₂ 多项式的因式分解写法在 8 个扇区上与算法给出的 p₀、p₁、p₂ 一致（5 位小数）", worst < 3e-5, { maxResidual: worst });
  // 基态扇区的转角 θ 是组态混合角的两倍
  const g = h2.sectors.find((s) => s.v.join() === "1,1,-1"), th = Math.atan2(g.v[0] * g.p[1], g.p[0]) * 180 / Math.PI;
  const a0 = Math.atan2(gs.psi.re[4], gs.psi.re[1]) * 180 / Math.PI;
  check("基态扇区的 θ = 20.19°，是组态混合角 |α₀| = 10.10° 的两倍", Math.abs(Math.abs(th) - 2 * Math.abs(a0)) < 1e-9 && Math.abs(th - 20.19) < 0.01, { theta: +th.toFixed(4), alpha0: +a0.toFixed(4) });
  // 表 I、表 II 的逐格结论（论文原数）
  const M = Presets.methods, T1 = Presets.tableI, T2 = Presets.tableII, mol = Presets.molecules.map((m) => m.id), col = (k) => M.indexOf(k);
  const symBeatFC = mol.every((m) => ["Sym-TWC-AC", "Sym-FF", "Sym-TWC-FF"].every((k) => T1[m][col(k)] < T1[m][col("FC")]));
  const best = Object.fromEntries(mol.map((m) => { const r = M.slice(1).map((k) => [k, T1[m][col(k)]]); const mn = Math.min(...r.map((x) => x[1])); return [m, r.filter((x) => x[1] === mn).map((x) => x[0])]; }));
  const bestOk = ["LiH", "BeH2", "NH3"].every((m) => best[m].join() === "Sym-TWC-FF") && best.H2O.join() === "Sym-TWC-AC";
  const twcac = mol.every((m) => T1[m][col("TWC-AC")] >= T1[m][col("FC")]);
  const twcff = mol.filter((m) => T1[m][col("TWC-FF")] < T1[m][col("FC")]);
  check("表 I：三种 Sym 新类在五个分子上都比 FC 小；LiH、BeH₂、NH₃ 最好的是 Sym-TWC-FF，H₂O 是 Sym-TWC-AC；TWC-AC 从不比 FC 好；TWC-FF 只在 LiH 上比 FC 小", symBeatFC && bestOk && twcac && twcff.join() === "LiH", { best, twcffBetter: twcff });
  const l1Ok = ["H2", "LiH", "BeH2", "H2O"].every((m) => M.slice(1).every((k) => T2[m][col("Sym-TWC-FF")][0] >= T2[m][col(k)][0] && T2[m][col("Sym-TWC-FF")][1] >= T2[m][col(k)][1]));
  const nh3Bigger = M.slice(1).filter((k) => T2.NH3[col(k)][0] > T2.NH3[col("Sym-TWC-FF")][0]);
  const nh3Most = M.slice(1).reduce((a, k) => (T2.NH3[col(k)][1] > T2.NH3[col(a)][1] ? k : a), "FC");
  check("表 II：除 NH₃ 外 Sym-TWC-FF 的最大碎片 L1 与项数都不小于其余各类；NH₃ 上 FC、NC、TWC-AC、Sym-FF 的 L1 更大，Sym-FF 项数最多", l1Ok && nh3Bigger.join() === "FC,NC,TWC-AC,Sym-FF" && nh3Most === "Sym-FF", { nh3Bigger, nh3Most });
}

const passed = checks.filter((c) => c.ok).length, failed = checks.length - passed;
const out = { generated: new Date().toISOString().slice(0, 10), script: "source/verify.mjs", passed, failed, checks, h2: { E0: gs.E, Ehf: h2.mo.Ehf, repro } };
fs.writeFileSync(path.join(here, "..", "verification.json"), JSON.stringify(out, null, 2));
for (const c of checks) console.log((c.ok ? "✓ " : "✗ ") + c.name);
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
