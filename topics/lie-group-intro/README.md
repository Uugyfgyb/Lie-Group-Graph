# 连珠成圆，以切知圆：李群入门

> [打开页面](./index.html) · 在线：<https://uugyfgyb.github.io/Lie-Group-Graph/topics/lie-group-intro/>

一页水墨长卷，讲李群与李代数的“一来一回”：在单位元处求导得到李代数（以圆代切），用指数映射把切线卷回群里，再用李括号量出转动的不可交换，最后看同一个李代数怎样对应 *SU*(2) 和 *SO*(3) 两个群、为什么自旋 ½ 转 2π 会变号。没有用户原图，内容按教材顺序编写。

## 页面包含

| 区块 | 内容 | 互动图 |
|---|---|---|
| 卷首 | 一笔圆相：墨珠由疏到密连成圆周群 *G*；朱点是单位元 *e*，朱线是切线 𝔤 = *T<sub>e</sub>G*；三条虚线是圆的渐开线，把切线上长 *s* 的点卷到圆上转角 *s* 处 | 静图 |
| 连 · 从点群到圆 | *C<sub>n</sub>* 的风车，*n* → ∞ 成为 *SO*(2)；李群的定义；常见矩阵李群表（条件与维数）；闭子群定理 | 风车：调 *n* 与转角 *θ*，看是否与自身重合 |
| 切 · 李代数 | 放大单位元附近，圆变直；*J* = d*R*/d*θ*；𝔰𝔬(*n*) 是反对称矩阵；det(*I* + *tX*) = 1 + *t* tr *X* + *O*(*t*²) 推出 𝔰𝔩(*n*) 无迹；*L<sub>x</sub>*、*L<sub>y</sub>*、*L<sub>z</sub>* | 放大镜：1×–300×，读出 *δ*/*y* |
| 卷 · 指数映射 | exp 级数的收敛与逐项求导；exp(*θJ*) = *R*(*θ*)；det exp *X* = *e*<sup>tr *X*</sup>；*SL*(2,ℝ) 的 exp 不是满射 | ① *e<sup>iθ</sup>* 的级数各项首尾相接，第 1 项正是切线段；② 2×2 矩阵的流：“李”字在转、剪、挤、螺四种流里变形，读 det exp(*tA*) |
| 括 · 李括号 | 群换位子 = *I* + *ε*²[*X*,*Y*] + *O*(*ε*³)；[*L<sub>x</sub>*,*L<sub>y</sub>*] = *L<sub>z</sub>*；角动量对易关系；李代数公理与雅可比恒等式；BCH 公式 | 可拖动的球：四段弧走完，回程差 ≈ 绕 *z* 转 *ε*²，附 *φ*/*ε*² 收敛表 |
| 覆 · *SU*(2) 与自旋 | 𝔰𝔲(2) 与 𝔰𝔬(3) 结构常数相同；*U<sub>z</sub>*(2π) = −*I*；双覆盖 *R*(*U*)<sub>*ij*</sub> = ½ tr(*σ<sub>i</sub>Uσ<sub>j</sub>U*†)；π₁(*SO*(3)) = ℤ₂；中子干涉实验；李第三定理 | ① 转盘、*SO*(3) 球、*SU*(2) 相位三联图，*θ* 到 720°；② *SO*(3) 球截面上的闭路：转 2π 缩不掉，转 4π 可以缩成一点 |
| 用 · 物理与化学 | *U*(1)、*SO*(3)、点群与晶体场劈裂、*SU*(2) 与核磁共振进动、*SL*(2,ℝ) 与 ABCD 矩阵、洛伦兹群与托马斯进动、*SU*(3) | 表 |
| 练 | 五道小题，答案折叠 | — |
| 析 | 注释总表 30 条，中英对照，按正文首次出现排序 | 正文术语可点开 |

## 动画

[`video/lie-group-intro-voice.mp4`](./video/lie-group-intro-voice.mp4)：3 分 41 秒，1920 × 1080，30 fps，H.264 + AAC，中文真人配音，字幕烧在画面里；页面顶部“片 · 先看三分钟动画”一节内嵌播放（在线：<https://uugyfgyb.github.io/Lie-Group-Graph/topics/lie-group-intro/#s-video>）。

七场依次对应页面各节：开场圆相 → 连（风车 *n* → ∞）→ 切（放大到 ×100）→ 卷（绕线、级数各项首尾相接、“李”字在流里变形）→ 括（球面四段弧与 ε²）→ 覆（转盘、*SO*(3) 球、*SU*(2) 相位同步转到 720°）→ 收尾。画面由 `video/renderer.js` 逐帧画出，数值部分调用本页同一份 `source/lie.js`。

配音是作者分两次录的：第 0–9 句用重录，第 10–27 句用第一次录音。`video/align-voice.mjs` 在第一次录音里按停顿找句界，`video/splice-voice.mjs` 把重录切块后用 Windows 离线识别器逐块识别、动态规划分句，两段逐句裁出、统一停顿后拼接；拼好的 28 句再识别一遍，27 句与自己那一句最像。例外是第 19 句：它在第一次录音里只有约 2 秒，后面跟着 2 秒静音，对齐时识别出的也只有前半句（“这个偏差就是李括号”），判断后半句没有念，字幕照此改为“这个偏差，就是李括号。”。对齐结果存为 `video/timeline-voice.js`。原始录音不在库里。

## 分层

- **用户原图**：无。
- **定义、定理**：教材标准内容（李群与李代数的定义、闭子群定理、det exp *X* = *e*<sup>tr *X*</sup>、BCH 公式、双覆盖、李第三定理等），推导步骤旁配朱批 22 条。
- **精确（脚本核验）**：so(3) 与 su(2) 的括号关系、雅可比恒等式、exp(*θL<sub>k</sub>*) 等于转动矩阵、*SU*(2) → *SO*(3) 二对一、*U<sub>z</sub>*(2π) = −*I*。
- **数值（浏览器现算）**：exp 级数的部分和、误差与余项上界；2×2 的 exp(*tA*)（凯莱-哈密顿闭式）与它的行列式；群换位子的转角 *φ*、转轴与 *φ*/*ε*²。显示到小数点后 2–4 位。
- **教学示意**：卷首的墨珠与圆相、风车、转盘、*SO*(3) 球截面上的闭路及其收缩过程。卷首绕线的形状是精确的（圆的渐开线），收缩过程只表示同伦的思路，不是唯一的收缩方式。

## 核验

- `source/verify.mjs`：23 项，全部通过，见 [`verification.json`](./verification.json)。包括 2–5 阶随机矩阵各 20 个的 det exp *X* = *e*<sup>tr *X*</sup>；30 个随机反对称矩阵的 exp 都是转动；exp 部分和误差总在余项上界之下；2×2 闭式与级数一致；随机两万个 *X* ∈ sl(2,ℝ) 都有 tr exp *X* ≥ −2；*φ*/*ε*² 在 *ε* = 1° 时与 1 相差小于 10⁻³、转轴偏离 *z* 小于 1.5°，余项随 *ε* 线性变小；BCH 截到二阶余项按三阶缩、截到三阶按四阶缩；50 个随机 *SU*(2) 元素映到对应转动且 ±*U* 同像。
- `source/qa-browser.mjs`：在 Chrome 里以 1366 px 与 390 px、浅色与深色各开一次，检查零网络请求、零脚本报错、无横向溢出、十块画布都画上了墨、题跋非空；再拨动九个滑块、点四个选项、播放一次、点开一次术语弹注，确认读数跟着变（15 步）；另外拖动一次球并截图。结果见 [`qa-browser.json`](./qa-browser.json)。
- `source/build.mjs`：构建时检查公式编号与引用、术语与总表一一对应且顺序一致、id 不重复、没有外链资源。

## 参考文献

1. Brian C. Hall, *Lie Groups, Lie Algebras, and Representations: An Elementary Introduction*, 2nd ed., Springer GTM 222 (2015)。
2. John Stillwell, *Naive Lie Theory*, Springer UTM (2008)。
3. J. J. Sakurai, J. Napolitano, *Modern Quantum Mechanics*, 第 3 章。
4. H. Rauch, A. Zeilinger, G. Badurek, A. Wilfing, W. Bauspiess, U. Bonse, Verification of coherent spinor rotation of fermions, *Phys. Lett. A* **54**, 425–427 (1975)，doi:[10.1016/0375-9601(75)90798-7](https://doi.org/10.1016/0375-9601(75)90798-7)。
5. S. A. Werner, R. Colella, A. W. Overhauser, C. F. Eagen, Observation of the phase shift of a neutron due to precession in a magnetic field, *Phys. Rev. Lett.* **35**, 1053–1055 (1975)，doi:[10.1103/PhysRevLett.35.1053](https://doi.org/10.1103/PhysRevLett.35.1053)。

## 技术

单文件 HTML（约 1 MB，大部分是内嵌的 KaTeX 字体）。互动图是手写的 Canvas 2D：笔触是沿折线铺的变宽带子，两头收锋，可选晕染与枯笔；三维球用正交投影，前后分段画实线与虚线。无 WebGL、无第三方运行库、无 CDN、无在线字体。浅色／深色随系统。
