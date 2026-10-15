// 数值核验：页面上每一条可以用数检查的结论，都在这里用 lie.js（页面用的同一份代码）复算一遍。
// 运行：node source/verify.mjs（或 deno run -A source/verify.mjs）。结果写到 ../verification.json，任何一条不过就退出码 1。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const Lie = new Function(fs.readFileSync(path.join(here, "lie.js"), "utf8") + "\nreturn Lie;")();
const { eye, add, sub, scale, mul, T, tr, norm, comm, apply, det, expm, logm, L, rot, rodrigues, axisAngle, groupComm, exp2, kind2, expSeries, tailBound, ccomm, cscale, sigma, t, su2, toSO3, I2 } = Lie;

const checks = [];
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, ...detail }); };
let seed = 20261014;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1; };
const rmat = (n, s = 1) => Array.from({ length: n }, () => Array.from({ length: n }, () => s * rnd()));
const cnorm = (A) => Math.sqrt(A.flat().reduce((s, z) => s + z[0] ** 2 + z[1] ** 2, 0));
const csub = (A, B) => A.map((r, i) => r.map((v, j) => [v[0] - B[i][j][0], v[1] - B[i][j][1]]));
const deg = 180 / Math.PI;

// 1. so(3) 的括号：[Lx,Ly]=Lz, [Ly,Lz]=Lx, [Lz,Lx]=Ly（整数矩阵，应当精确相等）
{
  const e = [norm(sub(comm(L.x, L.y), L.z)), norm(sub(comm(L.y, L.z), L.x)), norm(sub(comm(L.z, L.x), L.y))];
  check("so(3) 括号 [Lx,Ly]=Lz 及其轮换", e.every((v) => v === 0), { residuals: e });
  const anti = ["x", "y", "z"].map((k) => norm(add(T(L[k]), L[k])));
  check("Lx, Ly, Lz 都反对称（Xᵀ = −X）", anti.every((v) => v === 0), { residuals: anti });
  const jac = norm(add(add(comm(L.x, comm(L.y, L.z)), comm(L.y, comm(L.z, L.x))), comm(L.z, comm(L.x, L.y))));
  check("雅可比恒等式（so(3) 基）", jac === 0, { residual: jac });
}

// 2. exp(θL_k) = 绕 k 轴转 θ；exp 的实现对随机矩阵满足 det exp X = e^{tr X}
{
  let worst = 0;
  for (const k of ["x", "y", "z"]) for (const th of [0.3, 1.2, 2.9, 5.5, -2]) worst = Math.max(worst, norm(sub(expm(scale(L[k], th)), rot(k, th))));
  check("exp(θL_k) 等于绕 k 轴转 θ 的矩阵", worst < 1e-12, { maxResidual: worst });
  let worstDet = 0;
  for (const n of [2, 3, 4, 5]) for (let i = 0; i < 20; i++) { const X = rmat(n, 1.5); worstDet = Math.max(worstDet, Math.abs(det(expm(X)) / Math.exp(tr(X)) - 1)); }
  check("det exp X = e^{tr X}（2–5 阶随机矩阵各 20 个）", worstDet < 1e-11, { maxRelResidual: worstDet });
  let worstOrth = 0;
  for (let i = 0; i < 30; i++) { const A = rmat(3, 2); const X = sub(A, T(A)); const R = expm(X); worstOrth = Math.max(worstOrth, norm(sub(mul(T(R), R), eye(3))), Math.abs(det(R) - 1)); }
  check("反对称 X 的 exp 是转动：RᵀR = I 且 det R = 1", worstOrth < 1e-12, { maxResidual: worstOrth });
}

// 3. exp(θJ) 的级数：J² = −I，部分和收敛到 (cos θ, sin θ)；余项上界成立
{
  const J = [[0, -1], [1, 0]];
  check("J² = −I", norm(add(mul(J, J), eye(2))) === 0, {});
  let worst = 0, boundOK = true;
  for (const th of [0.5, 1.8, Math.PI, 2 * Math.PI]) for (let N = 0; N <= 40; N++) {
    const S = expSeries(th, N).sums[N], err = Math.hypot(S[0] - Math.cos(th), S[1] - Math.sin(th));
    if (err > tailBound(th, N) * (1 + 1e-9) + 1e-13) boundOK = false; // 1e-13：θ = 2π 时中间项大到 86，浮点舍入约 1e-14
    if (N === 40) worst = Math.max(worst, err);
  }
  check("Σ(iθ)ᵏ/k! 的部分和误差 ≤ 余项上界 Σ_{k>N}θᵏ/k!", boundOK, {});
  check("N = 40 时部分和与 e^{iθ} 的差（θ ≤ 2π）", worst < 1e-12, { maxError: worst });
  const rows = [0, 2, 4, 6, 8, 12].map((N) => { const S = expSeries(1.8, N).sums[N]; return { N, error: Math.hypot(S[0] - Math.cos(1.8), S[1] - Math.sin(1.8)), bound: tailBound(1.8, N) }; });
  check("θ = 1.8 时误差随 N 的变化（页面默认态附近）", true, { table: rows });
}

// 4. 2×2 的闭式 exp2 与级数 expm 一致；无迹矩阵的 exp 行列式为 1；三种类型
{
  let worst = 0;
  const presets = { rot: [[0, -1], [1, 0]], shear: [[0, 1], [0, 0]], squeeze: [[1, 0], [0, -1]], spiral: [[0.25, -1], [1, 0.25]] };
  for (const A of [...Object.values(presets), ...Array.from({ length: 40 }, () => rmat(2, 1.4))]) for (const tt of [-1.7, 0.4, 1, 2.5]) worst = Math.max(worst, norm(sub(exp2(A, tt), expm(scale(A, tt)))) / Math.max(1, norm(expm(scale(A, tt)))));
  check("2×2 闭式 exp(tA)（Cayley–Hamilton）与级数一致", worst < 1e-10, { maxRelResidual: worst });
  const kinds = Object.fromEntries(Object.entries(presets).map(([k, A]) => [k, kind2(A)]));
  check("预设的分类：转=椭圆、剪=抛物、挤=双曲、螺=迹非零", kinds.rot === "elliptic" && kinds.shear === "parabolic" && kinds.squeeze === "hyperbolic" && kinds.spiral === "trace", { kinds });
  const dets = Object.entries(presets).map(([k, A]) => ({ preset: k, t: 1.5, det: det(exp2(A, 1.5)), expTrace: Math.exp(1.5 * tr(A)) }));
  check("各预设在 t = 1.5 时 det = e^{t·trA}", dets.every((d) => Math.abs(d.det - d.expTrace) < 1e-12), { table: dets });
  // SL(2,ℝ) 的 exp 不是满射：sl(2) 中任何 X 都有 tr exp X ≥ −2；diag(−2, −1/2) 的迹是 −2.5
  let minTr = Infinity;
  for (let i = 0; i < 20000; i++) { const a = 3 * rnd(), b = 3 * rnd(), cc = 3 * rnd(); minTr = Math.min(minTr, tr(exp2([[a, b], [cc, -a]], 1))); }
  check("随机两万个 X ∈ sl(2,ℝ)：tr exp X ≥ −2", minTr >= -2 - 1e-9, { minTrace: minTr, target: -2.5 });
  check("剪切 exp(tN) = [[1,t],[0,1]]（N² = 0，级数在第二项截断）", norm(sub(exp2(presets.shear, 0.7), [[1, 0.7], [0, 1]])) < 1e-15, {});
}

// 5. 群换位子：e^{εLx}e^{εLy}e^{−εLx}e^{−εLy} ≈ 绕 z 转 ε²
{
  const rows = [40, 30, 20, 10, 5, 2.5, 1].map((d) => {
    const e = d / deg, g = groupComm(L.x, L.y, e), { angle, axis } = axisAngle(g);
    return { epsDeg: d, phiDeg: angle * deg, eps2Deg: e * e * deg, ratio: angle / (e * e), axisTiltDeg: Math.acos(axis[2]) * deg, secondOrderResidualOverEps2: norm(sub(sub(g, eye(3)), scale(L.z, e * e))) / (e * e) };
  });
  const last = rows[rows.length - 1];
  check("φ/ε² → 1，转轴 → +z", Math.abs(last.ratio - 1) < 1e-3 && last.axisTiltDeg < 1.5, { table: rows });
  // 余项是 O(ε³)：‖g − I − ε²Lz‖/ε² 随 ε 线性变小
  const r1 = rows.find((r) => r.epsDeg === 10).secondOrderResidualOverEps2, r2 = rows.find((r) => r.epsDeg === 5).secondOrderResidualOverEps2;
  check("‖g − I − ε²Lz‖/ε² 在 ε 减半时约减半（余项是三阶）", Math.abs(r1 / r2 - 2) < 0.1, { at10deg: r1, at5deg: r2, ratio: r1 / r2 });
  // 页面上画的那一点
  const p0 = [1, -1, 0.3].map((v) => v / Math.hypot(1, 1, 0.3));
  const e = 30 / deg, g = groupComm(L.x, L.y, e), p4 = apply(g, p0), pz = apply(rot("z", e * e), p0);
  check("页面默认态 ε = 30°：终点与 R_z(ε²)p₀ 的距离远小于回程差", Math.hypot(...sub([p4], [pz])[0]) < 0.25 * Math.hypot(...sub([p4], [p0])[0]), { gap: Math.hypot(...sub([p4], [p0])[0]), missFromPrediction: Math.hypot(...sub([p4], [pz])[0]) });
}

// 6. BCH：log(e^X e^Y) = X + Y + ½[X,Y] + (1/12)[X,[X,Y]] − (1/12)[Y,[X,Y]] + O(4 阶)
{
  const X0 = rmat(3, 1), Y0 = rmat(3, 1);
  const res = [0.2, 0.1, 0.05].map((s) => {
    const X = scale(X0, s), Y = scale(Y0, s), Z = logm(mul(expm(X), expm(Y))), XY = comm(X, Y);
    const bch3 = add(add(add(X, Y), scale(XY, 0.5)), sub(scale(comm(X, XY), 1 / 12), scale(comm(Y, XY), 1 / 12)));
    return { s, residual2: norm(sub(Z, add(add(X, Y), scale(XY, 0.5)))), residual3: norm(sub(Z, bch3)) };
  });
  const o3 = res[1].residual2 / res[2].residual2, o4 = res[1].residual3 / res[2].residual3;
  check("BCH：截到 ½[X,Y] 余项是三阶（减半缩 8 倍），再加两项后是四阶（缩 16 倍）", Math.abs(o3 - 8) < 0.8 && Math.abs(o4 - 16) < 2, { table: res, shrink2: o3, shrink3: o4 });
}

// 7. su(2)：括号与 so(3) 相同；SU(2) → SO(3) 是同态、二对一；转 2π 得 −I
{
  const e = [cnorm(csub(ccomm(t.x, t.y), t.z)), cnorm(csub(ccomm(t.y, t.z), t.x)), cnorm(csub(ccomm(t.z, t.x), t.y))];
  check("su(2) 括号 [t_x,t_y]=t_z 及轮换（t_k = −iσ_k/2）", e.every((v) => v < 1e-15), { residuals: e });
  let worst = 0, worstSign = 0;
  for (let i = 0; i < 50; i++) {
    const n0 = [rnd(), rnd(), rnd()], nn = Math.hypot(...n0), n = n0.map((v) => v / nn), th = 6 * rnd();
    const U = su2(n, th);
    worst = Math.max(worst, norm(sub(toSO3(U), rodrigues(n, th))));
    worstSign = Math.max(worstSign, norm(sub(toSO3(cscale(U, [-1, 0])), toSO3(U))));
  }
  check("toSO3(exp(θ t_n)) = 绕 n 转 θ", worst < 1e-12, { maxResidual: worst });
  check("U 与 −U 映到同一个转动（二对一）", worstSign < 1e-12, { maxResidual: worstSign });
  const U2pi = su2([0, 0, 1], 2 * Math.PI), U4pi = su2([0, 0, 1], 4 * Math.PI);
  check("绕 z 转 2π：U = −I，R = I；转 4π：U = I", cnorm(csub(U2pi, cscale(I2, [-1, 0]))) < 1e-12 && cnorm(csub(U4pi, I2)) < 1e-12 && norm(sub(toSO3(U2pi), eye(3))) < 1e-12, {});
}

const failed = checks.filter((c) => !c.ok);
fs.writeFileSync(path.join(here, "..", "verification.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), script: "source/verify.mjs", passed: checks.length - failed.length, failed: failed.length, checks }, null, 2) + "\n");
for (const c of checks) console.log((c.ok ? "ok   " : "FAIL ") + c.name);
if (failed.length) { console.error(`${failed.length} 条没通过`); process.exit(1); }
console.log(`全部 ${checks.length} 条通过`);
