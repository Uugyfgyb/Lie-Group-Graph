/* lie.js — 页面与 verify.mjs 共用的数：实矩阵（数组的数组）、三维转动、2×2 复矩阵与 SU(2)→SO(3)。无依赖。 */
const Lie = (() => {
  "use strict";
  /* ── 实矩阵 ── */
  const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const add = (A, B) => A.map((r, i) => r.map((v, j) => v + B[i][j]));
  const sub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
  const scale = (A, s) => A.map((r) => r.map((v) => v * s));
  const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));
  const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const tr = (A) => A.reduce((s, r, i) => s + r[i], 0);
  const norm = (A) => Math.sqrt(A.reduce((s, r) => s + r.reduce((t, v) => t + v * v, 0), 0));
  const comm = (A, B) => sub(mul(A, B), mul(B, A));
  const apply = (A, v) => A.map((r) => r.reduce((s, a, j) => s + a * v[j], 0));
  const det = (A) => {
    const M = A.map((r) => r.slice()), n = M.length; let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (M[p][c] === 0) return 0;
      if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; d = -d; }
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; }
    }
    return d;
  };

  /* 指数映射 exp(A) = Σ Aᵏ/k!：先把 A 缩小 2ˢ 倍让级数收得快，算完再平方 s 次（exp(A) = exp(A/2ˢ)^(2ˢ)） */
  const expm = (A) => {
    let s = 0, a = norm(A); while (a > 0.5) { a /= 2; s++; }
    const B = scale(A, 2 ** -s); let term = eye(A.length), sum = eye(A.length);
    for (let k = 1; k <= 18; k++) { term = scale(mul(term, B), 1 / k); sum = add(sum, term); }
    for (let i = 0; i < s; i++) sum = mul(sum, sum);
    return sum;
  };
  /* 对数 log(M)（M 靠近 I 时）：反复开平方把 M 拉到 I 附近，再用 log(I+E) = E − E²/2 + E³/3 − … */
  const sqrtm = (M) => { // Denman–Beavers 迭代
    let Y = M, Z = eye(M.length);
    for (let i = 0; i < 40; i++) { const Yi = inv(Y), Zi = inv(Z); Y = scale(add(Y, Zi), 0.5); Z = scale(add(Z, Yi), 0.5); }
    return Y;
  };
  const inv = (A) => {
    const n = A.length, M = A.map((r, i) => [...r, ...eye(n)[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[p], M[c]] = [M[c], M[p]];
      const d = M[c][c]; for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r) => r.slice(n));
  };
  const logm = (M) => {
    let s = 0, X = M; while (norm(sub(X, eye(M.length))) > 0.05 && s < 30) { X = sqrtm(X); s++; }
    const E = sub(X, eye(M.length)); let P = E, sum = eye(M.length).map((r) => r.map(() => 0));
    for (let k = 1; k <= 30; k++) { sum = add(sum, scale(P, (k % 2 ? 1 : -1) / k)); P = mul(P, E); }
    return scale(sum, 2 ** s);
  };

  /* ── 三维转动 ── so(3) 的三个生成元：绕 x、y、z 轴的无穷小转动 */
  const L = {
    x: [[0, 0, 0], [0, 0, -1], [0, 1, 0]],
    y: [[0, 0, 1], [0, 0, 0], [-1, 0, 0]],
    z: [[0, -1, 0], [1, 0, 0], [0, 0, 0]],
  };
  const rot = (axis, th) => {
    const c = Math.cos(th), s = Math.sin(th);
    if (axis === "x") return [[1, 0, 0], [0, c, -s], [0, s, c]];
    if (axis === "y") return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  };
  const hat = ([x, y, z]) => [[0, -z, y], [z, 0, -x], [-y, x, 0]];
  const rodrigues = (n, th) => { const K = hat(n); return add(add(eye(3), scale(K, Math.sin(th))), scale(mul(K, K), 1 - Math.cos(th))); };
  /* 从转动矩阵读出转角（0…π）和单位转轴 */
  const axisAngle = (R) => {
    const c = Math.max(-1, Math.min(1, (tr(R) - 1) / 2)), angle = Math.acos(c);
    const v = [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]], s = Math.hypot(...v);
    return { angle, axis: s > 1e-15 ? v.map((x) => x / s) : [0, 0, 1] };
  };
  /* 群换位子 e^{εX} e^{εY} e^{−εX} e^{−εY} */
  const groupComm = (X, Y, e) => mul(mul(expm(scale(X, e)), expm(scale(Y, e))), mul(expm(scale(X, -e)), expm(scale(Y, -e))));

  /* ── 2×2 实矩阵 exp(tA) 的闭式 ──
     A = (τ/2)I + B，B 无迹，B² = −det(B)·I = qI（Cayley–Hamilton）。
     q > 0：cosh/sinh（双曲型）；q < 0：cos/sin（椭圆型）；q = 0：I + tB（抛物型） */
  const exp2 = (A, t) => {
    const tau = A[0][0] + A[1][1];
    const B = [[A[0][0] - tau / 2, A[0][1]], [A[1][0], A[1][1] - tau / 2]];
    const q = -(B[0][0] * B[1][1] - B[0][1] * B[1][0]);
    let C, S;
    if (q > 1e-14) { const r = Math.sqrt(q); C = Math.cosh(r * t); S = Math.sinh(r * t) / r; }
    else if (q < -1e-14) { const w = Math.sqrt(-q); C = Math.cos(w * t); S = Math.sin(w * t) / w; }
    else { C = 1; S = t; }
    const g = Math.exp((tau * t) / 2);
    return [[g * (C + S * B[0][0]), g * S * B[0][1]], [g * S * B[1][0], g * (C + S * B[1][1])]];
  };
  const kind2 = (A) => { // 无迹 2×2 的分类：看 det
    const tau = A[0][0] + A[1][1], d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (Math.abs(tau) > 1e-12) return "trace";
    return d > 1e-12 ? "elliptic" : d < -1e-12 ? "hyperbolic" : "parabolic";
  };

  /* ── exp(iθ) 的级数：第 k 项 (iθ)ᵏ/k!，部分和 S_N ── */
  const expSeries = (th, N) => {
    const terms = [], sums = []; let re = 1, im = 0, sr = 0, si = 0;
    for (let k = 0; k <= N; k++) {
      if (k > 0) { const f = th / k; [re, im] = [-im * f, re * f]; } // 乘 iθ/k
      terms.push([re, im]); sr += re; si += im; sums.push([sr, si]);
    }
    return { terms, sums };
  };
  /* 余项上界：|S − S_N| ≤ Σ_{k>N} θᵏ/k! （三角不等式） */
  const tailBound = (th, N) => { let t = 1, s = 0; for (let k = 1; k <= N; k++) t *= th / k; for (let k = N + 1; k < N + 200; k++) { t *= th / k; s += t; if (t < 1e-18) break; } return s; };

  /* ── 2×2 复矩阵：复数写成 [re, im] ── */
  const c = {
    mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1]],
    conj: (a) => [a[0], -a[1]],
    scale: (a, s) => [a[0] * s, a[1] * s],
  };
  const cmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => c.add(s, c.mul(a, B[k][j])), [0, 0])));
  const cadd = (A, B) => A.map((r, i) => r.map((v, j) => c.add(v, B[i][j])));
  const cscale = (A, z) => A.map((r) => r.map((v) => c.mul(v, z)));
  const dag = (A) => A[0].map((_, j) => A.map((r) => c.conj(r[j])));
  const ctr = (A) => c.add(A[0][0], A[1][1]);
  const ccomm = (A, B) => { const P = cmul(A, B), Q = cmul(B, A); return P.map((r, i) => r.map((v, j) => [v[0] - Q[i][j][0], v[1] - Q[i][j][1]])); };
  const sigma = {
    x: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]],
    y: [[[0, 0], [0, -1]], [[0, 1], [0, 0]]],
    z: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]],
  };
  const I2 = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
  /* su(2) 的基 t_k = −iσ_k/2 */
  const t = { x: cscale(sigma.x, [0, -0.5]), y: cscale(sigma.y, [0, -0.5]), z: cscale(sigma.z, [0, -0.5]) };
  /* exp(θ t_n) = cos(θ/2) I − i sin(θ/2) n·σ （n 为单位向量） */
  const su2 = (n, th) => {
    const ch = Math.cos(th / 2), sh = Math.sin(th / 2);
    const nS = cadd(cadd(cscale(sigma.x, [n[0], 0]), cscale(sigma.y, [n[1], 0])), cscale(sigma.z, [n[2], 0]));
    return cadd(cscale(I2, [ch, 0]), cscale(nS, [0, -sh]));
  };
  /* 双覆盖 SU(2) → SO(3)：R_ij = ½ tr(σ_i U σ_j U†) */
  const toSO3 = (U) => {
    const s = [sigma.x, sigma.y, sigma.z], Ud = dag(U);
    return [0, 1, 2].map((i) => [0, 1, 2].map((j) => 0.5 * ctr(cmul(cmul(s[i], U), cmul(s[j], Ud)))[0]));
  };

  return { eye, add, sub, scale, mul, T, tr, norm, comm, apply, det, inv, expm, logm, L, rot, hat, rodrigues, axisAngle, groupComm, exp2, kind2, expSeries, tailBound, c, cmul, cadd, cscale, dag, ctr, ccomm, sigma, I2, t, su2, toSO3 };
})();
