/* frag.js — 页面与 verify.mjs 共用的数。无依赖。
   泡利串代数；反相容图（连通分量、团、Krausz 分解求根图、孪生类与无孪生商图）和九种可解类判据；排序插入；
   so(N) 的马约拉纳标准形与吉文斯分解；H₂ / STO-3G 的积分、Jordan–Wigner 与 Bravyi–Kitaev 哈密顿量；碎片方差。 */
const Frag = (() => {
  "use strict";
  const pc = (v) => { let c = 0; while (v) { v &= v - 1; c++; } return c; };
  const SUB = "₀₁₂₃₄₅₆₇₈₉";

  /* ── 泡利串：x、z 两个位掩码，第 q 位对应第 q 个量子比特；P(x,z) = i^{x·z} X^x Z^z（Y = iXZ）── */
  const parse = (s) => { let x = 0, z = 0; [...s].forEach((c, q) => { if (c === "X" || c === "Y") x |= 1 << q; if (c === "Z" || c === "Y") z |= 1 << q; }); return { x, z }; };
  const str = (p, n) => Array.from({ length: n }, (_, q) => { const a = (p.x >> q) & 1, b = (p.z >> q) & 1; return a ? (b ? "Y" : "X") : (b ? "Z" : "I"); }).join("");
  /* 带下标的写法：X₀Z₁X₂；恒等算符写 I */
  const sub = (p, n) => { const s = str(p, n); let o = ""; for (let q = 0; q < n; q++) if (s[q] !== "I") o += s[q] + SUB[q]; return o || "I"; };
  const key = (p) => p.x * 65536 + p.z;
  const same = (a, b) => a.x === b.x && a.z === b.z;
  const isId = (p) => p.x === 0 && p.z === 0;
  const commutes = (a, b) => (pc((a.x & b.z) ^ (a.z & b.x)) & 1) === 0;
  const nY = (p) => pc(p.x & p.z);
  const isSym = (p) => (nY(p) & 1) === 0; // 计算基下的矩阵是实对称的（Y 的个数为偶）
  /* 乘积 a·b = i^k c */
  const mul = (a, b) => {
    const x = a.x ^ b.x, z = a.z ^ b.z;
    const k = (((nY(a) + nY(b) + 2 * pc(a.z & b.x) - pc(x & z)) % 4) + 4) % 4;
    return { p: { x, z }, k };
  };
  const IPOW = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  /* ── 稠密复矩阵 {n, re, im}，行优先 ── */
  const zeros = (n) => ({ n, re: new Float64Array(n * n), im: new Float64Array(n * n) });
  const eye = (n) => { const A = zeros(n); for (let i = 0; i < n; i++) A.re[i * n + i] = 1; return A; };
  const cmul = (A, B) => {
    const n = A.n, C = zeros(n);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const ar = A.re[i * n + k], ai = A.im[i * n + k]; if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < n; j++) { const br = B.re[k * n + j], bi = B.im[k * n + j]; C.re[i * n + j] += ar * br - ai * bi; C.im[i * n + j] += ar * bi + ai * br; }
    }
    return C;
  };
  const dag = (A) => { const n = A.n, C = zeros(n); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { C.re[j * n + i] = A.re[i * n + j]; C.im[j * n + i] = -A.im[i * n + j]; } return C; };
  const axpy = (A, a, B) => { const C = zeros(A.n); for (let k = 0; k < A.re.length; k++) { C.re[k] = A.re[k] + a * B.re[k]; C.im[k] = A.im[k] + a * B.im[k]; } return C; };
  const fro = (A) => { let s = 0; for (let k = 0; k < A.re.length; k++) s += A.re[k] ** 2 + A.im[k] ** 2; return Math.sqrt(s); };
  const conjBy = (U, H) => cmul(cmul(U, H), dag(U));

  /* 泡利串的矩阵：P|b⟩ = i^{nY} (−1)^{popcount(z∧b)} |b⊕x⟩ */
  function pauliMat(p, n, c = 1, M = null) {
    const d = 1 << n; M = M || zeros(d);
    const [pr, pi] = IPOW[nY(p) & 3];
    for (let b = 0; b < d; b++) { const s = (pc(p.z & b) & 1) ? -c : c, r = b ^ p.x; M.re[r * d + b] += s * pr; M.im[r * d + b] += s * pi; }
    return M;
  }
  /* 泡利和 [{p, c}]（c 为实数）的矩阵 */
  const sumMat = (terms, n) => { const M = zeros(1 << n); for (const t of terms) pauliMat(t.p, n, t.c, M); return M; };
  /* 厄米矩阵按泡利串展开：c_P = Tr(P H)/2ⁿ（实数）；|c| < tol 的丢掉 */
  function decompose(H, n, tol = 1e-12) {
    const d = 1 << n, out = [];
    for (let x = 0; x < d; x++) for (let z = 0; z < d; z++) {
      const p = { x, z }, [pr, pi] = IPOW[nY(p) & 3];
      let re = 0;
      for (let b = 0; b < d; b++) { // Tr(P H) = Σ_b ⟨b|P H|b⟩ = Σ_b Σ_r P_{b r} H_{r b}；P 的第 b 行只在 r = b⊕x 处非零
        const r = b ^ p.x, s = (pc(p.z & r) & 1) ? -1 : 1; // P_{b r} = i^{nY} (−1)^{z·r}
        const hr = H.re[r * d + b], hi = H.im[r * d + b];
        re += s * (pr * hr - pi * hi);
      }
      const c = re / d;
      if (Math.abs(c) > tol) out.push({ p, c });
    }
    return out;
  }

  /* ── 实对称矩阵的雅可比本征分解：返回升序的本征值和对应的列向量 ── */
  function eigSym(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A0.map((_, i) => A0.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-30) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [...Array(n).keys()].sort((a, b) => A[a][a] - A[b][b]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((r) => r[i])) };
  }
  /* 复厄米矩阵的本征值：嵌入成 2n 阶实对称矩阵 [[Re, −Im], [Im, Re]]，每个本征值出现两次，隔一个取一个 */
  function eigHerm(H) {
    const n = H.n, R = Array.from({ length: 2 * n }, () => new Array(2 * n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = H.re[i * n + j], b = H.im[i * n + j];
      R[i][j] = a; R[i + n][j + n] = a; R[i][j + n] = -b; R[i + n][j] = b;
    }
    const e = eigSym(R);
    return { values: e.values.filter((_, k) => k % 2 === 0), vectors: e.vectors.filter((_, k) => k % 2 === 0).map((v) => ({ re: v.slice(0, n), im: v.slice(n) })) };
  }
  /* ⟨ψ|M|ψ⟩（ψ = {re, im}，M 厄米时结果为实数） */
  function expect(M, psi) {
    const n = M.n; let s = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const mr = M.re[i * n + j], mi = M.im[i * n + j]; if (mr === 0 && mi === 0) continue;
      const wr = mr * psi.re[j] - mi * psi.im[j], wi = mr * psi.im[j] + mi * psi.re[j];
      s += psi.re[i] * wr + psi.im[i] * wi;
    }
    return s;
  }
  const variance = (M, psi) => { const m = expect(M, psi); return Math.max(0, expect(cmul(M, M), psi) - m * m); };

  /* ── 图：邻接矩阵（布尔），顶点 0…n−1；反相容图 = 两项反对易就连一条边 ── */
  const graphOf = (ps) => ps.map((a, i) => ps.map((b, j) => i !== j && !commutes(a, b)));
  const graphFromEdges = (n, edges) => { const A = Array.from({ length: n }, () => new Array(n).fill(false)); for (const [i, j] of edges) { A[i][j] = A[j][i] = true; } return A; };
  const edgesOf = (A, vs = [...A.keys()]) => { const E = []; for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) if (A[vs[a]][vs[b]]) E.push([vs[a], vs[b]]); return E; };
  function components(A, vs = [...A.keys()]) {
    const inSet = new Set(vs), seen = new Set(), out = [];
    for (const s of vs) {
      if (seen.has(s)) continue;
      const comp = [], st = [s]; seen.add(s);
      while (st.length) { const v = st.pop(); comp.push(v); for (const w of vs) if (A[v][w] && inSet.has(w) && !seen.has(w)) { seen.add(w); st.push(w); } }
      out.push(comp.sort((a, b) => a - b));
    }
    return out;
  }
  const isClique = (A, vs) => vs.every((a, i) => vs.every((b, j) => i === j || A[a][b]));
  const noEdges = (A, vs) => vs.every((a) => vs.every((b) => !A[a][b]));

  /* Krausz 分解：把边集分成若干个团，使每条边恰在一个团里、每个点至多属于两个团。
     找到就返回团的列表（每个团是顶点数组，大小 ≥ 2），找不到返回 null；budget 防止病态图跑太久（超出返回 undefined）。 */
  function krausz(A, vs = [...A.keys()], budget = 200000) {
    const E = edgesOf(A, vs), ek = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
    const cov = new Set(), cnt = new Map(vs.map((v) => [v, 0])), cliques = [];
    let steps = 0;
    const freeNbrs = (v) => vs.filter((w) => w !== v && A[v][w] && !cov.has(ek(v, w)));
    function rec() {
      if (++steps > budget) throw new Error("budget");
      const e = E.find(([a, b]) => !cov.has(ek(a, b)));
      if (!e) return true;
      const [u, v] = e;
      if (cnt.get(u) >= 2 || cnt.get(v) >= 2) return false;
      const cand = vs.filter((w) => w !== u && w !== v && A[u][w] && A[v][w] && !cov.has(ek(u, w)) && !cov.has(ek(v, w)) && cnt.get(w) < 2);
      // 若 u（或 v）已经用掉一个团，这个团就是它的最后一个，必须收下它全部未覆盖的邻居
      const must = new Set();
      for (const x of [u, v]) if (cnt.get(x) === 1) for (const w of freeNbrs(x)) if (w !== u && w !== v) must.add(w);
      for (const w of must) if (!cand.includes(w)) return false;
      const opt = cand.filter((w) => !must.has(w));
      const subsets = [];
      for (let m = (1 << opt.length) - 1; m >= 0; m--) subsets.push(opt.filter((_, i) => (m >> i) & 1));
      subsets.sort((a, b) => b.length - a.length);
      for (const extra of subsets) {
        const K = [u, v, ...must, ...extra];
        let ok = true;
        for (let i = 0; i < K.length && ok; i++) for (let j = i + 1; j < K.length && ok; j++) if (!A[K[i]][K[j]] || cov.has(ek(K[i], K[j]))) ok = false;
        if (!ok) continue;
        const added = [];
        for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) { cov.add(ek(K[i], K[j])); added.push(ek(K[i], K[j])); }
        K.forEach((w) => cnt.set(w, cnt.get(w) + 1));
        // 剪枝：用满两个团的点不能再有未覆盖的边；只用了一个团的点，剩下的邻居必须两两相邻（将来凑成第二个团）
        const prune = K.some((w) => { const f = freeNbrs(w); if (cnt.get(w) >= 2) return f.length > 0; return !isClique(A, f) || f.some((a) => f.some((b) => a < b && cov.has(ek(a, b)))); });
        if (!prune) { cliques.push(K.slice().sort((a, b) => a - b)); if (rec()) return true; cliques.pop(); }
        K.forEach((w) => cnt.set(w, cnt.get(w) - 1));
        for (const k of added) cov.delete(k);
      }
      return false;
    }
    try { return rec() ? cliques : null; } catch (e) { if (e.message === "budget") return undefined; throw e; }
  }
  /* 由 Krausz 分解造根图：每个团一个根顶点；属于不足两个团的点补“空团”；原图每个点变成根图的一条边 */
  function rootGraph(A, vs = [...A.keys()]) {
    const K = krausz(A, vs);
    if (!K) return K;
    const nodes = K.map((c) => ({ members: c, empty: false }));
    const owner = new Map(vs.map((v) => [v, []]));
    K.forEach((c, i) => c.forEach((v) => owner.get(v).push(i)));
    for (const v of vs) while (owner.get(v).length < 2) { nodes.push({ members: [v], empty: true }); owner.get(v).push(nodes.length - 1); }
    const edges = vs.map((v) => ({ v, ends: owner.get(v) }));
    return { nodes, edges };
  }
  const isLine = (A, vs = [...A.keys()]) => { const k = krausz(A, vs); return k === undefined ? undefined : k !== null; };

  /* 孪生类：邻居集合（在 vs 里）完全相同的点归为一类；返回 [{members, nbrs}] */
  function twinClasses(A, vs) {
    const m = new Map();
    for (const v of vs) { const sig = vs.filter((w) => A[v][w]).join(","); if (!m.has(sig)) m.set(sig, []); m.get(sig).push(v); }
    return [...m.values()];
  }
  /* 对称增广的预处理：去掉孤立点（与所有项都对易的 Z 集），对剩下的取无孪生商图 */
  function symReduce(A, vs = [...A.keys()]) {
    const iso = vs.filter((v) => vs.every((w) => !A[v][w]));
    const rest = vs.filter((v) => !iso.includes(v));
    const classes = twinClasses(A, rest);
    const Q = classes.map((ci) => classes.map((cj) => ci !== cj && A[ci[0]][cj[0]]));
    return { iso, classes, Q };
  }
  /* 九种可解类的图论判据（附录 A）。返回 {FC, AC, "TWC-AC", FF, "TWC-FF", NC, "Sym-TWC-AC", "Sym-FF", "Sym-TWC-FF"}。
     不带 TWC 的类只有一个李代数块（Λ = 1），所以图还要连通：AC 是一整个团，FF 是一整块连通的线图。
     附录 A 的原文只说“FF 当且仅当图是线图”，但线图的不交并仍是线图，那样 FF 与 TWC-FF 在图上就分不开了；
     按连通来理解，表 I、表 II 的 H₂ 一行（FF 为 0.032 与 0.24(3)）才能复现，见 verify.mjs。 */
  function plainClasses(A, vs) {
    const comps = components(A, vs);
    const line = comps.every((c) => isLine(A, c) === true);
    return { FC: noEdges(A, vs), AC: isClique(A, vs), "TWC-AC": comps.every((c) => isClique(A, c)), FF: vs.length === 0 || (comps.length === 1 && line), "TWC-FF": line };
  }
  function classify(A, vs = [...A.keys()]) {
    const plain = plainClasses(A, vs);
    const { Q } = symReduce(A, vs), qv = [...Q.keys()];
    const sym = plainClasses(Q, qv);
    return { ...plain, NC: sym.AC, "Sym-TWC-AC": sym["TWC-AC"], "Sym-FF": sym.FF, "Sym-TWC-FF": sym["TWC-FF"] };
  }
  const CLASSES = ["FC", "AC", "TWC-AC", "FF", "TWC-FF", "NC", "Sym-TWC-AC", "Sym-FF", "Sym-TWC-FF"];

  /* 排序插入：按 |系数| 从大到小，每一项放进第一个“放进去仍属于该类”的碎片，放不进就开新碎片。
     test(ps) 判断一组泡利串是否属于该类。常数项（恒等算符）不参加。 */
  function sortedInsertion(terms, test) {
    const order = terms.filter((t) => !isId(t.p)).slice().sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
    const frags = [];
    for (const t of order) {
      let placed = false;
      for (const f of frags) { const ps = [...f.map((u) => u.p), t.p]; if (test(ps)) { f.push(t); placed = true; break; } }
      if (!placed) frags.push([t]);
    }
    return frags;
  }
  const classTest = (name) => (ps) => classify(graphOf(ps))[name];
  /* 方差指标 ε²M = (Σ_α √Var_ψ(H_α))²（式 24） */
  function metric(frags, n, psi) {
    let s = 0; const vars = [];
    for (const f of frags) { const v = variance(sumMat(f, n), psi); vars.push(v); s += Math.sqrt(v); }
    return { value: s * s, vars };
  }
  const l1 = (terms) => terms.reduce((s, t) => s + Math.abs(t.c), 0);

  /* ── so(N)：马约拉纳图像。生成元 O_uv = iγ_uγ_v；哈密顿量 H = Σ_{u<v} h_uv O_uv，h 实反对称 ── */
  /* 由 L 个两两反对易的泡利串 A_1…A_L 造出全部 so(L+1) 生成元：O_0i = A_i，O_ij = i A_i A_j（i<j）。返回 ops[u][v] = {p, s}（O_uv = s·P） */
  function soGenerators(As) {
    const N = As.length + 1, ops = Array.from({ length: N }, () => new Array(N).fill(null));
    for (let i = 1; i < N; i++) ops[0][i] = { p: As[i - 1], s: 1 };
    for (let i = 1; i < N; i++) for (let j = i + 1; j < N; j++) {
      const { p, k } = mul(As[i - 1], As[j - 1]); // A_iA_j = i^k P → i A_iA_j = i^{k+1} P，必须是 ±1 倍
      const kk = (k + 1) % 4; if (kk % 2) throw new Error("i A_i A_j 不是厄米的：A_i、A_j 不反对易");
      ops[i][j] = { p, s: kk === 0 ? 1 : -1 };
    }
    return ops;
  }
  const hamFromH = (h, ops, n) => { const N = h.length, M = zeros(1 << n); for (let u = 0; u < N; u++) for (let v = u + 1; v < N; v++) if (h[u][v]) pauliMat(ops[u][v].p, n, h[u][v] * ops[u][v].s, M); return M; };
  const rot = (N, i, j, phi) => { const R = Array.from({ length: N }, (_, a) => Array.from({ length: N }, (__, b) => (a === b ? 1 : 0))); const c = Math.cos(phi), s = Math.sin(phi); R[i][i] = c; R[j][j] = c; R[i][j] = s; R[j][i] = -s; return R; };
  const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
  const tp = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  /* h ← R h Rᵀ，R 是 (i, j) 平面里转 φ */
  function rotateH(h, i, j, phi) { const R = rot(h.length, i, j, phi); return mm(mm(R, h), tp(R)); }
  function det(A) {
    const n = A.length, M = A.map((r) => r.slice()); let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-300) return 0;
      if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; d = -d; }
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; }
    }
    return d;
  }
  /* 反对称 h 的标准形：Q 正交、det Q = 1，Q h Qᵀ = ⊕ [[0, ε_k], [−ε_k, 0]] ⊕ 0。N 为偶数且无零模时最后一个 ε 可能为负（普法夫值的符号） */
  function normalForm(h) {
    const N = h.length, scale = Math.max(1e-300, ...h.flat().map(Math.abs));
    const rows = [], eps = [];
    let W = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (__, j) => (i === j ? 1 : 0))); // 列向量组：W[k] 是第 k 个基向量
    while (W.length >= 2) {
      const m = W.length, hW = W.map((a) => W.map((b) => a.reduce((s, ai, i) => s + ai * b.reduce((t, bj, j) => t + h[i][j] * bj, 0), 0)));
      const S = tp(hW).map((r) => hW[0].map((_, j) => r.reduce((s, x, k) => s + x * hW[k][j], 0))); // hWᵀ hW
      const e = eigSym(S), lam = e.values[m - 1];
      if (lam < (1e-11 * scale) ** 2) break;
      const y = e.vectors[m - 1], u = new Array(N).fill(0);
      y.forEach((yk, k) => W[k].forEach((w, i) => (u[i] += yk * w)));
      const hu = h.map((_, j) => h.reduce((s, r, i) => s + r[j] * u[i], 0)); // hᵀu
      const ep = Math.sqrt(hu.reduce((s, x) => s + x * x, 0)), v = hu.map((x) => x / ep);
      rows.push(u, v); eps.push(ep);
      // 从 W 张成的空间里去掉 u、v，再正交归一
      const next = [];
      for (const w of W) {
        let r = w.slice();
        for (const b of [u, v, ...next]) { const d = r.reduce((s, x, i) => s + x * b[i], 0); r = r.map((x, i) => x - d * b[i]); }
        const nr = Math.sqrt(r.reduce((s, x) => s + x * x, 0)); if (nr > 1e-8) next.push(r.map((x) => x / nr));
        if (next.length === m - 2) break;
      }
      W = next;
    }
    for (const w of W) rows.push(w);
    if (det(rows) < 0) {
      if (rows.length > 2 * eps.length) rows[rows.length - 1] = rows[rows.length - 1].map((x) => -x);
      else { const k = eps.length - 1; rows[2 * k + 1] = rows[2 * k + 1].map((x) => -x); eps[k] = -eps[k]; }
    }
    while (eps.length < Math.floor(N / 2)) eps.push(0); // 秩不足时，剩下的对子 ε = 0
    return { Q: rows, eps };
  }
  /* 把 det = 1 的正交矩阵 Q 拆成相邻平面里的吉文斯转动：依次对 h 做 steps[0], steps[1], … 得到 Q h Qᵀ */
  function givens(Q) {
    const N = Q.length, M = Q.map((r) => r.slice()), G = [];
    for (let c = 0; c < N - 1; c++) for (let r = N - 1; r > c; r--) {
      const a = M[r - 1][c], b = M[r][c], rho = Math.hypot(a, b);
      if (Math.abs(b) < 1e-14) continue;
      const cs = a / rho, sn = b / rho;
      for (let k = 0; k < N; k++) { const x = M[r - 1][k], y = M[r][k]; M[r - 1][k] = cs * x + sn * y; M[r][k] = -sn * x + cs * y; }
      G.push({ i: r - 1, j: r, phi: Math.atan2(sn, cs) });
    }
    // 此时 M 是对角元为 ±1 的对角阵；det = 1 且前 N−1 个对角元可能为负时，用转 π 修正（成对翻号）
    const fix = [];
    for (let c = 0; c < N - 1; c++) if (M[c][c] < 0) { // 在 (c, c+1) 平面转 π：两个对角元同时变号
      for (let k = 0; k < N; k++) { M[c][k] = -M[c][k]; M[c + 1][k] = -M[c + 1][k]; }
      fix.push({ i: c, j: c + 1, phi: Math.PI });
    }
    // F_m…F_1 G_K…G_1 Q = I ⇒ Q = G_1ᵀ…G_Kᵀ F_1ᵀ…F_mᵀ。Q h Qᵀ 从里往外算：先 F_mᵀ, …, F_1ᵀ，再 G_Kᵀ, …, G_1ᵀ（Rᵀ 就是反向转）
    const steps = [];
    for (let k = fix.length - 1; k >= 0; k--) steps.push({ i: fix[k].i, j: fix[k].j, phi: -fix[k].phi });
    for (let k = G.length - 1; k >= 0; k--) steps.push({ i: G[k].i, j: G[k].j, phi: -G[k].phi });
    return steps;
  }

  /* ── H₂ / STO-3G：两个氢原子在 z 轴上相距 R（玻尔）；只有 s 型高斯函数，积分都有闭式 ── */
  const ANG = 1 / 0.529177210903; // 1 Å = 1.8897261… 玻尔
  const STO3G_H = { a: [3.42525091, 0.62391373, 0.16885540], d: [0.15432897, 0.53532814, 0.44463454] };
  function erf(x) {
    const s = Math.sign(x); x = Math.abs(x);
    if (x < 3) { let term = x, sum = x; for (let n = 1; n < 200; n++) { term *= -x * x / n; const t = term / (2 * n + 1); sum += t; if (Math.abs(t) < 1e-17 * Math.abs(sum)) break; } return s * 2 / Math.sqrt(Math.PI) * sum; }
    // erfc 的连分式（Lentz）
    let f = x, C = x, D = 0; const tiny = 1e-300;
    for (let k = 1; k < 300; k++) { const a = k / 2; D = x + a * D; D = 1 / (Math.abs(D) < tiny ? tiny : D); C = x + a / C; const dl = C * D; f *= dl; if (Math.abs(dl - 1) < 1e-16) break; }
    return s * (1 - Math.exp(-x * x) / Math.sqrt(Math.PI) / f);
  }
  const F0 = (t) => (t < 1e-10 ? 1 - t / 3 : 0.5 * Math.sqrt(Math.PI / t) * erf(Math.sqrt(t)));
  function h2Integrals(R) {
    const Z = [0, R], prim = (A) => STO3G_H.a.map((a, k) => ({ a, A, w: STO3G_H.d[k] * (2 * a / Math.PI) ** 0.75 }));
    const bas = Z.map(prim);
    const S = [[0, 0], [0, 0]], T = [[0, 0], [0, 0]], V = [[0, 0], [0, 0]];
    for (let m = 0; m < 2; m++) for (let n = 0; n < 2; n++) for (const p of bas[m]) for (const q of bas[n]) {
      const g = p.a + q.a, mu = p.a * q.a / g, AB2 = (p.A - q.A) ** 2, P = (p.a * p.A + q.a * q.A) / g, K = Math.exp(-mu * AB2), w = p.w * q.w;
      const s = (Math.PI / g) ** 1.5 * K;
      S[m][n] += w * s; T[m][n] += w * mu * (3 - 2 * mu * AB2) * s;
      for (const C of Z) V[m][n] += w * (-2 * Math.PI / g) * K * F0(g * (P - C) ** 2);
    }
    const eri = (m, n, l, s) => {
      let v = 0;
      for (const p of bas[m]) for (const q of bas[n]) for (const r of bas[l]) for (const t of bas[s]) {
        const g1 = p.a + q.a, g2 = r.a + t.a, P = (p.a * p.A + q.a * q.A) / g1, Qc = (r.a * r.A + t.a * t.A) / g2;
        const K = Math.exp(-p.a * q.a / g1 * (p.A - q.A) ** 2 - r.a * t.a / g2 * (r.A - t.A) ** 2);
        v += p.w * q.w * r.w * t.w * 2 * Math.PI ** 2.5 / (g1 * g2 * Math.sqrt(g1 + g2)) * K * F0(g1 * g2 / (g1 + g2) * (P - Qc) ** 2);
      }
      return v;
    };
    const G = [0, 1].map((m) => [0, 1].map((n) => [0, 1].map((l) => [0, 1].map((s) => eri(m, n, l, s)))));
    return { S, T, V, G, Enuc: 1 / R };
  }
  /* 最小基 RHF：分子轨道由对称性定死（σg、σu），不必自洽迭代 */
  function h2MO(R) {
    const I = h2Integrals(R), s = I.S[0][1];
    const C = [[1 / Math.sqrt(2 * (1 + s)), 1 / Math.sqrt(2 * (1 - s))], [1 / Math.sqrt(2 * (1 + s)), -1 / Math.sqrt(2 * (1 - s))]];
    const Hc = [[0, 0], [0, 0]].map((r, m) => r.map((_, n) => I.T[m][n] + I.V[m][n]));
    const h = [0, 1].map((p) => [0, 1].map((q) => { let v = 0; for (let m = 0; m < 2; m++) for (let n = 0; n < 2; n++) v += C[m][p] * C[n][q] * Hc[m][n]; return v; }));
    const g = [0, 1].map((p) => [0, 1].map((q) => [0, 1].map((r) => [0, 1].map((t) => {
      let v = 0;
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) for (let d = 0; d < 2; d++) v += C[a][p] * C[b][q] * C[c][r] * C[d][t] * I.G[a][b][c][d];
      return v;
    }))));
    const Ehf = 2 * h[0][0] + g[0][0][0][0] + I.Enuc;
    return { ...I, C, h, g, Ehf };
  }
  /* 第二量子化哈密顿量的 2ⁿ 阶实矩阵（Jordan–Wigner 基：第 q 位 = 第 q 个自旋轨道的占据数）。
     自旋轨道 k = 2p + σ（σ = 0 为 α，1 为 β），与 OpenFermion 的排法相同。
     H = E_nuc + Σ h_kl a†_k a_l + ½ Σ (kl|mn) a†_k a†_m a_n a_l */
  function h2FockMatrix(R) {
    const M = h2MO(R), n = 4, d = 1 << n;
    const ann = (p) => { const A = Array.from({ length: d }, () => new Array(d).fill(0)); for (let b = 0; b < d; b++) if ((b >> p) & 1) A[b ^ (1 << p)][b] = (pc(b & ((1 << p) - 1)) & 1) ? -1 : 1; return A; };
    const a = [...Array(n).keys()].map(ann), ad = a.map(tp);
    const sp = (k) => [k >> 1, k & 1];
    let H = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (__, j) => (i === j ? M.Enuc : 0)));
    const addTo = (X, f) => { for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) H[i][j] += f * X[i][j]; };
    for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) {
      const [p, sk] = sp(k), [q, sl] = sp(l); if (sk !== sl) continue;
      addTo(mm(ad[k], a[l]), M.h[p][q]);
    }
    for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) for (let m = 0; m < n; m++) for (let o = 0; o < n; o++) {
      const [p, sk] = sp(k), [q, sl] = sp(l), [r, sm] = sp(m), [s, so] = sp(o);
      if (sk !== sl || sm !== so) continue;
      const v = M.g[p][q][r][s]; if (!v) continue;
      addTo(mm(mm(ad[k], ad[m]), mm(a[o], a[l])), 0.5 * v);
    }
    return { H, mo: M };
  }
  /* Bravyi–Kitaev（4 个模）：b₀ = n₀，b₁ = n₀+n₁，b₂ = n₂，b₃ = n₀+n₁+n₂+n₃（mod 2）。BK 与 JW 只差一个计算基的置换 */
  const bkOfOcc = (nb) => { const n = (q) => (nb >> q) & 1; return n(0) | ((n(0) ^ n(1)) << 1) | (n(2) << 2) | ((n(0) ^ n(1) ^ n(2) ^ n(3)) << 3); };
  function h2Qubit(R, mapping = "BK") {
    const { H, mo } = h2FockMatrix(R), d = 16, M = zeros(d);
    const perm = mapping === "BK" ? [...Array(d).keys()].map(bkOfOcc) : [...Array(d).keys()];
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) M.re[perm[i] * d + perm[j]] = H[i][j];
    const terms = decompose(M, 4);
    return { terms, M, mo, perm };
  }
  /* 基态（实对称矩阵）与粒子数 */
  function groundState(M) {
    const d = M.n, A = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (__, j) => M.re[i * d + j]));
    const e = eigSym(A);
    return { E: e.values[0], psi: { re: e.vectors[0], im: new Array(d).fill(0) }, values: e.values, vectors: e.vectors };
  }

  /* exp(−i φ/2 · O)，O = s·P 是厄米泡利串（O² = 1）：cos(φ/2) − i sin(φ/2) O */
  function pauliExp(op, phi, n) {
    const d = 1 << n, U = eye(d), O = pauliMat(op.p, n, op.s ?? 1), c = Math.cos(phi / 2), s = Math.sin(phi / 2);
    for (let k = 0; k < d * d; k++) { U.re[k] = U.re[k] * c + s * O.im[k]; U.im[k] = U.im[k] * c - s * O.re[k]; }
    return U;
  }

  /* ── 附录 B 的因式分解：Z 集（与所有项对易）、孪生类、每类取一个代表 A_a、C_ab = A_ab A_a、再把 Z 集和 C_ab 写成对称生成元的乘积 ── */
  function factorize(terms, gens) {
    const S = terms.filter((t) => !isId(t.p)), c0 = terms.filter((t) => isId(t.p)).reduce((s, t) => s + t.c, 0);
    const A = graphOf(S.map((t) => t.p)), { iso, classes } = symReduce(A, [...S.keys()]);
    const express = (target) => {
      for (let m = 0; m < 1 << gens.length; m++) {
        let p = { x: 0, z: 0 }, k = 0;
        gens.forEach((g, i) => { if ((m >> i) & 1) { const r = mul(p, g); p = r.p; k = (k + r.k) % 4; } });
        if (same(p, target)) { if (k % 2) return null; return { mask: m, sign: k === 0 ? 1 : -1 }; }
      }
      return null;
    };
    const zset = iso.map((i) => ({ term: S[i], ex: express(S[i].p) }));
    const cls = classes.map((members) => {
      const ms = members.slice().sort((a, b) => Math.abs(S[b].c) - Math.abs(S[a].c) || a - b), rep = S[ms[0]].p;
      return {
        rep,
        members: ms.map((i) => {
          const { p, k } = mul(S[i].p, rep); // B·A = i^k C，B 与 A 对易所以 k 为偶数；于是 B = (i^k C)·A
          return { term: S[i], C: p, sign: k === 0 ? 1 : -1, ex: express(p) };
        }),
      };
    });
    const ev = (ex, v) => { let s = ex.sign; v.forEach((x, i) => { if ((ex.mask >> i) & 1) s *= x; }); return s; };
    const poly = (v) => ({
      p0: c0 + zset.reduce((s, z) => s + z.term.c * ev(z.ex, v), 0),
      p: cls.map((cl) => cl.members.reduce((s, m) => s + m.term.c * m.sign * ev(m.ex, v), 0)),
    });
    return { S, c0, iso, classes, zset, cls, gens, poly, ok: zset.every((z) => z.ex) && cls.every((cl) => cl.members.every((m) => m.ex)) };
  }
  /* H₂（BK）的测量方案：对称生成元 Z₁、Z₃、Z₀Z₂；两个孪生类的代表 Z₀ 与 X₀Z₁X₂ 反对易，各扇区里 H 是 su(2) 元素加常数 */
  function h2Scheme(R = ANG) {
    const q = h2Qubit(R, "BK"), gens = ["IZII", "IIIZ", "ZIZI"].map(parse);
    const fz = factorize(q.terms, gens);
    const sectors = [];
    for (const v of [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]]) {
      const { p0, p } = fz.poly(v), r = Math.hypot(...p);
      // 计算基里属于这个扇区的态：Z₁ = (−1)^{b₁}，Z₃ = (−1)^{b₃}，Z₀Z₂ = (−1)^{b₀+b₂}
      const basis = [...Array(16).keys()].filter((b) => ((b >> 1) & 1 ? -1 : 1) === v[0] && ((b >> 3) & 1 ? -1 : 1) === v[1] && (((b ^ (b >> 2)) & 1) ? -1 : 1) === v[2]);
      sectors.push({ v, p0, p, r, Em: p0 - r, Ep: p0 + r, basis });
    }
    return { ...q, fz, sectors };
  }
  /* 把一个碎片的测量看成按玻恩规则抽它的本征值：返回 [{value, prob}]（简并的本征值合并） */
  function outcomeModel(M, psi, tol = 1e-9) {
    const d = M.n, Ar = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (__, j) => M.re[i * d + j]));
    const e = eigSym(Ar), out = [];
    e.values.forEach((val, k) => {
      const v = e.vectors[k]; let a = 0, b = 0;
      for (let i = 0; i < d; i++) { a += v[i] * psi.re[i]; b += v[i] * psi.im[i]; }
      const prob = a * a + b * b;
      const hit = out.find((o) => Math.abs(o.value - val) < tol);
      if (hit) hit.prob += prob; else out.push({ value: val, prob });
    });
    return out.filter((o) => o.prob > 1e-14).sort((a, b) => a.value - b.value);
  }

  return {
    pc, parse, str, sub, key, same, isId, commutes, nY, isSym, mul, IPOW, pauliExp, factorize, h2Scheme, outcomeModel,
    zeros, eye, cmul, dag, axpy, fro, conjBy, pauliMat, sumMat, decompose, eigSym, eigHerm, expect, variance,
    graphOf, graphFromEdges, edgesOf, components, isClique, noEdges, krausz, rootGraph, isLine, twinClasses, symReduce, classify, CLASSES,
    sortedInsertion, classTest, metric, l1,
    soGenerators, hamFromH, rot, mm, tp, rotateH, det, normalForm, givens,
    ANG, STO3G_H, erf, F0, h2Integrals, h2MO, h2FockMatrix, bkOfOcc, h2Qubit, groundState,
  };
})();
