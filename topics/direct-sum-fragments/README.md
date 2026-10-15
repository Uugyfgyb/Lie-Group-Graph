# 拆图成片，片片可解：李代数直和给出的可解哈密顿量碎片

> [打开页面](./index.html) · 在线：<https://uugyfgyb.github.io/Lie-Group-Graph/topics/direct-sum-fragments/>

一篇论文的水墨图解：Smik Patel、Artur F. Izmaylov，*Exactly solvable Hamiltonian fragments obtained from a direct sum of Lie algebras*，arXiv:2402.09376v1（2024）。VQE 估计 ⟨*H*⟩ 时要把哈密顿量拆成若干碎片，每片先转到对易的 *z* 算符上再测；碎片越大越少，测量次数越少。论文把可用的碎片推广为：测掉泡利对称以后，每个扇区里是若干个 𝔰𝔬(*N*) 之直和中的一个元素（Sym-TWC-FF 等九类），并给出它们在反相容图上的判据（团、线图、孪生与商图）、拆分算法和测量线路。它是同组前作 [`solvable-hamiltonians`](../solvable-hamiltonians/)（arXiv:2305.18251）的续篇。

## 页面包含

| 区块 | 内容 | 互动图 |
|---|---|---|
| 卷首 | 五个泡利项的反相容图（论文图 2a）与它的根图：一项一笔，朱圈是马约拉纳模 | 静图 |
| 拆 · 为什么要拆 | 电子哈密顿量与泡利展开（原文 1、21）；拆分与线性（22、23）；测量次数下界（24）用柯西–施瓦茨两步推出；反相容图 | — |
| 代 · 李代数与转动 | 多项式与泛包络代数（2、3）；极大环面定理（4、5）；两比特上的 𝔰𝔬(5)：马约拉纳图像、吉文斯转动 ↔ 泡利指数门、标准形与谱 ±*ε*₁ ± *ε*₂ | 五边形根图：选 AC／只用实对称项／一般元素，拖进度或按“转”，十条边逐步消成两条；右侧竖轴对照精确对角化与 ±*ε*₁ ± *ε*₂ |
| 和 · 直和 | 原文 (6)–(8)；两比特例子 {XX, ZI} ⊕ {ZZ, IX}，转完是贝尔测量 | 两个圆盘：拖系数向量，依次转到横轴；显示两块的门、对易性与谱 ±*r*₁ ± *r*₂ |
| 称 · 对称作系数 | 原文 (9)–(13)；H₂（STO-3G、1 Å、BK）的三个泡利对称 Z₁、Z₃、Z₀Z₂ 及其物理含义；H₂ 写成 *p*₀ + *p*₁Z₀ + *p*₂X₀Z₁X₂，多项式因式分解 | 八个扇区的系数向量；点一格看含义、两个基矢的轨道占据、*p*₀、*p*₁、*p*₂、能级与转角 |
| 搭 · 用泡利搭 | 原文 (14)–(20)；麻烦一（实对称，转置推导）、麻烦二（乘泡利对称不改图，式 18）；九类一览表 | 表 |
| 图 · 从图上认 | 附录 A：团、线图与 Krausz 分解、根图、孪生与无孪生商图（A1）；读者笔记：FF 要求连通 | 可编辑的反相容图（论文图 1、2、3、爪、蛛形、H₂ 的 14 项、自己连）；Hasse 图标出所属的类；根图；不是线图时标出爪；“收拢孪生类”动画 |
| 线 · 测量线路 | 排序插入；附录 B 的因式分解（B5、B6、B7、B9）在 H₂ 上走一遍；CNOT → 中途测量 → *R<sub>y</sub>*(−*θ<sub>v</sub>*) → 测量 | 线路图与八个扇区的转角表；ψ(*α*) 一族态上逐项、FC、NC 三种拆法的 *ε*²*M* 曲线，各 200 次实验 × 1000 发的抽样点图 |
| 果 · 结果 | 附录 C 的设定；表 I、表 II 的读法与结论 | 条形图（对数轴）：五个分子 × 两张表；H₂ 一行附本页重算值 |
| 思 · 结论与追问 | 论文的结论与两个方向；三个值得追问的地方 | — |
| 练 | 六道小题，答案折叠 | — |
| 析 | 注释总表 26 条，中英对照，按正文首次出现排序 | 正文术语可点开 |

## 分层

- **原文**：式号与论文一致，(1)–(24)、(A1)、(B5) 等直接写在公式右侧；本页补的 8 个式子编为 (a)–(h)。表 I、表 II 的数字原样照录（按论文印出的位数）。
- **定义、定理**：论文的定义与结论，以及极大环面定理、Krausz 定理、Beineke 与 Whitney 的结果。推导旁配朱批 11 条。
- **数值（浏览器现算）**：H₂ 从 STO-3G 积分算起（重叠、动能、核吸引、双电子积分均为闭式），经 Jordan–Wigner 矩阵与 BK 置换得到 15 个泡利项；排序插入与九类判据；8 个扇区的 *p*₀、*p*₁、*p*₂ 与能级；𝔰𝔬(5) 的标准形与吉文斯分解；抽样。
- **复现**：表 I、表 II 的 H₂ 一行（两行共 20 格）全部重算出来，与论文一致；并列系数的 384 种先后次序都不影响结果。LiH 到 NH₃ 四行是论文原数，本页没有重算。
- **读者笔记**（页面里写成虚线框，并在“思”一节汇总）：
  1. 附录 A 说“FF 当且仅当图是线图”“TWC-FF 当且仅当各连通分量是线图”。线图的不交并仍是线图，照字面两者相同。按 Λ = 1 理解为“连通的线图”，H₂ 的 FF 才得到论文的 0.032 与 0.24(3)；只要求“是线图”会得 0.136。本页按连通实现。
  2. 论文说 TWC-AC 与 TWC-FF 都不如 FC；逐格看，TWC-FF 在 LiH 上略好（0.870 对 0.882），其余属实。
  3. *ε*²*M* 依赖于态：表 I 用精确基态。H₂ 的 ψ(*α*) 曲线显示，离开基态时大碎片的优势缩小，在 HF 态三种拆法相同。
- **教学示意**：卷首图；两比特 𝔰𝔬(5) 与直和的例子、ψ(*α*) 一族态是本页为讲解选的，不是论文里的数据。

## 核验

- `source/verify.mjs`：46 项，全部通过，见 [`verification.json`](./verification.json)。包括：泡利乘法表、对易判据、对称性判据；误差函数与 Szabo–Ostlund 表中的 H₂ 积分、*E*<sub>HF</sub> 与 FCI（*R* = 1.4 玻尔）；1 Å 下的 15 个泡利项、基态电子数与能量；表 I、表 II 的 H₂ 一行与 384 种并列次序；FF 两种理解的对照；Z₁、Z₃、Z₀Z₂ 为对称算符、孪生类与商图；8 个扇区给出全部 16 个能级；测量线路把 *H* 化成对角阵；CNOT 的共轭关系；ψ(*α*) 一族态的三条曲线；抽样模型的均值与方差；𝔰𝔬(5) 的封闭性、实对称生成元成二部图、标准形、谱 ±*ε*₁ ± *ε*₂、吉文斯步 ↔ 泡利指数门（各 60 组随机）；直和例子的谱与对易（40 组）；论文图 1、2、3、爪、蛛形的分类与根图；Hasse 图 14 条包含关系在 600 个随机图上成立；式 (24) 的最优分配；小题一、四的断言；式 (f) 的因式分解写法；表 I、表 II 的逐格结论。
- `source/qa-browser.mjs`：在 Chrome 里以 1366 px 与 390 px、浅色与深色各开一次，检查零网络请求、零脚本报错、无横向溢出、11 块画布都画上了墨、7 个题跋非空；再拨滑块、点选项、拖圆盘、点扇区、换预设、在图上连两条边、重抽样本、换分子与表、点开术语弹注，共 28 步，确认读数跟着变、转完后只剩两项、回到基态时 NC 方差为 0、H₂ 重算与论文一致。结果见 [`qa-browser.json`](./qa-browser.json)。
- `source/build.mjs`：构建前读取 `verification.json`（有失败项就拒绝构建），检查公式编号与引用、术语与总表一一对应且顺序一致、id 不重复、没有外链资源。

## 参考文献

1. S. Patel, A. F. Izmaylov, Exactly solvable Hamiltonian fragments obtained from a direct sum of Lie algebras, arXiv:2402.09376v1 [quant-ph] (2024)，<https://arxiv.org/abs/2402.09376>。
2. S. Patel, T.-C. Yen, A. F. Izmaylov, Extension of exactly-solvable Hamiltonians using symmetries of Lie algebras, arXiv:2305.18251 (2023)，<https://arxiv.org/abs/2305.18251>。
3. A. Chapman, S. T. Flammia, Characterization of solvable spin models via graph invariants, *Quantum* **4**, 278 (2020)。
4. W. M. Kirby, P. J. Love, Classical simulation of noncontextual Pauli Hamiltonians, *Phys. Rev. A* **102**, 032418 (2020)。
5. O. Crawford, B. van Straaten, D. Wang, T. Parks, E. Campbell, S. Brierley, Efficient quantum measurement of Pauli operators in the presence of finite sampling error, *Quantum* **5**, 385 (2021)。
6. L. W. Beineke, Characterizations of derived graphs, *J. Combin. Theory* **9**, 129–135 (1970)。
7. A. Szabo, N. S. Ostlund, *Modern Quantum Chemistry*, 第 3 章（H₂ 的 STO-3G 积分）。
8. J. T. Seeley, M. J. Richard, P. J. Love, The Bravyi–Kitaev transformation for quantum computation of electronic structure, *J. Chem. Phys.* **137**, 224109 (2012)。
9. B. C. Hall, *Lie Groups, Lie Algebras, and Representations: An Elementary Introduction*, 2nd ed., Springer GTM 222 (2015)，第 11 章。

## 技术

单文件 HTML（约 1.4 MB，大部分是内嵌的 KaTeX 字体）。数值代码 `source/frag.js` 由页面和 verify.mjs 共用：泡利串用两个位掩码，实对称矩阵用雅可比转动对角化，复厄米矩阵嵌入成两倍大的实对称矩阵，Krausz 分解用带剪枝的回溯搜索，H₂ 的积分用误差函数算 Boys 函数。预设图与论文表格在 `source/presets.js`。互动图是手写的 Canvas 2D，笔触与前两个专题同一套（`source/ink.js`、`source/ink.css`），本页另加 `source/page.css`。无 WebGL、无第三方运行库、无 CDN、无在线字体。浅色／深色随系统。

```bash
cd topics/direct-sum-fragments
deno install
deno run -A source/verify.mjs      # 数值核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html（先读 verification.json）
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png
```
