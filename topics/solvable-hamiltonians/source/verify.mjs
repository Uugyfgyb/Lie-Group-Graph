// 数值核验：页面上每一条可以用数检查的结论，都在这里用 solv.js（页面用的同一份代码）复算一遍。
// 运行：node source/verify.mjs（或 deno run -A source/verify.mjs）。结果写到 ../verification.json，任何一条不过就退出码 1。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const S = new Function(fs.readFileSync(path.join(here, "solv.js"), "utf8") + "\nreturn Solv;")();
const { Z, I, mul, lin, add, sub, scale, dag, kron, norm, conj, expm, pauli, pmul, commutes, allStrings, decompose, givens, rotCoef, givensOp, SECT, toPoly, fromPoly, SYM_ORIG, ALG_ORIG, termsT, HT, UT, UTs, Horig, sectorRot, Vt, stageMatrix, offBlock, offDiag, seeded, PSI, outcomes, exactE, shot, classify, symmetryGroup, chainTerms, chainGroups, FERMI, eS2, fermiSector, A1q } = S;

const checks = [];
const check = (name, ok, detail = {}) => { checks.push({ name, ok: !!ok, ...detail }); };
const rnd = seeded(20231918);
const r1 = () => 2 * rnd() - 1;
const diagC = (vals) => { const A = Z(vals.length); vals.forEach((x, i) => { A.re[i * vals.length + i] = x; }); return A; };
/* 随机反厄米矩阵，只在给定的块里非零（于是与这些块的投影对易） */
const antiHermBlocks = (n, blocks, s = 1) => {
  const A = Z(n);
  for (const [a, b] of blocks) for (let i = a; i < b; i++) for (let j = i; j < b; j++) {
    if (i === j) { A.im[i * n + i] = s * r1(); continue; }
    const x = s * r1(), y = s * r1();
    A.re[i * n + j] = x; A.im[i * n + j] = y; A.re[j * n + i] = -x; A.im[j * n + i] = y;
  }
  return A;
};
const proj = (n, a, b) => { const P = Z(n); for (let i = a; i < b; i++) P.re[i * n + i] = 1; return P; };

/* PRESET：页面“例一”的四个扇区（与 app.js 相同） */
const PRESET = [[0.52, 0.47, 0.5, -0.2], [-0.18, -0.03, 0.4, 0], [0.48, -0.43, -0.7, 0.5], [-0.62, -0.33, 0.2, -0.1]];

// 1. 泡利串的乘法与对易判据和矩阵一致（两比特全部 16×16 对）
{
  let worst = 0, commOK = true;
  const ph = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const s of allStrings(2)) for (const t of allStrings(2)) {
    const { k, s: u } = pmul(s, t);
    worst = Math.max(worst, norm(sub(mul(pauli(s), pauli(t)), scale(pauli(u), ph[k]))));
    const c = norm(sub(mul(pauli(s), pauli(t)), mul(pauli(t), pauli(s)))) < 1e-12;
    if (c !== commutes(s, t)) commOK = false;
  }
  check("泡利串乘法表（含 i 的幂）与矩阵乘积一致", worst < 1e-12, { maxResidual: worst });
  check("对易判据：反对易位置个数为偶 ⇔ 矩阵对易", commOK);
}

// 2. 附录 A：式 (A1)、(A2)、(8)、(9)、(A8)–(A11)
{
  const n = 8, cuts = [[0, 2], [2, 5], [5, 6], [6, 8]];
  let worstA1 = 0, worstDiag = 0, worstProd = 0;
  for (let trial = 0; trial < 20; trial++) {
    const P = cuts.map(([a, b]) => proj(n, a, b));
    const X = cuts.map(() => antiHermBlocks(n, cuts, 1.4)); // 每个 X_i 都与所有 P_j 对易
    // (A1)：只取前三个投影（不完备），右边多出 1 − ΣP
    const use = [0, 1, 2], gen = use.reduce((s, i) => add(s, mul(X[i], P[i])), Z(n));
    const lhs = expm(gen);
    let rhs = I(n); for (const i of use) rhs = add(rhs, mul(sub(expm(X[i]), I(n)), P[i]));
    worstA1 = Math.max(worstA1, norm(sub(lhs, rhs)));
    // (8)(9)：H = Σ H_i P_i，H_i = U_i† D_i U_i；U = Σ U_i P_i = exp(Σ X_i P_i) 把 H 变成 Σ D_i P_i
    const U = cuts.map((_, i) => expm(X[i]));
    const D = cuts.map(() => diagC(Array.from({ length: n }, () => 3 * r1())));
    const H = cuts.reduce((s, _, i) => add(s, mul(mul(mul(dag(U[i]), D[i]), U[i]), P[i])), Z(n));
    const Ud = expm(cuts.reduce((s, _, i) => add(s, mul(X[i], P[i])), Z(n)));
    const Usum = cuts.reduce((s, _, i) => add(s, mul(U[i], P[i])), Z(n));
    const target = cuts.reduce((s, _, i) => add(s, mul(D[i], P[i])), Z(n));
    worstDiag = Math.max(worstDiag, norm(sub(Ud, Usum)), norm(sub(conj(Ud, H), target)));
    // (A8)–(A10)：U = Π e^{X_j}（X_j 互不对易），P 与每个 X_j 对易 ⇒ Π e^{X_j P} = U P + (1 − P)
    const Xs = [0, 1, 2].map(() => antiHermBlocks(n, cuts, 1.1)), Pp = add(P[1], P[3]);
    const Uprod = Xs.reduce((s, x) => mul(s, expm(x)), I(n));
    const prodP = Xs.reduce((s, x) => mul(s, expm(mul(x, Pp))), I(n));
    worstProd = Math.max(worstProd, norm(sub(prodP, add(mul(Uprod, Pp), sub(I(n), Pp)))));
  }
  check("式 (A1)：exp(Σ X_i P_i) = Σ U_i P_i + (1 − Σ P_i)（20 组随机 8×8，投影不完备）", worstA1 < 1e-11, { maxResidual: worstA1 });
  check("式 (8)(9)：U = Σ U_i P_i = exp(Σ X_i P_i)，U H U† = Σ D_i P_i", worstDiag < 1e-10, { maxResidual: worstDiag });
  check("式 (A8)–(A10)：Π e^{X_j P} = (Π e^{X_j}) P + (1 − P)（X_j 互不对易）", worstProd < 1e-11, { maxResidual: worstProd });
}

// 3. 式 (20)(21)：L 个两两反对易的泡利算符，逐次转动把 Σ p_i A_i 变成 a·A_L
{
  // 三比特上的 7 个两两反对易泡利串（约当–维格纳式的马约拉纳算符加上它们的乘积）
  const MAJ = ["XII", "YII", "ZXI", "ZYI", "ZZX", "ZZY", "ZZZ"];
  let anti = true;
  for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) if (commutes(MAJ[i], MAJ[j])) anti = false;
  check("三比特上 7 = 2N+1 个泡利串两两反对易", anti, { set: MAJ });
  let worst = 0, worstCoef = 0, reversedFails = 0, total = 0, closureOK = true;
  for (let L = 2; L <= 7; L++) {
    const As = MAJ.slice(0, L), Am = As.map(pauli);
    // {A_i} ∪ {A_i A_j} 在对易子下封闭，维数 L(L+1)/2 = dim so(L+1)
    const span = new Set(As); for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) span.add(pmul(As[i], As[j]).s);
    for (const a of span) for (const b of span) if (!commutes(a, b) && !span.has(pmul(a, b).s)) closureOK = false;
    if (span.size !== (L * (L + 1)) / 2) closureOK = false;
    for (let trial = 0; trial < 12; trial++) {
      const p = Array.from({ length: L }, () => 2 * r1());
      if (trial === 0) p[L - 1] = -Math.abs(p[L - 1]); // p_L < 0 时要用 atan2 的分支
      const { th, a } = givens(p);
      const H = p.reduce((s, x, i) => add(s, scale(Am[i], x)), Z(8));
      const U = givensOp(Am, th);
      worst = Math.max(worst, norm(sub(conj(U, H), scale(Am[L - 1], a))), Math.abs(a - Math.hypot(...p)));
      const c = rotCoef(p, th, L - 1); worstCoef = Math.max(worstCoef, Math.hypot(...c.slice(0, L - 1)), Math.abs(c[L - 1] - a));
      if (L > 2) { // 反过来的乘积顺序（j = 1 写在最左边）一般不行
        let Ur = I(8); for (let j = 0; j < L - 1; j++) Ur = mul(Ur, lin(I(8), [Math.cos(th[j] / 2), 0], mul(Am[L - 1], Am[j]), [Math.sin(th[j] / 2), 0]));
        total++; if (norm(sub(conj(Ur, H), scale(Am[L - 1], a))) > 1e-6) reversedFails++;
      }
    }
  }
  check("{A_i} ∪ {A_iA_j} 对易子封闭、个数 L(L+1)/2（L = 2…7）", closureOK);
  check("式 (20)(21)：U H U† = a·A_L，a = ‖p‖（L = 2…7，各 12 组，含 p_L < 0）", worst < 1e-11, { maxResidual: worst });
  check("系数空间里逐次转动：前 L−1 个分量归零，最后一个等于 a", worstCoef < 1e-12, { maxResidual: worstCoef });
  check("乘积顺序要紧：j = 1 写在最左边时一般转不到 A_L", reversedFails === total, { reversedFails, total });
}

// 4. 三比特例子：U_T、对称、反对易组、分块、对角化
{
  const map = [...SYM_ORIG, ...ALG_ORIG].map((s) => decompose(conj(UT, pauli(s))));
  const want = ["ZII", "IZI", "IIX", "IIY", "IIZ"];
  const ok = map.every((d, i) => d.length === 1 && d[0].s === want[i] && Math.abs(d[0].c[0] - 1) < 1e-12);
  check("U_T = CNOT(3→2)·CNOT(3→1) 把 Z₁Z₃, Z₂Z₃ 送到 Z₁, Z₂，把 X₁X₂X₃, X₁X₂Y₃, Z₃ 送到 X₃, Y₃, Z₃", ok, { images: map.map((d) => d.map((x) => `${x.c[0].toFixed(3)}${x.s}`).join("+")) });
  let symOK = true;
  for (const c of SYM_ORIG) for (const a of ALG_ORIG) if (!commutes(c, a)) symOK = false;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (commutes(ALG_ORIG[i], ALG_ORIG[j])) symOK = false;
  check("原始基里 C₁, C₂ 与每个 A_i 对易，A_i 两两反对易", symOK);
  check("U_T 是连续路径 U_T(s) 在 s = 1 处的值，U_T(0) = I", norm(sub(UTs(1), UT)) < 1e-12 && norm(sub(UTs(0), I(8))) < 1e-12);
  let worstPoly = 0;
  for (let t = 0; t < 30; t++) { const x = [r1(), r1(), r1(), r1()]; worstPoly = Math.max(worstPoly, Math.hypot(...fromPoly(toPoly(x)).map((y, i) => y - x[i]))); }
  check("扇区值 ↔ 多项式系数（沃尔什–阿达马）互逆", worstPoly < 1e-14, { maxResidual: worstPoly });
  const H0 = Horig(PRESET), terms = decompose(H0);
  const nonId = terms.filter((t) => t.s !== "III").map((t) => t.s), cls = classify(nonId), grp = symmetryGroup(nonId, cls);
  check("例一：原始 H 有 16 个泡利项（含常数项），系数全是实数", terms.length === 16 && terms.every((t) => Math.abs(t.c[1]) < 1e-12), { terms: terms.map((t) => `${t.c[0].toFixed(4)} ${t.s}`) });
  check("例一：这 15 个非常数项是非上下文的：Z 有 3 项，T 分成 3 个对易类、每类 4 项，对称群生成元 K = 2", cls.nc && cls.Z.length === 3 && cls.classes.length === 3 && cls.classes.every((c) => c.length === 4) && grp.K === 2, { Z: cls.Z.map((i) => nonId[i]), classes: cls.classes.map((c) => c.map((i) => nonId[i])) });
  // 扇区 k 的 2×2 块等于 Σ p_i(v) σ_i + p0(v)
  const Ht = HT(PRESET); let worstBlock = 0;
  PRESET.forEach((x, k) => {
    const blk = add(add(add(scale(A1q[0], x[0]), scale(A1q[1], x[1])), scale(A1q[2], x[2])), scale(I(2), x[3]));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) worstBlock = Math.max(worstBlock, Math.hypot(Ht.re[(2 * k + i) * 8 + 2 * k + j] - blk.re[i * 2 + j], Ht.im[(2 * k + i) * 8 + 2 * k + j] - blk.im[i * 2 + j]));
  });
  check("U_T H U_T† 的第 v 块 = Σ p_i(v) σ_i + p₀(v)", worstBlock < 1e-12, { maxResidual: worstBlock });
  const M0 = stageMatrix(PRESET, 0, H0), M1 = stageMatrix(PRESET, 1, H0), M3 = stageMatrix(PRESET, 3, H0);
  const rots = sectorRot(PRESET), want3 = rots.flatMap((r, k) => [PRESET[k][3] + r.a, PRESET[k][3] - r.a]);
  const got3 = Array.from({ length: 8 }, (_, i) => M3.re[i * 9]);
  check("进度 s = 0 是原始 H；s = 1 时块外为零；s = 3 时完全对角", norm(sub(M0, H0)) < 1e-12 && offBlock(M1) < 1e-12 && offDiag(M3) < 1e-11 && offBlock(M0) > 0.5, { offBlockAt0: offBlock(M0), offBlockAt1: offBlock(M1), offDiagAt3: offDiag(M3) });
  check("对角元依次是 p₀(v) ± a(v)（q₃ = 0 取 +）", got3.every((x, i) => Math.abs(x - want3[i]) < 1e-11), { diag: got3, expected: want3 });
  // 式 (23)：V = Π_v Π_j exp(θ_j(v) A′_L A′_j P_v / 2) 等于 Σ_v U_v P_v
  let Vp = I(8);
  rots.forEach((r, k) => {
    const Pv = Z(4); Pv.re[k * 4 + k] = 1;
    [0, 1].forEach((j) => { Vp = mul(expm(scale(kron(Pv, mul(A1q[2], A1q[j])), r.th[j] / 2)), Vp); });
  });
  check("式 (23)：指数的乘积形式与 Σ_v U_v P_v 相同", norm(sub(Vp, Vt(PRESET, 2))) < 1e-11, { residual: norm(sub(Vp, Vt(PRESET, 2))) });
  // 随机扇区值也成立
  let worstRand = 0;
  for (let t = 0; t < 25; t++) {
    const P = SECT.map(() => [r1(), r1(), r1(), r1()]), M = stageMatrix(P, 3), rr = sectorRot(P);
    worstRand = Math.max(worstRand, offDiag(M), ...rr.flatMap((r, k) => [Math.abs(M.re[(2 * k) * 9] - P[k][3] - r.a), Math.abs(M.re[(2 * k + 1) * 9] - P[k][3] + r.a)]));
  }
  check("25 组随机扇区值：V U_T H U_T† V† = Σ_v [a(v) Z₃ + p₀(v)] P_v", worstRand < 1e-10, { maxResidual: worstRand });
  // “系数是数”时四个扇区相同，四个 U_v 也相同
  const avg = [0, 1, 2, 3].map((i) => PRESET.reduce((s, x) => s + x[i], 0) / 4), Pc = SECT.map(() => avg.slice());
  const cterms = decompose(Horig(Pc)).filter((t) => t.s !== "III");
  check("系数是数（四个扇区相同）时，原始 H 只剩 3 个泡利项，正是 A₁, A₂, A₃", cterms.length === 3 && cterms.every((t) => ALG_ORIG.includes(t.s)), { terms: cterms.map((t) => t.s) });
}

// 5. 动态电路：先测对称、再测 q₃，读数 p₀(v) + a(v)z 的平均正好是 ⟨ψ|H|ψ⟩
{
  const oc = outcomes(PRESET), E = exactE(PRESET);
  const sumP = oc.reduce((s, o) => s + o.pv, 0), mean = oc.reduce((s, o) => s + o.pv * (o.p0 + o.a * (2 * o.pUp - 1)), 0);
  check("各扇区概率之和为 1；按结果加权的平均等于 ⟨ψ|H|ψ⟩", Math.abs(sumP - 1) < 1e-12 && Math.abs(mean - E) < 1e-12, { exact: E, fromOutcomes: mean, sectorProbs: oc.map((o) => o.pv) });
  const var1 = oc.reduce((s, o) => s + o.pv * (o.pUp * (o.p0 + o.a - E) ** 2 + (1 - o.pUp) * (o.p0 - o.a - E) ** 2), 0);
  const rand = seeded(7), N = 200000; let s = 0;
  for (let i = 0; i < N; i++) s += shot(oc, rand).e;
  const se = Math.sqrt(var1 / N);
  check("20 万次模拟测量的平均落在 ⟨H⟩ ± 4 个标准误之内", Math.abs(s / N - E) < 4 * se, { mean: s / N, exact: E, standardError: se, singleShotVariance: var1 });
  // 单次读数的方差 = ⟨H²⟩ − ⟨H⟩²（同一组本征基里读数就是本征值）
  const H0 = Horig(PRESET), H2 = S.expect(mul(H0, H0), PSI);
  check("单次读数的方差等于 ⟨H²⟩ − ⟨H⟩²", Math.abs(var1 - (H2 - E * E)) < 1e-12, { variance: var1, fromH2: H2 - E * E });
}

// 6. 非上下文判定
{
  const cases = {
    ac: { S: ["XI", "YI", "ZX", "ZY", "ZZ"], nc: true, Z: 0, classes: 5 },
    fc: { S: ["XX", "YY", "ZZ"], nc: true, Z: 3, classes: 0 },
    nc: { S: ["ZZ", "XX", "YY", "ZI", "IZ"], nc: true, Z: 1, classes: 2 },
    ctx: { S: ["XI", "ZI", "IX", "IZ"], nc: false },
  };
  const res = Object.fromEntries(Object.entries(cases).map(([k, c]) => { const r = classify(c.S); return [k, { nc: r.nc, Z: r.Z.length, classes: r.classes.length, witness: r.witness && r.witness.map((i) => c.S[i]) }]; }));
  const ok = Object.entries(cases).every(([k, c]) => res[k].nc === c.nc && (!c.nc || (res[k].Z === c.Z && res[k].classes === c.classes)));
  check("判定器：反对易组、对易组、海森堡一对比特都是非上下文的；{X₁, Z₁, X₂, Z₂} 是上下文的", ok, { results: res });
  // 交叉检验：把两比特 15 个泡利串的全部 2^15 个子集都判一遍，与“对易图在 T 上是不相交团的并”逐一比较
  const all = allStrings(2).filter((s) => s !== "II"); let mismatch = 0, ncCount = 0;
  for (let mask = 1; mask < 1 << 15; mask++) {
    const Sx = all.filter((_, i) => mask & (1 << i)), r = classify(Sx);
    // 另一种判法：T 上任意两项，若有共同的对易邻居则必须对易
    const T = Sx.filter((s) => !Sx.every((t) => commutes(s, t)));
    let ok2 = true;
    for (const a of T) for (const c of T) if (a !== c && !commutes(a, c) && T.some((b) => b !== a && b !== c && commutes(a, b) && commutes(b, c))) ok2 = false;
    if (ok2 !== r.nc) mismatch++; if (r.nc) ncCount++;
  }
  check("两比特全部 32767 个子集：判定器与传递性定义一致", mismatch === 0, { nonContextualSubsets: ncCount, mismatch });
}

// 7. 式 (37)–(39)：海森堡型链
{
  const rows = [];
  let ok = true;
  for (let n = 2; n <= 6; n++) {
    const terms = chainTerms(n), N = 2 * n;
    if (terms.length !== 3 * (N - 1) + N) ok = false;
    const fc = chainGroups(n, "fc"), groups = [0, 1, 2].map((g) => fc.filter((t) => t.g === g).map((t) => t.s));
    const fcOK = groups.every((G) => G.every((a) => G.every((b) => commutes(a, b))));
    const put = (m) => { const a = Array(N).fill("I"); for (const [q, c] of m) a[q - 1] = c; return a.join(""); };
    const tri = [put([[1, "X"], [2, "X"]]), put([[2, "Y"], [3, "Y"]]), put([[2, "Z"]])];
    const triOK = !commutes(tri[0], tri[1]) && !commutes(tri[1], tri[2]) && !commutes(tri[0], tri[2]);
    const nc = chainGroups(n, "nc"), H1 = nc.filter((t) => t.g === 0), H2 = nc.filter((t) => t.g === 1).map((t) => t.s);
    const h2FC = H2.every((a) => H2.every((b) => commutes(a, b)));
    // H₁ 按比特对 (2i−1, 2i) 拆块：每块非上下文、作用在不相交的比特上
    const blocks = Array.from({ length: n }, (_, i) => H1.filter((t) => (t.kind === "bond" ? Math.ceil(t.i / 2) : Math.ceil(t.i / 2)) === i + 1).map((t) => t.s));
    const blockNC = blocks.every((B) => classify(B).nc && B.length === 5);
    const supp = blocks.map((B) => new Set(B.flatMap((s) => [...s].map((c, q) => (c !== "I" ? q : -1)).filter((q) => q >= 0))));
    const disjoint = supp.every((A, i) => supp.every((B, j) => i === j || [...A].every((q) => !B.has(q))));
    const wholeNC = classify(terms.map((t) => t.s)).nc, h1NC = classify(H1.map((t) => t.s)).nc;
    if (!(fcOK && triOK && h2FC && blockNC && disjoint && !wholeNC)) ok = false;
    rows.push({ n, qubits: N, terms: terms.length, fcSizes: groups.map((G) => G.length), ncSizes: [H1.length, H2.length], evenBonds: H2.length / 3, wholeNonContextual: wholeNC, H1NonContextualAsAWhole: h1NC });
  }
  check("链：三个 FC 片各自全对易；x₁x₂、y₂y₃、z₂ 两两反对易，所以 FC 至少要 3 片", ok, { table: rows });
  check("链：H₂（偶数键）全对易；H₁ 是 n 个作用在不相交比特对上的非上下文块之和；整个 H 不是非上下文的", ok);
  check("式 (39) 的求和上限：(37) 里偶数键只有 n − 1 条", rows.every((r) => r.evenBonds === r.n - 1), { evenBonds: rows.map((r) => [r.n, r.evenBonds]) });
  check("H₁ 作为一个整体（n ≥ 2）不是非上下文的：它靠“不相交块之和”可解", rows.every((r) => !r.H1NonContextualAsAWhole));
}

// 8. 费米子：在 2⁶ = 64 维福克空间里逐一核对式 (28)–(32)
{
  const N = 6, D = 1 << N;
  const RZ = () => new Float64Array(D * D);
  const rmul = (A, B) => { const C = RZ(); for (let i = 0; i < D; i++) for (let k = 0; k < D; k++) { const a = A[i * D + k]; if (!a) continue; for (let j = 0; j < D; j++) C[i * D + j] += a * B[k * D + j]; } return C; };
  const radd = (A, B, s = 1) => { const C = RZ(); for (let k = 0; k < D * D; k++) C[k] = A[k] + s * B[k]; return C; };
  const rT = (A) => { const C = RZ(); for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) C[j * D + i] = A[i * D + j]; return C; };
  const rapp = (A, v) => { const w = new Float64Array(D); for (let i = 0; i < D; i++) { let s = 0; for (let j = 0; j < D; j++) s += A[i * D + j] * v[j]; w[i] = s; } return w; };
  const rnorm = (A) => Math.sqrt(A.reduce((s, x) => s + x * x, 0));
  const occ = (b, p) => (b >> (N - 1 - p)) & 1;
  // 约当–维格纳：a_p = (Π_{q<p} Z_q) σ⁻_p
  const ann = Array.from({ length: N }, (_, p) => { const A = RZ(); for (let b = 0; b < D; b++) if (occ(b, p)) { let sg = 1; for (let q = 0; q < p; q++) if (occ(b, q)) sg = -sg; A[(b ^ (1 << (N - 1 - p))) * D + b] = sg; } return A; });
  const cre = ann.map(rT), num = ann.map((a, p) => rmul(cre[p], a));
  const hop = (i, j) => rmul(cre[i], ann[j]);
  const { h0, h1, h2, lam } = FERMI;
  let H = RZ();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const E = hop(i, j);
    if (h0[i][j]) H = radd(H, E, h0[i][j]);
    if (h1[i][j]) H = radd(H, rmul(num[4], E), h1[i][j]);
    if (h2[i][j]) H = radd(H, rmul(num[5], E), h2[i][j]);
  }
  for (let k = 0; k < 2; k++) for (let l = 0; l < 2; l++) H = radd(H, rmul(num[4 + k], num[4 + l]), lam[k][l]);
  const symH = rnorm(radd(H, rT(H), -1));
  const commN = Math.max(...[4, 5].flatMap((k) => [[0, 2], [1, 3], [3, 0]].map(([i, j]) => rnorm(radd(rmul(num[k], hop(i, j)), rmul(hop(i, j), num[k]), -1)))));
  const zz = Math.max(...[4, 5].map((k) => { const z = radd(scale2(num[k], 2), eye(), -1); return rnorm(radd(rmul(z, z), eye(), -1)); }));
  function eye() { const A = RZ(); for (let i = 0; i < D; i++) A[i * D + i] = 1; return A; }
  function scale2(A, s) { const C = RZ(); for (let k = 0; k < D * D; k++) C[k] = A[k] * s; return C; }
  check("福克空间：H 是实对称的；n_k（k ∈ S₂）与 a†_i a_j（i, j ∈ S₁）对易；z_k = 2n_k − 1 满足 z_k² = 1", symH < 1e-12 && commN < 1e-12 && zz < 1e-12, { symH, commN, zz });
  // 斯莱特行列式：S₂ 的占据 v，S₁ 里按 h(v) 的本征轨道放电子
  const states = [], energies = [];
  let worst = 0;
  for (const v of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const sec = fermiSector(v);
    for (let m = 0; m < 16; m++) {
      let st = new Float64Array(D); st[0] = 1;
      for (let k = 0; k < 2; k++) if (v[k]) st = rapp(cre[4 + k], st);
      let E = sec.e2;
      for (let o = 0; o < 4; o++) if (m & (1 << o)) {
        const b = RZ(); for (let i = 0; i < 4; i++) for (let k = 0; k < D * D; k++) b[k] += sec.orb[o][i] * cre[i][k];
        st = rapp(b, st); E += sec.gam[o];
      }
      const Hs = rapp(H, st); let res = 0; for (let i = 0; i < D; i++) res += (Hs[i] - E * st[i]) ** 2;
      worst = Math.max(worst, Math.sqrt(res)); states.push(st); energies.push(E);
    }
  }
  let gram = 0;
  for (let a = 0; a < 64; a++) for (let b = 0; b < 64; b++) { let s = 0; for (let i = 0; i < D; i++) s += states[a][i] * states[b][i]; gram = Math.max(gram, Math.abs(s - (a === b ? 1 : 0))); }
  check("64 个斯莱特行列式（4 个 v × S₁ 上 16 种占据）都是 H 的本征态，本征值 Σγ_m n_m + Σλ_kl v_k v_l", worst < 1e-10, { maxResidual: worst });
  check("这 64 个态正交归一，正好是整个福克空间的一组本征基", gram < 1e-10, { maxGramError: gram });
  // 外面再套一个随机轨道转动 U_T（六个轨道全混）：本征态变成 U_T† Φ，能量不变
  let K = RZ();
  for (let p = 0; p < N; p++) for (let q = p + 1; q < N; q++) { const k = 0.6 * r1(); K = radd(K, radd(hop(p, q), hop(q, p), -1), k); }
  const expR = (A) => { let s = 0, a = rnorm(A); while (a > 0.5) { a /= 2; s++; } const B = scale2(A, 2 ** -s); let term = eye(), sum = eye(); for (let k = 1; k <= 18; k++) { term = scale2(rmul(term, B), 1 / k); sum = radd(sum, term); } for (let i = 0; i < s; i++) sum = rmul(sum, sum); return sum; };
  const U = expR(K), Hp = rmul(rmul(rT(U), H), U);
  let worstT = 0;
  for (let a = 0; a < 64; a += 5) { const st = rapp(rT(U), states[a]), Hs = rapp(Hp, st); let res = 0; for (let i = 0; i < D; i++) res += (Hs[i] - energies[a] * st[i]) ** 2; worstT = Math.max(worstT, Math.sqrt(res)); }
  check("套上随机轨道转动 U_T 后，U_T† Φ 仍是本征态、能量不变（式 28）", worstT < 1e-9, { maxResidual: worstT });
  // 不同扇区的轨道不同：最低两条轨道张成的子空间之间的重叠
  const sec = [[0, 0], [0, 1], [1, 0], [1, 1]].map((v) => fermiSector(v));
  const ovl = (A, B) => { const M = [0, 1].map((a) => [0, 1].map((b) => A.orb[a].reduce((s, x, i) => s + x * B.orb[b][i], 0))); return Math.abs(M[0][0] * M[1][1] - M[0][1] * M[1][0]); };
  const table = sec.map((s) => ({ v: s.v.join(""), gamma: s.gam.map((g) => +g.toFixed(4)), e2: s.e2, overlapWith00: +ovl(sec[0], s).toFixed(4) }));
  check("四个扇区的轨道各不相同：最低两条轨道张成的子空间与 v = 00 的重叠都小于 1", table.slice(1).every((r) => r.overlapWith00 < 0.995), { table });
}

// 9. 论文表 I、表 II 的算术
{
  const t1 = { H2: [15, 11, 2, 1, 1], LiH: [631, 110, 42, 34, 31], BeH2: [666, 134, 36, 33, 29], H2O: [1086, 156, 50, 49, 40], NH3: [3609, 324, 122, 148, 101] };
  const red = Object.fromEntries(Object.entries(t1).map(([k, r]) => [k, +(1 - r[4] / r[2]).toFixed(3)]));
  const ncBeatsFC = Object.entries(t1).filter(([, r]) => r[3] < r[2]).map(([k]) => k);
  const avg = (red.LiH + red.BeH2 + red.H2O + red.NH3) / 4;
  check("表 I：除 NH₃ 外 NC < FC；FNC 比 FC 少约 20%（LiH–NH₃ 平均）", ncBeatsFC.join() === "H2,LiH,BeH2,H2O" && Math.abs(avg - 0.2) < 0.03 && Object.values(t1).every((r) => r[4] <= r[3] && r[4] <= r[2]), { fncReduction: red, averageLiHtoNH3: avg });
  const t2 = { H2: [3, 4, 15], H4: [15, 8, 20], LiH: [24, 20, 58], BeH2: [32, 23, 83], H2O: [34, 24, 102], NH3: [47, 28, 61] };
  check("表 II：GFRO 与 LR 在六个体系上都比 GMF(N/2) 少", Object.values(t2).every((r) => r[0] < r[2] && r[1] < r[2]), { ratioGMFoverGFRO: Object.fromEntries(Object.entries(t2).map(([k, r]) => [k, +(r[2] / r[0]).toFixed(2)])) });
}

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(here, "..", "verification.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), script: "source/verify.mjs", passed: checks.length - failed.length, failed: failed.length, checks }, null, 2) + "\n");
for (const c of checks) console.log((c.ok ? "ok   " : "FAIL ") + c.name);
if (failed.length) { console.error(`${failed.length} 条没通过`); process.exit(1); }
console.log(`全部 ${checks.length} 条通过`);
