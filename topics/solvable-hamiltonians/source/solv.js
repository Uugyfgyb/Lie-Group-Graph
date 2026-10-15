/* solv.js — 页面与 verify.mjs 共用的数：复矩阵、泡利串、so(L+1) 的逐次转动（式 20–21）、
   三比特例子（U_T、分块、对角化、动态电路）、费米子平均场例子、海森堡链的分组、非上下文判定。无依赖。 */
const Solv = (() => {
  "use strict";
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ── 复矩阵 {n, re, im}，行优先 ── */
  const Z = (n) => ({ n, re: new Float64Array(n * n), im: new Float64Array(n * n) });
  const I = (n) => { const A = Z(n); for (let i = 0; i < n; i++) A.re[i * n + i] = 1; return A; };
  const mul = (A, B) => {
    const n = A.n, C = Z(n);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const ar = A.re[i * n + k], ai = A.im[i * n + k]; if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) { const br = B.re[k * n + j], bi = B.im[k * n + j]; C.re[i * n + j] += ar * br - ai * bi; C.im[i * n + j] += ar * bi + ai * br; }
    }
    return C;
  };
  /* aA + bB，a、b 是复数 [re, im] */
  const lin = (A, a, B, b) => {
    const C = Z(A.n);
    for (let k = 0; k < A.re.length; k++) {
      C.re[k] = a[0] * A.re[k] - a[1] * A.im[k] + b[0] * B.re[k] - b[1] * B.im[k];
      C.im[k] = a[0] * A.im[k] + a[1] * A.re[k] + b[0] * B.im[k] + b[1] * B.re[k];
    }
    return C;
  };
  const add = (A, B) => lin(A, [1, 0], B, [1, 0]);
  const sub = (A, B) => lin(A, [1, 0], B, [-1, 0]);
  const scale = (A, a) => lin(A, typeof a === "number" ? [a, 0] : a, A, [0, 0]);
  const dag = (A) => { const n = A.n, C = Z(n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { C.re[j * n + i] = A.re[i * n + j]; C.im[j * n + i] = -A.im[i * n + j]; } return C; };
  const kron = (A, B) => {
    const n = A.n * B.n, C = Z(n);
    for (let i = 0; i < A.n; i++) for (let j = 0; j < A.n; j++) {
      const ar = A.re[i * A.n + j], ai = A.im[i * A.n + j]; if (ar === 0 && ai === 0) continue;
      for (let k = 0; k < B.n; k++) for (let l = 0; l < B.n; l++) {
        const br = B.re[k * B.n + l], bi = B.im[k * B.n + l], r = i * B.n + k, c = j * B.n + l;
        C.re[r * n + c] = ar * br - ai * bi; C.im[r * n + c] = ar * bi + ai * br;
      }
    }
    return C;
  };
  const norm = (A) => { let s = 0; for (let k = 0; k < A.re.length; k++) s += A.re[k] ** 2 + A.im[k] ** 2; return Math.sqrt(s); };
  const conj = (U, H) => mul(mul(U, H), dag(U)); // U H U†
  const get = (A, i, j) => [A.re[i * A.n + j], A.im[i * A.n + j]];
  const fromRows = (rows) => { const n = rows.length, A = Z(n); rows.forEach((r, i) => r.forEach((z, j) => { const [a, b] = typeof z === "number" ? [z, 0] : z; A.re[i * n + j] = a; A.im[i * n + j] = b; })); return A; };
  /* exp(A)：缩小 2ˢ 倍后用泰勒级数，再平方 s 次 */
  const expm = (A) => {
    let s = 0, a = norm(A); while (a > 0.5) { a /= 2; s++; }
    const B = scale(A, 2 ** -s); let term = I(A.n), sum = I(A.n);
    for (let k = 1; k <= 20; k++) { term = scale(mul(term, B), 1 / k); sum = add(sum, term); }
    for (let i = 0; i < s; i++) sum = mul(sum, sum);
    return sum;
  };
  /* 向量 {re, im} */
  const vec = (n) => ({ re: new Float64Array(n), im: new Float64Array(n) });
  const apply = (A, v) => {
    const n = A.n, w = vec(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const ar = A.re[i * n + j], ai = A.im[i * n + j]; w.re[i] += ar * v.re[j] - ai * v.im[j]; w.im[i] += ar * v.im[j] + ai * v.re[j]; }
    return w;
  };
  const expect = (A, v) => { const w = apply(A, v); let s = 0; for (let i = 0; i < A.n; i++) s += v.re[i] * w.re[i] + v.im[i] * w.im[i]; return s; }; // 厄米时为实数

  /* ── 泡利串：第一个字母是第 1 个比特（二进制最高位） ── */
  const P1 = { I: fromRows([[1, 0], [0, 1]]), X: fromRows([[0, 1], [1, 0]]), Y: fromRows([[0, [0, -1]], [[0, 1], 0]]), Z: fromRows([[1, 0], [0, -1]]) };
  const pauli = (s) => [...s].map((c) => P1[c]).reduce((A, B) => kron(A, B));
  const PM = { II: [0, "I"], IX: [0, "X"], IY: [0, "Y"], IZ: [0, "Z"], XI: [0, "X"], YI: [0, "Y"], ZI: [0, "Z"], XX: [0, "I"], YY: [0, "I"], ZZ: [0, "I"], XY: [1, "Z"], YZ: [1, "X"], ZX: [1, "Y"], YX: [3, "Z"], ZY: [3, "X"], XZ: [3, "Y"] };
  /* 乘积 s·t = i^k · 串 */
  const pmul = (s, t) => { let k = 0, out = ""; for (let q = 0; q < s.length; q++) { const [kk, c] = PM[s[q] + t[q]]; k += kk; out += c; } return { k: k % 4, s: out }; };
  /* 对易 ⇔ 两串在“都不是 I 且字母不同”的位置上个数为偶 */
  const commutes = (s, t) => { let m = 0; for (let q = 0; q < s.length; q++) if (s[q] !== "I" && t[q] !== "I" && s[q] !== t[q]) m++; return m % 2 === 0; };
  /* 泡利展开：c_P = tr(P M) / 2ⁿ */
  const allStrings = (nq) => { let out = [""]; for (let q = 0; q < nq; q++) out = out.flatMap((s) => ["I", "X", "Y", "Z"].map((c) => s + c)); return out; };
  const decompose = (M, eps = 1e-12) => {
    const nq = Math.round(Math.log2(M.n)), out = [];
    for (const s of allStrings(nq)) {
      const P = pauli(s); let re = 0, im = 0;
      for (let i = 0; i < M.n; i++) for (let j = 0; j < M.n; j++) { const pr = P.re[i * M.n + j], pi = P.im[i * M.n + j]; if (pr === 0 && pi === 0) continue; const mr = M.re[j * M.n + i], mi = M.im[j * M.n + i]; re += pr * mr - pi * mi; im += pr * mi + pi * mr; }
      re /= M.n; im /= M.n;
      if (Math.hypot(re, im) > eps) out.push({ s, c: [re, im] });
    }
    return out;
  };

  /* ── 式 (20)(21)：把 Σ p_i A_i 逐次转到 a·A_L ──
     第 j 步用 exp(θ_j A_L A_j / 2)，它只在 (A_j, A_L) 平面里转系数：
       p_j → p_j cos θ − p_L sin θ，p_L → p_j sin θ + p_L cos θ。
     θ_1 = atan2(p_1, p_L)；之后 θ_j = atan2(p_j, r_{j−1})，r_j = √(r_{j−1}² + p_j²)；a = r_{L−1} ≥ 0。
     乘积顺序：j = 1 先作用，写在最右边。 */
  const givens = (p) => {
    const L = p.length, th = []; let r = p[L - 1];
    for (let j = 0; j < L - 1; j++) { th.push(Math.atan2(p[j], r)); r = Math.hypot(r, p[j]); }
    return { th, a: r };
  };
  /* 转到一半：t ∈ [0, L−1]，第 j 段走完 θ_j */
  const rotCoef = (p, th, t) => {
    const c = p.slice(), L = p.length;
    for (let j = 0; j < L - 1; j++) {
      const f = clamp(t - j, 0, 1); if (f <= 0) break;
      const a = th[j] * f, cj = c[j], cL = c[L - 1];
      c[j] = cj * Math.cos(a) - cL * Math.sin(a); c[L - 1] = cj * Math.sin(a) + cL * Math.cos(a);
    }
    return c;
  };
  /* 算符形式 U(t) = R_{L−1} ⋯ R_1，R_j = cos(θ_j/2) + sin(θ_j/2) A_L A_j（A 是矩阵列表） */
  const givensOp = (A, th, t = A.length - 1) => {
    const L = A.length, n = A[0].n; let U = I(n);
    for (let j = 0; j < L - 1; j++) {
      const f = clamp(t - j, 0, 1); if (f <= 0) break;
      const h = (th[j] * f) / 2, R = lin(I(n), [Math.cos(h), 0], mul(A[L - 1], A[j]), [Math.sin(h), 0]);
      U = mul(R, U);
    }
    return U;
  };

  /* ── 对称群 Z₂ × Z₂：四个扇区 v = (v₁, v₂) 与四个单项式 1, z₁, z₂, z₁z₂ ── */
  const SECT = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const SLAB = ["++", "+−", "−+", "−−"];
  const mono = (v, m) => (m === 0 ? 1 : m === 1 ? v[0] : m === 2 ? v[1] : v[0] * v[1]);
  /* 扇区上的值 ↔ 多项式系数（沃尔什–阿达马变换，正交矩阵的 ¼ 倍） */
  const toPoly = (vals) => [0, 1, 2, 3].map((m) => SECT.reduce((s, v, k) => s + mono(v, m) * vals[k], 0) / 4);
  const fromPoly = (c) => SECT.map((v) => c.reduce((s, cm, m) => s + cm * mono(v, m), 0));

  /* ── 三比特例子 ──
     U_T 之后：对称 z₁ = Z₁、z₂ = Z₂，反对易组 A′ = (X₃, Y₃, Z₃)。
     原始基里：C₁ = Z₁Z₃、C₂ = Z₂Z₃，A = (X₁X₂X₃, X₁X₂Y₃, Z₃)，即三比特翻转码的逻辑比特；U_T = CNOT(3→2)·CNOT(3→1)。
     P 是四个扇区各一组 [p₁, p₂, p₃, p₀]。 */
  const MONO = ["III", "ZII", "IZI", "ZZI"], ALG = ["IIX", "IIY", "IIZ"];
  const SYM_ORIG = ["ZIZ", "IZZ"], ALG_ORIG = ["XXX", "XXY", "IIZ"];
  const termsT = (P) => {
    const out = [];
    for (let i = 0; i < 3; i++) { const c = toPoly(P.map((x) => x[i])); c.forEach((cm, m) => out.push({ s: MONO[m].slice(0, 2) + ALG[i][2], c: cm })); }
    toPoly(P.map((x) => x[3])).forEach((cm, m) => out.push({ s: MONO[m], c: cm }));
    return out;
  };
  const fromTerms = (terms, nq) => terms.reduce((H, t) => add(H, scale(pauli(t.s), typeof t.c === "number" ? [t.c, 0] : t.c)), Z(2 ** nq));
  const HT = (P) => fromTerms(termsT(P), 3);
  const cnot = (c, t, nq = 3) => {
    const n = 2 ** nq, A = Z(n), bc = nq - c, bt = nq - t;
    for (let b = 0; b < n; b++) { const to = (b >> bc) & 1 ? b ^ (1 << bt) : b; A.re[to * n + b] = 1; }
    return A;
  };
  const UT = mul(cnot(3, 2), cnot(3, 1));
  /* 连续的路：CNOT = exp(iπQ)，Q = (1 − Z_c)(1 − X_t)/4 是投影；两个 CNOT 控制位相同，可交换 */
  const Qct = (c, t) => { const s = (k, ch) => "III".split("").map((x, q) => (q === k - 1 ? ch : x)).join(""); return scale(mul(sub(I(8), pauli(s(c, "Z"))), sub(I(8), pauli(s(t, "X")))), 0.25); };
  const Q31 = Qct(3, 1), Q32 = Qct(3, 2);
  const UTs = (s) => { const e = [Math.cos(Math.PI * s) - 1, Math.sin(Math.PI * s)]; return mul(lin(I(8), [1, 0], Q32, e), lin(I(8), [1, 0], Q31, e)); };
  const Horig = (P) => mul(mul(dag(UT), HT(P)), UT);
  /* 每个扇区的转动角与 a(v) */
  const sectorRot = (P) => P.map((x) => givens(x.slice(0, 3)));
  const A1q = [P1.X, P1.Y, P1.Z];
  /* V(t) = Σ_v P_v ⊗ U_v(t)，t ∈ [0, 2] */
  const Vt = (P, t) => {
    const rots = sectorRot(P), V = Z(8);
    rots.forEach((r, k) => { const U = givensOp(A1q, r.th, t); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { V.re[(2 * k + i) * 8 + 2 * k + j] = U.re[i * 2 + j]; V.im[(2 * k + i) * 8 + 2 * k + j] = U.im[i * 2 + j]; } });
    return V;
  };
  /* 进度 s ∈ [0, 3]：0 原始 H；1 经 U_T 分块；2 第一步转动；3 对角 */
  const stageMatrix = (P, s, H0 = Horig(P)) => {
    const W = s <= 1 ? UTs(s) : mul(Vt(P, s - 1), UT);
    return conj(W, H0);
  };
  const offBlock = (M) => { let s = 0; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (i >> 1 !== j >> 1) s += M.re[i * 8 + j] ** 2 + M.im[i * 8 + j] ** 2; return Math.sqrt(s); };
  const offDiag = (M) => { let s = 0; for (let i = 0; i < M.n; i++) for (let j = 0; j < M.n; j++) if (i !== j) s += M.re[i * M.n + j] ** 2 + M.im[i * M.n + j] ** 2; return Math.sqrt(s); };

  /* 动态电路：试探态 ψ（固定种子），测 q₁q₂ 得 v，经典算出 U_v，再测 q₃ 得 z；读数 e = p₀(v) + a(v)·z */
  const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
  const PSI = (() => { const r = seeded(2305182), v = vec(8); let s = 0; for (let i = 0; i < 8; i++) { v.re[i] = r() * 2 - 1; v.im[i] = r() * 2 - 1; s += v.re[i] ** 2 + v.im[i] ** 2; } for (let i = 0; i < 8; i++) { v.re[i] /= Math.sqrt(s); v.im[i] /= Math.sqrt(s); } return v; })();
  const outcomes = (P, psi = PSI) => {
    const phi = apply(UT, psi), rots = sectorRot(P);
    return rots.map((r, k) => {
      const blk = { re: Float64Array.from([phi.re[2 * k], phi.re[2 * k + 1]]), im: Float64Array.from([phi.im[2 * k], phi.im[2 * k + 1]]) };
      const pv = blk.re[0] ** 2 + blk.im[0] ** 2 + blk.re[1] ** 2 + blk.im[1] ** 2;
      const out = apply(givensOp(A1q, r.th), blk), up = out.re[0] ** 2 + out.im[0] ** 2;
      return { k, pv, pUp: pv > 0 ? up / pv : 0.5, a: r.a, p0: P[k][3], th: r.th };
    });
  };
  const exactE = (P, psi = PSI) => expect(Horig(P), psi);
  const shot = (oc, rand) => {
    let u = rand(), k = 0; while (k < 3 && u > oc[k].pv) { u -= oc[k].pv; k++; }
    const z = rand() < oc[k].pUp ? 1 : -1;
    return { k, z, e: oc[k].p0 + oc[k].a * z };
  };

  /* ── 非上下文判定（式 16 前的定义） ──
     Z：与集合里所有项对易的项；T：其余。T 上“对易”必须是等价关系：凡 a~b、b~c 就要 a~c。
     返回 Z、对易类、以及违反传递性的三元组（若有）。 */
  const classify = (S) => {
    const C = (i, j) => commutes(S[i], S[j]), Zs = [], T = [];
    S.forEach((_, i) => (S.every((__, j) => C(i, j)) ? Zs : T).push(i));
    let witness = null;
    outer: for (const b of T) for (const a of T) for (const c of T) if (a !== b && b !== c && a !== c && C(a, b) && C(b, c) && !C(a, c)) { witness = [a, b, c]; break outer; }
    const classes = [], seen = new Set();
    for (const i of T) {
      if (seen.has(i)) continue;
      const comp = [i]; seen.add(i);
      for (let q = 0; q < comp.length; q++) for (const j of T) if (!seen.has(j) && C(comp[q], j)) { seen.add(j); comp.push(j); }
      classes.push(comp);
    }
    return { nc: !witness, Z: Zs, classes, witness };
  };
  /* 附录 B：每类取第一个作代表 A_i，C_ij = A_ij A_i；Z ∪ {C_ij} 生成对称群，生成元个数 K = GF(2) 秩 */
  const bits = (s) => [...s].map((c) => (c === "X" || c === "Y" ? 1 : 0)).concat([...s].map((c) => (c === "Z" || c === "Y" ? 1 : 0)));
  const rank2 = (rows) => {
    const M = rows.map((r) => r.slice()); let rk = 0;
    for (let c = 0; c < (M[0] || []).length && rk < M.length; c++) {
      const p = M.findIndex((r, i) => i >= rk && r[c]); if (p < 0) continue;
      [M[rk], M[p]] = [M[p], M[rk]];
      for (let i = 0; i < M.length; i++) if (i !== rk && M[i][c]) M[i] = M[i].map((x, k) => x ^ M[rk][k]);
      rk++;
    }
    return rk;
  };
  const symmetryGroup = (S, cls = classify(S)) => {
    if (!cls.nc) return null;
    const gens = cls.Z.map((i) => S[i]);
    for (const c of cls.classes) for (const j of c.slice(1)) gens.push(pmul(S[j], S[c[0]]).s);
    const nonId = gens.filter((g) => /[XYZ]/.test(g));
    return { reps: cls.classes.map((c) => S[c[0]]), gens: nonId, K: nonId.length ? rank2(nonId.map(bits)) : 0 };
  };

  /* ── 式 (37)–(39)：海森堡型链，2n 个比特 ── */
  const put = (len, map) => { const a = Array(len).fill("I"); for (const [q, c] of map) a[q - 1] = c; return a.join(""); };
  const chainTerms = (n) => {
    const N = 2 * n, out = [];
    for (let i = 1; i <= N - 1; i++) for (const c of "XYZ") out.push({ s: put(N, [[i, c], [i + 1, c]]), kind: "bond", i, c });
    for (let j = 1; j <= N; j++) out.push({ s: put(N, [[j, "Z"]]), kind: "field", i: j, c: "Z" });
    return out;
  };
  /* FC：奇数键、偶数键、全部 z 场，三片；NC（论文的分法）：H₁ = 奇数键 + 全部 z 场，H₂ = 偶数键 */
  const chainGroups = (n, mode) => chainTerms(n).map((t) => ({ ...t, g: mode === "fc" ? (t.kind === "field" ? 2 : t.i % 2 ? 0 : 1) : t.kind === "field" || t.i % 2 ? 0 : 1 }));

  /* ── 费米子平均场例子：S₁ = 四个轨道（一条链），S₂ = 两个轨道 ──
     h(v) = h⁽⁰⁾ + v₁ h⁽¹⁾ + v₂ h⁽²⁾（v_k = 0, 1 是 S₂ 轨道的占据数）；S₂ 上的能量 Σ λ_kl v_k v_l。
     h⁽⁰⁾ 是常数项：式 (28) 只写了一次项，零次项就是普通的单体哈密顿量，加进来同样可解。 */
  const FERMI = {
    h0: [[0, -1, 0, 0], [-1, 0, -1, 0], [0, -1, 0, -1], [0, 0, -1, 0]],
    h1: [[1.6, 0, 0, 0], [0, 0.6, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    h2: [[0, 0, 0, 0], [0, 0, 0.8, 0], [0, 0.8, 0, 0], [0, 0, 0, 0.5]],
    lam: [[0.4, 0.25], [0.25, 0.3]],
  };
  const hOf = (v, F = FERMI) => F.h0.map((r, i) => r.map((x, j) => x + v[0] * F.h1[i][j] + v[1] * F.h2[i][j]));
  const eS2 = (v, F = FERMI) => F.lam.reduce((s, r, k) => s + r.reduce((t, x, l) => t + x * v[k] * v[l], 0), 0);
  /* 实对称矩阵的雅可比本征分解；本征值升序，本征向量是列，第一个不为零的分量取正 */
  const eigh = (A0) => {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A0.map((_, i) => A0.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = A.map((_, i) => i).sort((a, b) => A[a][a] - A[b][b]);
    const vals = idx.map((i) => A[i][i]), vecs = idx.map((i) => V.map((r) => r[i]));
    for (const w of vecs) { const f = w.find((x) => Math.abs(x) > 1e-9) || 1; if (f < 0) for (let k = 0; k < n; k++) w[k] = -w[k]; }
    return { vals, vecs }; // vecs[m] 是第 m 个轨道在四个格点上的系数
  };
  const fermiSector = (v, F = FERMI) => { const { vals, vecs } = eigh(hOf(v, F)); return { v, gam: vals, orb: vecs, e2: eS2(v, F) }; };

  return { clamp, Z, I, mul, lin, add, sub, scale, dag, kron, norm, conj, get, fromRows, expm, vec, apply, expect, P1, pauli, pmul, commutes, allStrings, decompose, givens, rotCoef, givensOp, SECT, SLAB, mono, toPoly, fromPoly, MONO, ALG, SYM_ORIG, ALG_ORIG, termsT, fromTerms, HT, cnot, UT, UTs, Horig, sectorRot, A1q, Vt, stageMatrix, offBlock, offDiag, seeded, PSI, outcomes, exactE, shot, classify, bits, rank2, symmetryGroup, chainTerms, chainGroups, FERMI, hOf, eS2, eigh, fermiSector };
})();
