// 旁白：script.mjs → 每句一个 WAV（tts.ps1，Windows 离线语音）→ 拼成一条 narration.wav，并写出时间轴 timeline.js。
// 运行：deno run -A video/build-audio.mjs [--voice "Microsoft Huihui"] [--rate -4%]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { scenes } from "./script.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const voice = arg("--voice", "Microsoft Huihui"), rate = arg("--rate", "-4%");
const dir = path.join(here, "out", "audio"); fs.mkdirSync(dir, { recursive: true });

// 节奏（秒）：开场留白、句间停顿、换场停顿、片尾留白
const LEAD = 1.2, GAP = 0.5, SCENE_GAP = 1.3, TAIL = 3.0;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const items = [];
scenes.forEach((sc, si) => sc.lines.forEach((ln, li) => {
  const file = path.join(dir, `${String(si).padStart(2, "0")}-${String(li).padStart(2, "0")}.wav`);
  items.push({ file, ssml: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><prosody rate="${rate}">${esc(ln.say)}</prosody></speak>`, si, li });
}));
fs.writeFileSync(path.join(dir, "lines.json"), JSON.stringify(items.map(({ file, ssml }) => ({ file, ssml }))), "utf8");
execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "tts.ps1"), "-List", path.join(dir, "lines.json"), "-Voice", voice], { stdio: "inherit" });

// 读 WAV：只接受 PCM，所有句子格式必须一致
function readWav(f) {
  const b = fs.readFileSync(f);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") throw new Error("不是 WAV：" + f);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4), size = b.readUInt32LE(p + 4), body = b.subarray(p + 8, p + 8 + size);
    if (id === "fmt ") fmt = { format: body.readUInt16LE(0), channels: body.readUInt16LE(2), rate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    if (id === "data") data = body;
    p += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.format !== 1) throw new Error("WAV 不是 PCM：" + f);
  return { fmt, data };
}
// 去掉每句首尾的静音（阈值约 −50 dB），让停顿只由上面的节奏常数决定
function trim({ fmt, data }) {
  const bps = (fmt.bits / 8) * fmt.channels, n = data.length / bps, thr = 32768 * 0.003;
  const amp = (i) => Math.abs(data.readInt16LE(i * bps));
  let a = 0, z = n - 1; while (a < n && amp(a) < thr) a++; while (z > a && amp(z) < thr) z--;
  a = Math.max(0, a - Math.round(fmt.rate * 0.03)); z = Math.min(n - 1, z + Math.round(fmt.rate * 0.08));
  return data.subarray(a * bps, (z + 1) * bps);
}

const wavs = items.map((it) => ({ ...it, ...readWav(it.file) }));
const F = wavs[0].fmt;
for (const w of wavs) if (w.fmt.rate !== F.rate || w.fmt.channels !== F.channels || w.fmt.bits !== F.bits) throw new Error("各句 WAV 格式不一致");
const bps = (F.bits / 8) * F.channels, sec = (bytes) => bytes / bps / F.rate, silence = (s) => Buffer.alloc(Math.round(s * F.rate) * bps);

const parts = [silence(LEAD)], lines = [], sceneSpans = [];
let t = LEAD;
scenes.forEach((sc, si) => {
  const s0 = si === 0 ? 0 : t - SCENE_GAP / 2;
  sc.lines.forEach((ln, li) => {
    const pcm = trim(wavs.find((w) => w.si === si && w.li === li));
    lines.push({ scene: si, idx: li, start: +t.toFixed(3), end: +(t + sec(pcm.length)).toFixed(3), sub: ln.sub || ln.say });
    parts.push(pcm); t += sec(pcm.length);
    const pause = li < sc.lines.length - 1 ? GAP : si < scenes.length - 1 ? SCENE_GAP : TAIL;
    parts.push(silence(pause)); t += pause;
  });
  sceneSpans.push({ id: sc.id, seal: sc.seal, title: sc.title, start: +s0.toFixed(3), end: +(si === scenes.length - 1 ? t : t - SCENE_GAP / 2).toFixed(3) });
});
const pcm = Buffer.concat(parts), hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVE", 8); hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16);
hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(F.channels, 22); hdr.writeUInt32LE(F.rate, 24); hdr.writeUInt32LE(F.rate * bps, 28); hdr.writeUInt16LE(bps, 32); hdr.writeUInt16LE(F.bits, 34);
hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(path.join(here, "out", "narration.wav"), Buffer.concat([hdr, pcm]));
const TL = { duration: +t.toFixed(3), voice, rate, sampleRate: F.rate, scenes: sceneSpans, lines };
fs.writeFileSync(path.join(here, "out", "timeline.js"), "window.TL = " + JSON.stringify(TL, null, 1) + ";\n");
console.log(JSON.stringify({ duration: TL.duration, format: F, lines: lines.length, scenes: sceneSpans.map((s) => `${s.id} ${s.start}–${s.end}`) }, null, 1));
