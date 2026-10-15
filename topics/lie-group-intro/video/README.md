# 科普动画：连珠成圆，以切知圆

和专题页对应的中文动画。成片 [`lie-group-intro-voice.mp4`](./lie-group-intro-voice.mp4)：3 分 41 秒，1920 × 1080，30 fps，H.264 + AAC，中文真人配音，字幕烧在画面里，[`poster.jpg`](./poster.jpg) 是专题页播放器的海报。七场依次是：开场、连（从点群到圆）、切（李代数）、卷（指数映射与平面的流）、括（李括号）、覆（*SU*(2) 与自旋）、收尾。画面用页面同一套水墨笔触，数值部分调用 `../source/lie.js` 现算：级数部分和、2×2 矩阵的 exp、球面四段弧和群换位子都是真实计算的结果，风车、转盘和闭路是示意。

## 文件

| 文件 | 作用 |
|---|---|
| `script.mjs` | 旁白稿：每场若干句，`say` 是念的（避开希腊字母），`sub` 是字幕 |
| `renderer.html` / `renderer.js` | 逐帧渲染器：`renderAt(t)` 只依赖时间 *t* 和时间轴，画布画图，KaTeX 排公式，DOM 叠字幕；`?tl=` 选时间轴文件 |
| `render.mjs` | Chrome 里逐帧截图，经管道交给 ffmpeg 与旁白合成 MP4；`--stills` 只截几帧 |
| `tts.ps1`、`build-audio.mjs` | 合成旁白：Windows 离线语音（默认 Microsoft Huihui）逐句合成，拼成 `out/narration.wav` 与时间轴 `out/timeline.js` |
| `align-voice.mjs` | 真人录音逐句对齐：以合成旁白的时间轴为参照，在每个预期句界附近找停顿；`--set k=a-b` 手动指定句界 |
| `splice-voice.mjs` | 两次录音拼接：重录切块、逐块识别、动态规划分句，与第一次录音的其余各句按统一停顿重排，写出 `out/narration-user.wav` 与 `out/timeline-user.js`，并逐句识别核对 |
| `asr.ps1` | Windows 离线中文识别器（zh-CN 听写），只用于核对切分是否正确 |
| `timeline-voice.js` | 成片所用的时间轴（每句起止、字幕），由 `splice-voice.mjs` 生成 |

`out/` 是工作目录，不入库（中间音频、截图、识别切片）。作者的原始录音也不在库里。

## 重新生成

需要 Deno 2、Chrome、ffmpeg（含 libx264），以及 `topics/lie-group-intro` 下 `deno install` 装好的 katex 与 playwright-core。

合成旁白版：

```bash
cd topics/lie-group-intro
deno run -A video/build-audio.mjs          # 旁白与时间轴；换声音加 --voice "Microsoft Yaoyao"
deno run -A video/render.mjs               # 整片 → video/out/lie-group-intro.mp4，约 10 分钟
```

真人配音版（录音放进 `video/out/voice/`）：

```bash
deno run -A video/build-audio.mjs                                   # 先要有合成旁白的时间轴作参照
deno run -A video/align-voice.mjs video/out/voice/take1.m4a --set 18=156.03-156.84
deno run -A video/splice-voice.mjs video/out/voice/take2.m4a video/out/voice/take1.m4a
deno run -A video/render.mjs --tl timeline-user.js --audio narration-user.wav --name lie-group-intro-voice.mp4
```

本片的 `align-voice.mjs` 还用了 `--set 0=6.14-6.60 --set 2=25.78-26.59 --set 3=28.79-29.49 --set 4=37.60-38.05 --set 13=112.67-113.50`：第一次录音前 80 秒很闷，识别器听不出字，这几处按原始录音里 ≥ 0.35 s 的停顿手动定句界（这几句最后都换成了重录）；第 13、18 句界由识别结果判定。

改了旁白稿要重跑上面几步，动画会按新的时间轴自动对齐。
