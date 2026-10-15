// 拼接两次录音：第二次（重录）提供第 0–9 句（和可选的第 19 句），第一次提供其余各句（句界取自 align-voice.mjs 的结果）。
// 重录这条在每个停顿处切块，逐块识别，再用动态规划把所有块按顺序分给各句：识别结果和该句越像、句首前的停顿越长，得分越高。
// 块一律不丢（识别器常把清楚的话识别成乱码，丢掉就会剪掉真话）。第 19 句只有在识别结果明显像它时才用重录。
// 最后每句裁出来、首尾 15 ms 淡入淡出，按统一停顿重新排成 out/narration-user.wav，并写出 out/timeline-user.js。
// 用法：deno run -A video/splice-voice.mjs out/voice/take2.m4a out/voice/take1.m4a
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { scenes } from "./script.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
const [take2, take1] = process.argv.slice(2).map((p) => path.resolve(here, p));
const FILT = "highpass=f=70,afftdn=nr=10:nf=-40,loudnorm=I=-16:TP=-1.5:LRA=11";
const decode = (f, sr) => { const b = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", f, "-af", FILT, "-ar", String(sr), "-ac", "1", "-f", "s16le", "-"], { maxBuffer: 1 << 30 }); return new Int16Array(b.buffer, b.byteOffset, b.length / 2); };
const all = scenes.flatMap((s, si) => s.lines.map((l, j) => ({ si, j, say: l.say, sub: l.sub || l.say })));
const wav = (int16, sr) => { const b = Buffer.alloc(44 + int16.length * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + int16.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(int16.length * 2, 40); Buffer.from(int16.buffer, int16.byteOffset, int16.length * 2).copy(b, 44); return b; };
const asr = (files, name) => {
  const list = path.join(out, "voice", name + "-list.json"), res = path.join(out, "voice", name + "-asr.json");
  fs.writeFileSync(list, JSON.stringify(files), "utf8");
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "asr.ps1"), "-List", list, "-Out", res], { stdio: "inherit" });
  const r = JSON.parse(fs.readFileSync(res, "utf8").replace(/^﻿/, "")); return (Array.isArray(r) ? r : [r]).map((x) => x.text || "");
};
const norm = (s) => s.replace(/[\s，。、；：？！“”‘’（）,.;:?!()\[\]·\-—]/g, "");
const bag = (s) => { const m = new Map(); for (const ch of norm(s)) m.set(ch, (m.get(ch) || 0) + 1); return m; };
const overlap = (a, b) => { const A = bag(a), B = bag(b); let c = 0, na = 0, nb = 0; for (const [k, v] of A) { na += v; c += Math.min(v, B.get(k) || 0); } for (const v of B.values()) nb += v; return na + nb ? (2 * c) / (na + nb) : 0; };

// ── 1. 重录：能量包络 → 停顿 → 语音块 ──
const SR = 16000, HOP = 0.01, p2 = decode(take2, SR), N = Math.floor(p2.length / (SR * HOP));
const db = new Float64Array(N);
for (let i = 0; i < N; i++) { let s = 0; for (let k = i * 160; k < (i + 1) * 160; k++) s += p2[k] * p2[k]; db[i] = 10 * Math.log10(s / 160 / 32768 / 32768 + 1e-12); }
const sm = db.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - 2); k <= Math.min(N - 1, i + 2); k++) { s += db[k]; c++; } return s / c; });
// 停顿用 ffmpeg silencedetect（原始录音，−35 dB，≥ 0.3 s）：这台机器上它找到的停顿和句界最吻合
const silOut = spawnSync("ffmpeg", ["-hide_banner", "-i", take2, "-af", "highpass=f=80,silencedetect=n=-35dB:d=0.3", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const st = [...silOut.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]), en = [...silOut.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const pauses = st.map((a, i) => [a, en[i] ?? N * HOP]);
const chunks = [], pauseBefore = [];
{ let cur = 0, prevPause = 0;
  for (const [a, b] of [...pauses, [N * HOP, N * HOP]]) { if (a - cur >= 0.25) { chunks.push([cur, a]); pauseBefore.push(prevPause); } cur = b; prevPause = b - a; } }

const dir2 = path.join(out, "voice", "take2-chunks"); fs.rmSync(dir2, { recursive: true, force: true }); fs.mkdirSync(dir2, { recursive: true });
const cfiles = chunks.map(([a, b], i) => { const f = path.join(dir2, `${String(i).padStart(2, "0")}.wav`); fs.writeFileSync(f, wav(p2.slice(Math.max(0, Math.round((a - 0.12) * SR)), Math.round((b + 0.12) * SR)), SR)); return f; });
const ctext = asr(cfiles, "take2");

// ── 2. 动态规划：把全部块按顺序分成 10 句（第 0–9 句），每句 1–10 块；得分 = Σ 识别重合度×句长 + β×句首前停顿 ──
const BETA = 3;
const score = (i, k, t) => overlap(ctext.slice(i, k).join(""), all[t].say) * norm(all[t].say).length + (i === 0 ? 0 : BETA * pauseBefore[i]);
const partition = (T, C) => {
  const F = Array.from({ length: C + 1 }, () => new Float64Array(T + 1).fill(-1e9)), B = Array.from({ length: C + 1 }, () => new Array(T + 1).fill(-1));
  F[0][0] = 0;
  for (let j = 0; j < T; j++) for (let i = 0; i < C; i++) { if (F[i][j] < -1e8) continue; for (let k = i + 1; k <= Math.min(C, i + 10); k++) { const v = F[i][j] + score(i, k, j); if (v > F[k][j + 1]) { F[k][j + 1] = v; B[k][j + 1] = i; } } }
  if (F[C][T] < -1e8) throw new Error("分不成 " + T + " 句");
  const segs = []; let k = C; for (let j = T; j > 0; j--) { const i = B[k][j]; segs.unshift([i, k]); k = i; }
  return segs;
};
const C = chunks.length;
const take2Lines = new Map(partition(10, C).map(([i, k], t) => [t, { a: chunks[i][0], b: chunks[k - 1][1], chunks: [i, k - 1], text: ctext.slice(i, k).join("") }]));
// 第 19 句：只有当最后几块明显像它（重合度 ≥ 0.35）时才算重录了
for (let i = C - 1; i >= Math.max(0, C - 4); i--) {
  const txt = ctext.slice(i).join("");
  if (overlap(txt, all[19].say) >= 0.35 && take2Lines.get(9).chunks[1] >= i) {
    const segs = partition(10, i);
    if (segs.length === 10) { take2Lines.clear(); segs.forEach(([a, k], t) => take2Lines.set(t, { a: chunks[a][0], b: chunks[k - 1][1], chunks: [a, k - 1], text: ctext.slice(a, k).join("") })); take2Lines.set(19, { a: chunks[i][0], b: chunks[C - 1][1], chunks: [i, C - 1], text: txt }); }
    break;
  }
}

// ── 3. 第一次录音里其余各句：align-voice.mjs 的结果（时间轴减去当时补的开头留白） ──
const rep1 = JSON.parse(fs.readFileSync(path.join(out, "align-report.json"), "utf8"));
const take1Lines = new Map(rep1.lines.map((l) => [l.i, { a: l.start - rep1.delayAdded + 0.06, b: l.end - rep1.delayAdded - 0.06 }]));

// ── 4. 逐句裁剪、淡入淡出、统一停顿重排 ──
const OSR = 48000, P = { take2: decode(take2, OSR), take1: decode(take1, OSR) };
const LEAD = 1.2, GAP = 0.6, SCENE_GAP = 1.4, TAIL = 3.0, PAD = 0.07, FADE = Math.round(0.015 * OSR);
// 真人录音和稿子不一样的地方：字幕照实际念的写（第一次录音第 19 句只念了前半句）
const SUB = { 19: "这个偏差，就是李括号。" };
const pieces = [new Int16Array(Math.round(LEAD * OSR))], lines = [];
let t = LEAD;
all.forEach((ln, i) => {
  const src = take2Lines.has(i) ? "take2" : "take1", seg = (src === "take2" ? take2Lines : take1Lines).get(i);
  const x = P[src].slice(Math.max(0, Math.round((seg.a - PAD) * OSR)), Math.round((seg.b + PAD) * OSR));
  for (let k = 0; k < FADE && k < x.length; k++) { x[k] = Math.round(x[k] * k / FADE); x[x.length - 1 - k] = Math.round(x[x.length - 1 - k] * k / FADE); }
  const dur = x.length / OSR;
  lines.push({ scene: ln.si, idx: ln.j, start: +t.toFixed(3), end: +(t + dur).toFixed(3), sub: src === "take1" && SUB[i] ? SUB[i] : ln.sub, src, from: +seg.a.toFixed(2) });
  pieces.push(x); t += dur;
  const last = i === all.length - 1, sceneEnd = !last && all[i + 1].si !== ln.si, pause = last ? TAIL : i === 0 ? 2.2 : sceneEnd ? SCENE_GAP : GAP; // 开场那句后多停一会儿，让圆相和朱印画完
  pieces.push(new Int16Array(Math.round(pause * OSR))); t += pause;
});
const pcm = Int16Array.from(pieces.flatMap((p) => Array.from(p)));
const tmp = path.join(out, "voice", "spliced-raw.wav"); fs.writeFileSync(tmp, wav(pcm, OSR));
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", String(OSR), "-ac", "1", path.join(out, "narration-user.wav")]);
const total = pcm.length / OSR;
const sceneSpans = scenes.map((sc, si) => {
  const ls = lines.filter((l) => l.scene === si), prev = lines.filter((l) => l.scene === si - 1).pop(), next = lines.find((l) => l.scene === si + 1);
  return { id: sc.id, seal: sc.seal, title: sc.title, start: +(si === 0 ? 0 : (prev.end + ls[0].start) / 2).toFixed(3), end: +(next ? (ls[ls.length - 1].end + next.start) / 2 : total).toFixed(3) };
});
fs.writeFileSync(path.join(out, "timeline-user.js"), "window.TL = " + JSON.stringify({ duration: +total.toFixed(3), voice: "user recordings: take2 (0–9" + (take2Lines.has(19) ? ", 19" : "") + "), take1 (rest)", sampleRate: OSR, scenes: sceneSpans, lines }, null, 1) + ";\n");

// ── 5. 核对：拼好的每句再识别一遍，看是否和自己那一句最像 ──
const dirF = path.join(out, "voice", "final-lines"); fs.rmSync(dirF, { recursive: true, force: true }); fs.mkdirSync(dirF, { recursive: true });
const ffiles = lines.map((l, i) => { const f = path.join(dirF, `${String(i).padStart(2, "0")}.wav`); const a = Math.round(l.start * OSR), b = Math.round(l.end * OSR); const x = pcm.slice(a, b), y = new Int16Array(Math.floor(x.length / 3)); for (let k = 0; k < y.length; k++) y[k] = x[k * 3]; fs.writeFileSync(f, wav(y, 16000)); return f; });
const ftext = asr(ffiles, "final");
const check = ftext.map((tx, i) => { const sc = all.map((l) => overlap(tx, l.say)), best = sc.indexOf(Math.max(...sc)); return { i, src: lines[i].src, own: +sc[i].toFixed(2), best, ok: best === i, text: tx }; });
fs.writeFileSync(path.join(out, "voice", "splice-report.json"), JSON.stringify({ chunks: chunks.map((c, i) => ({ i, a: +c[0].toFixed(2), b: +c[1].toFixed(2), text: ctext[i] })), take2: Object.fromEntries(take2Lines), check, duration: total }, null, 1));
console.log(`重录切成 ${C} 块；第 19 句${take2Lines.has(19) ? "用重录" : "仍用第一次录音"}；总长 ${total.toFixed(2)} s`);
for (const [ti, s] of [...take2Lines].sort((a, b) => a[0] - b[0])) console.log(`重录 → 第 ${String(ti).padStart(2)} 句  ${s.a.toFixed(2)}–${s.b.toFixed(2)}  块 ${s.chunks.join("–")}  ${s.text.slice(0, 30)}`);
console.log("块：" + chunks.map((c, i) => `${i}[${c[0].toFixed(1)}–${c[1].toFixed(1)}，前停 ${pauseBefore[i].toFixed(2)}]${ctext[i] || "—"}`).join(" | "));
for (const c of check) console.log(`${String(c.i).padStart(2)} ${c.src} 本句 ${c.own.toFixed(2)} 最像 ${String(c.best).padStart(2)}${c.ok ? "  " : " ✗"} ${c.text.slice(0, 34)}`);
