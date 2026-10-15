// 渲染视频：在 Chrome 里逐帧调用 renderAt(t) 并截图，JPEG 帧经管道交给 ffmpeg，与 narration.wav 合成 MP4（H.264 + AAC）。
// 先运行 build-audio.mjs。用法：
//   deno run -A video/render.mjs                    整片 → out/lie-group-intro.mp4
//   deno run -A video/render.mjs --stills 3,20,60   只截几帧 → out/stills/*.png（检查画面用）
//   deno run -A video/render.mjs --from 80 --to 90  只渲染一段（检查节奏用）
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30;
const tlFile = arg("--tl", "timeline.js"), audioFile = arg("--audio", "narration.wav"), lang = arg("--lang", "zh");
const tlText = fs.readFileSync(path.join(out, tlFile), "utf8");
const TL = JSON.parse(tlText.replace(/^window\.TL = /, "").replace(/;\s*$/, ""));

const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Users/fujia/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe"].find((p) => fs.existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe, args: ["--allow-file-access-from-files"] } : { channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(here, "renderer.html")).href + "?tl=" + encodeURIComponent(tlFile) + "&lang=" + lang, { waitUntil: "load" });
await page.evaluate(() => window.renderReady);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

// 封面：--cover 输出路径（相对 video/），PNG
const cover = arg("--cover");
if (cover) {
  await page.evaluate(() => window.renderCover());
  const target = path.resolve(here, cover); fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target });
  console.log("cover →", target, errors.length ? errors : "");
  await browser.close(); process.exit(errors.length ? 1 : 0);
}

const stills = arg("--stills");
if (stills) {
  const dir = path.join(out, arg("--stills-dir", "stills")); fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(",").map(Number)) {
    await page.evaluate((t) => window.renderAt(t), s);
    await page.screenshot({ path: path.join(dir, `t${String(s).replace(".", "_")}.png`) });
  }
  console.log("stills →", dir, errors.length ? errors : "");
  await browser.close(); process.exit(errors.length ? 1 : 0);
}

const t0 = +arg("--from", 0), t1 = +arg("--to", TL.duration);
const n = Math.ceil((t1 - t0) * FPS), name = arg("--name") || (t0 === 0 && t1 === TL.duration ? "lie-group-intro.mp4" : `clip-${t0}-${t1}.mp4`);
const target = path.join(out, name);
const ff = spawn("ffmpeg", ["-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-ss", String(t0), "-t", String(t1 - t0), "-i", path.join(out, audioFile),
  "-map", "0:v", "-map", "1:a",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
  "-shortest", "-movflags", "+faststart", target], { stdio: ["pipe", "inherit", "inherit"] });
const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));
const started = Date.now();
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.renderAt(t), t0 + i / FPS);
  await write(await page.screenshot({ type: "jpeg", quality: 93 }));
  if (i % 300 === 0) console.log(`帧 ${i}/${n}（${((Date.now() - started) / 1000).toFixed(0)} s）`);
}
ff.stdin.end();
const code = await new Promise((res) => ff.on("close", res));
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(code === 0 ? `完成：${target}（${n} 帧，${((Date.now() - started) / 1000).toFixed(0)} s）` : `ffmpeg 退出码 ${code}`);
process.exit(code);
