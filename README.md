# Lie Group Graph｜李群图解

李群与李代数的中文交互图解。每一页都是一张水墨长卷：在单位元处取切线，用指数映射卷回去，用括号量出不可交换。凡用到数学分析的地方都有朱批注释，图上的数由浏览器现算，结论由脚本复核。

在线阅读：<https://uugyfgyb.github.io/Lie-Group-Graph/>

## 专题

| 分类 | 专题 | 内容 | 入口 |
|---|---|---|---|
| 入门：从圆到自旋 | [`lie-group-intro`](./topics/lie-group-intro/) | 连珠成圆，以切知圆：点群 → *SO*(2)、李代数、指数映射、李括号、*SU*(2) 双覆盖 *SO*(3) 与自旋；附 3 分 41 秒中文配音动画和英文版 | [打开](./topics/lie-group-intro/index.html) · [看动画](./topics/lie-group-intro/video/lie-group-intro-voice.mp4) · [English version](./topics/lie-group-intro/video/lie-group-intro-en.mp4) |
| 论文图解：可解哈密顿量 | [`solvable-hamiltonians`](./topics/solvable-hamiltonians/) | 以符代数，分块而治：Patel、Yen、Izmaylov（arXiv:2305.18251）。把李代数元素的实系数换成对称算符的多项式，每个扇区各转各的；𝔰𝔬(*L*+1) + 泡利对称 = 非上下文泡利哈密顿量，费米子上得到平均场可解哈密顿量；附 5 条读注 | [打开](./topics/solvable-hamiltonians/index.html) |
| 论文图解：可解哈密顿量 | [`direct-sum-fragments`](./topics/direct-sum-fragments/) | 拆图成片，片片可解：Patel、Izmaylov（arXiv:2402.09376），上一篇的续作。VQE 的测量问题 → 𝔰𝔬(*N*) 直和 + 泡利对称的九类可解碎片 → 反相容图上的团、线图（Krausz 分解、根图）与孪生商图 → 拆分与测量线路；H₂ 从 STO-3G 积分算起，论文表 I、表 II 的 H₂ 一行全部重算；附 3 条读者笔记 | [打开](./topics/direct-sum-fragments/index.html) |

## 结构

```
Lie-Group-Graph/
├── index.html                       目录页（浅色／深色自适应）
├── README.md
├── .nojekyll
└── topics/
    ├── lie-group-intro/
        ├── index.html               单文件专题页，可离线打开（由 source/build.mjs 生成）
        ├── README.md                内容、分层、来源与核验
        ├── preview.png / preview-mobile.png
        ├── verification.json        source/verify.mjs 的 23 项数值核验
        ├── qa-browser.json          source/qa-browser.mjs 的浏览器验收
        ├── package.json             构建与核验依赖（katex、playwright-core）
        ├── video/                   配音动画：成片、海报、旁白稿与制作脚本（见 video/README.md）
        │   ├── lie-group-intro-voice.mp4   3 分 41 秒，1920 × 1080，中文真人配音，字幕烧在画面里
        │   ├── poster.jpg
        │   ├── lie-group-intro-en.mp4      英文版，3 分 59 秒：英文旁白（合成语音）、字幕与画面文字
        │   └── cover-en.jpg                英文版封面
    │   └── source/
    │       ├── page.html            页面模板（正文、公式、朱批、术语总表）
    │       ├── ink.css              水墨样式
    │       ├── lie.js               矩阵指数、so(3)／su(2)、SU(2)→SO(3)，页面与核验脚本共用
    │       ├── ink.js               画布笔触、主题色、术语弹注
    │       ├── app.js               七幅互动图
    │       ├── build.mjs            合成 index.html，拒绝任何在线资源
    │       ├── verify.mjs           数值核验
    │       └── qa-browser.mjs       真实浏览器验收
    ├── solvable-hamiltonians/       论文图解，文件布局同上（无 video/）
    │   ├── index.html · README.md · preview*.png · package.json
    │   ├── verification.json        source/verify.mjs 的 38 项数值核验
    │   ├── qa-browser.json          source/qa-browser.mjs 的浏览器验收
    │   └── source/
    │       ├── page.html            页面模板；公式右边是本页编号，下面小字是原文式号
    │       ├── solv.js              复矩阵、泡利串、逐次转动、三比特例子、非上下文判定、费米子例子，页面与核验脚本共用
    │       ├── app.js               卷首与七幅互动图
    │       └── ink.css · ink.js · build.mjs · verify.mjs · qa-browser.mjs
    └── direct-sum-fragments/        论文图解（续篇），文件布局同上
        ├── index.html · README.md · preview*.png · package.json
        ├── verification.json        source/verify.mjs 的 46 项数值核验
        ├── qa-browser.json          source/qa-browser.mjs 的浏览器验收
        └── source/
            ├── page.html            页面模板；公式编号直接用原文式号，本页补的式子编 (a)–(h)
            ├── frag.js              泡利串、反相容图判据（Krausz 分解、孪生商图）、排序插入、so(N) 标准形与吉文斯分解、H₂ 积分与 BK 哈密顿量，页面与核验脚本共用
            ├── presets.js           判别器的预设图、Hasse 包含关系、论文表 I 与表 II
            ├── app.js               卷首与七幅图
            └── ink.css · page.css · ink.js · build.mjs · verify.mjs · qa-browser.mjs
```

## 本库规则

1. **页面不得依赖在线资源**：不引用 CDN、在线字体或第三方运行库。公式在构建时用 KaTeX 渲染成静态 HTML，只内嵌用得到的字体；中文用本地楷体、宋体字体栈。单个 `index.html` 下载后即可离线阅读；参考文献外链除外。`build.mjs` 发现外链资源会拒绝构建。
2. **凡用到数学分析的地方都要有朱批**：求导、极限、级数收敛、泰勒展开、交换求和次序，旁边用红字白话说明这一步在做什么、凭什么可以这样做。
3. **结论必须可复算**：页面上写出的括号关系、矩阵指数、行列式与迹、收敛速度等数值结论，都由 `verify.mjs` 用页面同一份数值代码（`lie.js`、`solv.js`、`frag.js`）再算一遍。
4. **分层标注**：用 定义 / 定理 / 示意 / 数值 四种标签分清教材结论、教学示意图和浏览器现算的数；不把示意图写成精确结论。
5. **术语中英对照**：可点开的术语在页末汇总为注释总表；`build.mjs` 检查正文与总表一一对应、按首次出现的顺序排列。
6. 只有 `main` 分支，每次提交直接推送到 `main`。

## 新增专题

1. 在 `topics/` 下建简短、稳定、全小写的目录，主网页命名为 `index.html`，附属文件用相对路径引用。
2. 同步更新根 `index.html` 的卡片与上面的专题表。
3. 专题 README 写明内容、分层、来源与核验方式。

## 本地构建与核验

本机只需 [Deno](https://deno.com) 2（或 Node ≥ 18）。每个专题各自构建，以第一个专题为例：

```bash
cd topics/lie-group-intro
deno install
deno run -A source/verify.mjs      # 数值核验 → verification.json
deno run -A source/build.mjs       # 生成 index.html
deno run -A source/qa-browser.mjs  # 浏览器验收 → qa-browser.json、preview*.png（需本机 Chrome / Chromium / Edge）
```

动画的重新生成（合成旁白或换真人配音）见 [`topics/lie-group-intro/video/README.md`](./topics/lie-group-intro/video/README.md)，另需 ffmpeg。
