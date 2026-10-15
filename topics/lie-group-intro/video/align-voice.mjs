// 用真人配音替换合成旁白：把录音逐句对齐到 script.mjs 的 28 句，写出新的时间轴，动画按它重新渲染。
// 录音是对着原视频跟读的，所以每个句间停顿都在原时间轴（out/timeline.js）附近；这里在附近找最像停顿的一段静音当句界。
// 用法：deno run -A video/align-voice.mjs "C:/path/录音.m4a" [--set 18=156.03-156.84 ...]
//   --set k=a-b：手动指定第 k 与 k+1 句之间的停顿（录音原始时间，秒），用于识别核对发现切错的句界
// 输出：out/narration-user.wav（降噪、响度归一、开头留白、结尾补静音）、out/timeline-user.js、out/align-report.json、out/segments/*.wav（逐句切片，供识别核对）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { scenes } from "./script.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
const src = process.argv[2];
if (!src || !fs.existsSync(src)) throw new Error("给出录音文件路径");
const readTL = (f) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8").replace(/^window\.TL = /, "").replace(/;\s*$/, ""));
const ref = readTL("timeline.js"); // 合成旁白的时间轴，作为每个句界的大致位置
const LEAD = 1.2, TAIL = 3.0, HOP = 0.01;

// 1. 先只做滤波（高通、轻度降噪、响度归一）到 16 kHz 单声道，用来分析
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const FILT = "highpass=f=70,afftdn=nr=10:nf=-40,loudnorm=I=-16:TP=-1.5:LRA=11";
const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", src, "-af", FILT, "-ar", "16000", "-ac", "1", "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
const pcm = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2), SR = 16000, N = Math.floor(pcm.length / (SR * HOP));
// 10 ms 一帧的能量（dB），再做 5 帧滑动平均
const db0 = new Float64Array(N);
for (let i = 0; i < N; i++) { let s = 0; for (let k = i * 160; k < (i + 1) * 160; k++) s += pcm[k] * pcm[k]; db0[i] = 10 * Math.log10(s / 160 / 32768 / 32768 + 1e-12); }
const db = db0.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(N - 1, i + 2); k++) { s += db0[k]; c++; } return s / c; });
const sorted = Array.from(db).sort((a, b) => a - b), pct = (p) => sorted[Math.floor(p * (N - 1))];
const floor = pct(0.08), loud = pct(0.85), thr = floor + 0.32 * (loud - floor);
// 阈值随位置变：录音前后段底噪和音量不同（前 80 秒很闷），按前后 15 秒内的分位数各算一个
const thrSec = Array.from({ length: Math.ceil(N * HOP) + 1 }, (_, sec) => {
  const a = Math.max(0, Math.round((sec - 15) / HOP)), b = Math.min(N, Math.round((sec + 15) / HOP)), w = Array.from(db.slice(a, b)).sort((x, y) => x - y);
  const q = (p) => w[Math.floor(p * (w.length - 1))]; return q(0.08) + 0.32 * (q(0.85) - q(0.08));
});
const quiet = (i) => db[i] < thrSec[Math.floor(i * HOP)];
const manual = new Map(process.argv.slice(3).flatMap((x, i, arr) => (arr[i - 1] === "--set" ? [x] : [])).map((x) => { const m = x.match(/^(\d+)=([\d.]+)-([\d.]+)$/); if (!m) throw new Error("--set 格式应为 k=a-b"); return [+m[1], [+m[2], +m[3]]]; }));

// 2. 整体偏移：录音的“有声”与原时间轴的句子区间对得最齐的平移量
const refLines = ref.lines;
const refActive = (t) => refLines.some((l) => t >= l.start && t < l.end);
let best = { off: 0, score: -1 };
for (let off = -3; off <= 3.001; off += 0.05) {
  let sc = 0; for (let i = 0; i < N; i += 5) { const a = !quiet(i), b = refActive(i * HOP - off); if (a === b) sc++; }
  if (sc > best.score) best = { off, score: sc };
}
const OFF = best.off; // 录音时间 = 原时间 + OFF

// 3. 每个句界：在原停顿位置 ±2.2 s 内找静音段，打分 = 长度 − 0.35 × 离预期的距离
const runs = []; { let s = -1; for (let i = 0; i <= N; i++) { const q = i < N && quiet(i); if (q && s < 0) s = i; if (!q && s >= 0) { runs.push([s * HOP, i * HOP]); s = -1; } } }
const firstOn = (() => { for (let i = 0; i < N - 10; i++) if (!quiet(i) && !quiet(i + 5) && !quiet(i + 10)) return i * HOP; return 0; })();
const lastOff = (() => { for (let i = N - 1; i > 10; i--) if (!quiet(i) && !quiet(i - 5) && !quiet(i - 10)) return (i + 1) * HOP; return N * HOP; })();
const bounds = [];
let prevEnd = firstOn;
for (let k = 0; k < refLines.length - 1; k++) {
  const mid = (refLines[k].end + refLines[k + 1].start) / 2 + OFF, minT = prevEnd + 0.6;
  const cand = runs.filter(([a, b]) => b - a >= 0.12 && a >= minT && Math.abs((a + b) / 2 - mid) <= 2.2);
  let pick, how;
  if (manual.has(k)) { pick = manual.get(k); how = "manual"; }
  else if (cand.length) { pick = cand.reduce((p, r) => { const sc = (r[1] - r[0]) - 0.6 * Math.abs((r[0] + r[1]) / 2 - mid); return !p || sc > p.sc ? { r, sc } : p; }, null).r; how = "pause"; }
  else { // 没有停顿：取预期位置 ±1 s 内能量最低的一帧
    let mi = -1; for (let i = Math.max(Math.round(minT / HOP), Math.round((mid - 1) / HOP)); i <= Math.min(N - 1, Math.round((mid + 1) / HOP)); i++) if (mi < 0 || db[i] < db[mi]) mi = i;
    pick = [mi * HOP, mi * HOP]; how = "dip";
  }
  bounds.push({ k, a: pick[0], b: pick[1], expected: +mid.toFixed(2), how, gap: +(pick[1] - pick[0]).toFixed(2) });
  prevEnd = pick[1];
}
// 句 i 的区间：上一个句界的静音结束 → 下一个句界的静音开始（各留 60 ms 余量）
const seg = refLines.map((_, i) => ({ start: i === 0 ? firstOn - 0.05 : bounds[i - 1].b - 0.06, end: i === refLines.length - 1 ? lastOff + 0.05 : bounds[i].a + 0.06 }));

// 4. 开头留白补到 LEAD 秒，结尾补 TAIL 秒静音，写出最终配音
const delay = Math.max(0, LEAD - seg[0].start), total = seg[seg.length - 1].end + delay + TAIL;
ff(["-i", src, "-af", `${FILT},adelay=${Math.round(delay * 1000)}:all=1,apad=whole_dur=${total.toFixed(3)}`, "-ar", "48000", "-ac", "1", path.join(out, "narration-user.wav")]);

// 5. 新时间轴（结构与 build-audio.mjs 写的相同，渲染器直接可用）
const lines = []; let li = 0;
scenes.forEach((sc, si) => sc.lines.forEach((ln, j) => { const s = seg[li++]; lines.push({ scene: si, idx: j, start: +(s.start + delay).toFixed(3), end: +(s.end + delay).toFixed(3), sub: ln.sub || ln.say }); }));
const sceneSpans = scenes.map((sc, si) => {
  const ls = lines.filter((l) => l.scene === si), prev = lines.filter((l) => l.scene === si - 1).pop();
  const start = si === 0 ? 0 : (prev.end + ls[0].start) / 2;
  const next = lines.find((l) => l.scene === si + 1), end = si === scenes.length - 1 ? total : (ls[ls.length - 1].end + next.start) / 2;
  return { id: sc.id, seal: sc.seal, title: sc.title, start: +start.toFixed(3), end: +end.toFixed(3) };
});
const TL = { duration: +total.toFixed(3), voice: "user recording: " + path.basename(src), sampleRate: 48000, scenes: sceneSpans, lines };
fs.writeFileSync(path.join(out, "timeline-user.js"), "window.TL = " + JSON.stringify(TL, null, 1) + ";\n");

// 6. 逐句切片（16 kHz WAV），给 asr.ps1 识别核对
const segDir = path.join(out, "segments"); fs.mkdirSync(segDir, { recursive: true });
const wav = (int16) => { const b = Buffer.alloc(44 + int16.length * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + int16.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(int16.length * 2, 40); Buffer.from(int16.buffer, int16.byteOffset, int16.length * 2).copy(b, 44); return b; };
const files = seg.map((s, i) => { const f = path.join(segDir, `${String(i).padStart(2, "0")}.wav`); fs.writeFileSync(f, wav(pcm.slice(Math.max(0, Math.round((s.start - 0.15) * SR)), Math.round((s.end + 0.15) * SR)))); return f; });
fs.writeFileSync(path.join(segDir, "list.json"), JSON.stringify(files), "utf8");

const report = { source: src, manual: Object.fromEntries(manual), offsetVsReference: +OFF.toFixed(2), thresholdDb: +thr.toFixed(1), floorDb: +floor.toFixed(1), speechDb: +loud.toFixed(1), delayAdded: +delay.toFixed(3), duration: TL.duration,
  bounds, lines: lines.map((l, i) => ({ i, start: l.start, end: l.end, dur: +(l.end - l.start).toFixed(2), refDur: +(refLines[i].end - refLines[i].start).toFixed(2), text: l.sub })) };
fs.writeFileSync(path.join(out, "align-report.json"), JSON.stringify(report, null, 1));
console.log(`偏移 ${OFF.toFixed(2)} s，阈值 ${thr.toFixed(1)} dB（底噪 ${floor.toFixed(1)}，语音 ${loud.toFixed(1)}），开头补 ${delay.toFixed(2)} s，总长 ${total.toFixed(2)} s`);
for (const b of bounds) console.log(`界 ${String(b.k).padStart(2)}|${String(b.k + 1).padStart(2)}  预期 ${b.expected.toFixed(2).padStart(7)}  取 ${b.a.toFixed(2).padStart(7)}–${b.b.toFixed(2).padStart(7)}  ${b.how} ${b.gap}s  差 ${(((b.a + b.b) / 2) - b.expected).toFixed(2)}`);
for (const l of report.lines) console.log(`${String(l.i).padStart(2)} ${l.start.toFixed(2).padStart(7)}–${l.end.toFixed(2).padStart(7)}  ${l.dur.toFixed(2).padStart(5)}s（原 ${l.refDur.toFixed(2)}）  ${l.text.slice(0, 18)}`);
