# 以符代数，分块而治：用李代数的对称扩展可解哈密顿量

> [打开页面](./index.html) · 在线：<https://uugyfgyb.github.io/Lie-Group-Graph/topics/solvable-hamiltonians/>

一篇论文的水墨图解：Smik Patel、Tzu-Ching Yen、Artur F. Izmaylov，*Extension of exactly-solvable Hamiltonians using symmetries of Lie algebras*，arXiv:2305.18251v2（2023）。量子计算里常把分子哈密顿量拆成若干“能一步转到对角”的片段来测量。李代数给出的可解类是生成元的实系数线性组合；论文把系数换成对称算符的多项式（群代数里的“广义系数”）。在对称的每个共同本征空间（本页叫“扇区”）里，系数又变回实数，于是每块各用一个李群元素转正，拼起来仍是一个幺正变换。用在 𝔰𝔬(*L*+1) 上得到的正好是非上下文泡利哈密顿量；用在费米子上得到本征态为斯莱特行列式、但轨道随扇区而变的平均场可解哈密顿量。

## 页面包含

| 区块 | 内容 | 互动图 |
|---|---|---|
| 卷首 | 一笔圆相是系数空间，朱线是嘉当方向，四支墨箭是四个扇区的系数向量，各沿朱弧转到朱线上 | 静图 |
| 问 · 为什么要可解 | 电子哈密顿量（原文 1）、片段拆分（原文 36）、测量与时间演化两种用场；已知可解类一览（单体、GFRO、FC、AC、NC） | 表 |
| 旧 · 一支箭转到底 | *H* = Σ*c<sub>i</sub>*Λ<sub>*i*</sub> + *c*<sub>0</sub>（原文 10）与极大环面定理；反对易组生成 𝔰𝔬(*L*+1)；逐次转动的推导（原文 20、21） | 三维系数空间：拖动箭头改系数，分两步 *θ*<sub>1</sub>、*θ*<sub>2</sub> 转到 *A*<sub>3</sub>；可把 *p*<sub>3</sub> 变号看 atan2 分支 |
| 符 · 系数换成对称 | 可约表示与舒尔引理；有限阿贝尔对称群 = 反射生成的 ℤ<sub>2</sub><sup>*K*</sup>；扇区投影（原文 11、18）；群代数与多项式取值（原文 13）；新可解类（原文 14、15）；沃尔什–阿达马变换 | 四个扇区四支箭，可拖、可一起转；能级小图 *p*<sub>0</sub>(*v*) ± *a*(*v*)；多项式系数表；“系数是数”一键退回旧办法 |
| 块 · 分块对角化 | 原文 (7)–(9) 与附录 A 的四步证明（泰勒展开、强归纳、交叉项、乘积形式） | 8×8 矩阵的墨点与相位指针：原始基 → *U*<sub>T</sub>(*s*) 分块 → 每块各转两步变对角；与“符”图共用一组数 |
| 比 · 量子比特 | 非上下文的定义；式 (16) 必非上下文；附录 B 的反方向；克利福德 + 每扇区一串转动（原文 17–24）；海森堡型链（原文 37–39）；原文表 I | ① 两比特泡利串的对易图与非上下文判定（违反传递性时标出三项）；② 链的两种分组：全对易三片、非上下文两片 |
| 费 · 费米子 | 平均场可解；单体项的轨道转动（原文 25–27）；把 *h<sub>ij</sub>* 换成 *n<sub>k</sub>* 的多项式（原文 28–32）；GMF(*K*) 与 GFRO 的关系；原文表 II | 四格点链 + 两个 *S*<sub>2</sub> 轨道：切换 *n*<sub>5</sub>、*n*<sub>6</sub> 看 *S*<sub>1</sub> 的能级和轨道形状怎样变，点能级放电子 |
| 路 · 测量电路 | 受控转动（原文 33–35，图 1a）与中途测量 + 经典前馈（图 1b） | 三比特例子的两种电路；在固定试探态上模拟测量，累计平均收敛到 ⟨*H*⟩，附 ±2 标准误带 |
| 评 · 结论与局限 | 两样构造要素；片段少不等于测得省；电路开销；超出平均场的方向；读注汇总 | 表 |
| 练 | 六道小题，答案折叠 | — |
| 析 | 注释总表 33 条，中英对照，按正文首次出现排序 | 正文术语可点开 |

## 分层

- **原文**：式号、表 I、表 II 的数字、图 1 的电路结构都取自论文，表中数字原样照录。每个行间公式右边写本页编号，下面小字是原文式号。
- **定义、定理**：论文的定义与结论，以及极大环面定理、舒尔引理等标准结果。推导旁配朱批 17 条。
- **读注**：读的时候注意到的 5 处，页面里写成“读注”朱批，并在“评”一节列表汇总；都由 verify.mjs 核对，不影响论文的结论：
  1. 原文 (20) 的乘积 ∏<sub>*j*=1</sub><sup>*L*−1</sup> 没写顺序：*j* = 1 必须先作用（写在最右边）。相邻因子反对易，顺序倒过来一般转不到 *A<sub>L</sub>*。
  2. 原文 (21) 的角度要取 atan2 分支，*a*(*v*) 才为正。
  3. 原文 (39) 的求和上限应为 *n* − 1（(37) 里偶数键只有 *n* − 1 条）。
  4. 原文 (38) 的 *H*<sub>1</sub><sup>(NC)</sup> 作为整体是上下文的，它可解是因为它是不相交比特对上非上下文块之和。
  5. 原文 (28) 只写了 *n<sub>k</sub>* 的一次项；本页的费米子例子另加了零次项 *h*<sup>(0)</sup>（普通单体项），可解性不变。
- **数值（浏览器现算）**：转角 *θ<sub>j</sub>*(*v*)、*a*(*v*)、多项式系数、8×8 矩阵与泡利展开、非上下文判定与对称群生成元个数、费米子能级与轨道、扇区概率与模拟测量。
- **教学示意**：卷首的圆相与四支箭、海森堡链的弧线画法。三比特例子（*U*<sub>T</sub> 取三比特翻转码的解码电路）、费米子四格点链和动态电路的试探态是本页为讲解选的，不是论文里的数据。*U*<sub>T</sub>(*s*) 的中间值只为看见过程。

## 核验

- `source/verify.mjs`：38 项，全部通过，见 [`verification.json`](./verification.json)。包括：两比特泡利乘法表与对易判据；附录 A 的 (A1)、(8)(9)、(A8)–(A10)（各 20 组随机 8×8 矩阵）；*L* = 2…7 的逐次转动（含 *p<sub>L</sub>* < 0）、反序失败、{*A<sub>i</sub>*} ∪ {*A<sub>i</sub>A<sub>j</sub>*} 封闭且维数为 *L*(*L*+1)/2；三比特例子的 *U*<sub>T</sub> 映射、分块、对角元 = *p*<sub>0</sub> ± *a*、原文 (23) 的乘积形式、25 组随机扇区值；“系数是数”时只剩 3 项；动态电路按结果加权的平均等于 ⟨*H*⟩、20 万次模拟在 4 个标准误内、单次方差 = ⟨*H*²⟩ − ⟨*H*⟩²；非上下文判定在两比特全部 32767 个子集上与传递性定义一致；海森堡链 *n* = 2…6 的分组、反对易三角、偶数键条数；64 维福克空间里 64 个斯莱特行列式都是本征态、正交归一，套上随机轨道转动后仍成立；表 I、表 II 的算术（FNC 比 FC 平均少 21%，NH₃ 是 NC 多于 FC 的唯一例外）。
- `source/qa-browser.mjs`：在 Chrome 里以 1366 px 与 390 px、浅色与深色各开一次，检查零网络请求、零脚本报错、无横向溢出、九块画布都画上了墨、七个题跋非空、两张表 38 格墨条齐全；再拨动滑块、点选项、拖动箭头、测量 400 次、点开术语弹注，共 24 步，确认读数跟着变、转完后系数归零、矩阵对角、测量平均在 4 个标准误内。结果见 [`qa-browser.json`](./qa-browser.json)。
- `source/build.mjs`：构建时检查公式编号与引用、术语与总表一一对应且顺序一致、id 不重复、没有外链资源。

## 参考文献

1. S. Patel, T.-C. Yen, A. F. Izmaylov, Extension of exactly-solvable Hamiltonians using symmetries of Lie algebras, arXiv:2305.18251v2 [quant-ph] (2023)，<https://arxiv.org/abs/2305.18251>。
2. W. M. Kirby, P. J. Love, Classical simulation of noncontextual Pauli Hamiltonians, *Phys. Rev. A* **102**, 032418 (2020)。
3. T.-C. Yen, A. F. Izmaylov, Cartan subalgebra approach to efficient measurements of quantum observables, *PRX Quantum* **2**, 040320 (2021)。
4. A. F. Izmaylov, T.-C. Yen, How to define quantum mean-field solvable Hamiltonians using Lie algebras, *Quantum Sci. Technol.* **6**, 044006 (2021)。
5. S. Bravyi, J. M. Gambetta, A. Mezzacapo, K. Temme, Tapering off qubits to simulate fermionic Hamiltonians, arXiv:1701.08213 (2017)。
6. B. C. Hall, *Lie Groups, Lie Algebras, and Representations: An Elementary Introduction*, 2nd ed., Springer GTM 222 (2015)。

## 技术

单文件 HTML（约 1.5 MB，大部分是内嵌的 KaTeX 字体）。数值代码 `source/solv.js` 由页面和 verify.mjs 共用：复矩阵指数用“缩小再平方”，实对称矩阵用雅可比转动对角化，非上下文判定直接检查对易的传递性，对称群生成元个数用 GF(2) 上的秩。互动图是手写的 Canvas 2D，笔触与上一专题同一套（`source/ink.js`）。无 WebGL、无第三方运行库、无 CDN、无在线字体。浅色／深色随系统。

```bash
cd topics/solvable-hamiltonians
deno install
deno run -A source/verify.mjs      # 数值核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png
```
