// 浏览器自检：桌面与手机宽度、浅色与深色各开一次，确认零网络请求、零脚本错误、页面不横向溢出、每块画布都画上了墨；
// 再动一动每个控件，确认读数会变。截图写到 ../qa/（不入库），首屏另存为 ../preview.png 与 ../preview-mobile.png，结果写到 ../qa-browser.json。
// 运行：node source/qa-browser.mjs（或 deno run -A source/qa-browser.mjs）。可用 CHROME=路径 指定浏览器。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const out = path.join(root, "qa"); fs.mkdirSync(out, { recursive: true });
const candidates = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Users/fujia/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe"].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
const browser = await chromium.launch(executablePath ? { executablePath } : { channel: "msedge" });

const results = [];
const fail = [];
for (const [name, vp, scheme] of [["desktop-light", { width: 1366, height: 900 }, "light"], ["desktop-dark", { width: 1366, height: 900 }, "dark"], ["mobile-light", { width: 390, height: 844 }, "light"], ["mobile-dark", { width: 390, height: 844 }, "dark"]]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: vp.width < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  const net = [], errs = [];
  page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) net.push(r.url()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((el) => { const b = el.getBoundingClientRect(); return b.right > doc.clientWidth + 1 && !el.closest(".tbl-wrap, .eq, #pop") && getComputedStyle(el).position !== "absolute"; }).slice(0, 5).map((el) => el.tagName + "." + el.className);
    const canv = [...document.querySelectorAll("canvas")].map((c) => {
      const g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data; let ink = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 40) ink++;
      return { id: c.id, w: c.width, h: c.height, inkFrac: +(ink / (d.length / 16)).toFixed(4) };
    });
    const panels = [...document.querySelectorAll(".panel")].map((p) => ({ id: p.id, len: p.textContent.trim().length }));
    const bg = getComputedStyle(document.body).backgroundColor;
    return { overflow, wide, canv, panels, bg, title: document.title };
  });
  for (const c of r.canv) if (c.inkFrac < 0.005) fail.push(`${name}: 画布 ${c.id} 几乎是空的（${c.inkFrac}）`);
  for (const p of r.panels) if (p.len < 20) fail.push(`${name}: 题跋 ${p.id} 是空的`);
  if (r.overflow > 0) fail.push(`${name}: 横向溢出 ${r.overflow}px ${r.wide.join(" ")}`);
  if (net.length) fail.push(`${name}: 有网络请求 ${net.join(", ")}`);
  if (errs.length) fail.push(`${name}: 脚本报错 ${errs.join(" | ")}`);
  await page.screenshot({ path: path.join(out, `${name}-top.png`) });
  if (name === "desktop-light") await page.screenshot({ path: path.join(root, "preview.png") });
  if (name === "mobile-light") await page.screenshot({ path: path.join(root, "preview-mobile.png") });
  if (name.startsWith("desktop")) {
    for (const id of ["lab-lian", "lab-qie", "lab-juan", "lab-liu", "lab-kuo", "lab-fu", "lab-loop"]) {
      await page.locator("#" + id).scrollIntoViewIfNeeded(); await page.waitForTimeout(120);
      await page.locator("#" + id).screenshot({ path: path.join(out, `${name}-${id}.png`) });
    }
  } else {
    await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });
  }
  // 交互：动一动每个控件，看读数是否跟着变
  if (name === "desktop-light") {
    const txt = (id) => page.locator("#" + id).innerText();
    const steps = [];
    const setRange = async (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, [id, String(v)]);
    for (const [id, panel, v] of [["lian-n", "lian-panel", 25], ["lian-th", "lian-panel", 120], ["qie-k", "qie-panel", 900], ["juan-n", "juan-panel", 14], ["juan-th", "juan-panel", 5.5], ["liu-t", "liu-panel", -1.3], ["kuo-e", "kuo-panel", 5], ["fu-th", "fu-panel", 540], ["loop-s", "loop-panel", 2]]) {
      const before = await txt(panel); await setRange(id, v); const after = await txt(panel);
      steps.push({ control: id, changed: before !== after }); if (before === after) fail.push(`${id} 动了，${panel} 没变`);
    }
    for (const k of ["rot", "squeeze", "spiral"]) { const before = await txt("liu-panel"); await page.click(`#liu-kind [data-k="${k}"]`); const after = await txt("liu-panel"); steps.push({ control: "liu-kind:" + k, changed: before !== after }); if (before === after) fail.push(`liu-kind ${k} 没变`); }
    { const before = await txt("loop-panel"); await page.click(`#loop-kind [data-k="2"]`); const after = await txt("loop-panel"); steps.push({ control: "loop-kind:2", changed: before !== after }); if (before === after) fail.push("loop-kind 2 没变"); }
    // 播放：点“走一遍”，等一会儿，终点应出现
    await page.evaluate(() => document.getElementById("fu-th").scrollIntoView());
    await page.click("#fu-play"); await page.waitForTimeout(800); await page.click("#fu-play");
    const th = await page.locator("#fu-th").inputValue(); steps.push({ control: "fu-play", value: th }); if (+th === 540) fail.push("fu-play 没有推动 θ");
    // 术语弹注
    await page.click('.term[data-g="bracket"]'); const popVisible = await page.locator("#pop").isVisible(); const popTitle = await page.locator("#pop-title").innerText();
    steps.push({ control: "term:bracket", popVisible, popTitle }); if (!popVisible) fail.push("术语弹注没有出现");
    await page.screenshot({ path: path.join(out, "desktop-light-pop.png") });
    // 拖动球
    const box = await page.locator("#kuo").boundingBox();
    await page.locator("#kuo").scrollIntoViewIfNeeded();
    const b2 = await page.locator("#kuo").boundingBox();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await page.mouse.down(); await page.mouse.move(b2.x + b2.width / 2 + 80, b2.y + b2.height / 2 + 20, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(100);
    await page.locator("#lab-kuo").screenshot({ path: path.join(out, "desktop-light-kuo-dragged.png") });
    results.push({ name, steps });
  }
  results.push({ name, ...r, net: net.length, errors: errs });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(root, "qa-browser.json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: executablePath || "msedge", fail, results }, null, 2) + "\n");
if (fail.length) { console.error(fail.join("\n")); process.exit(1); }
console.log("浏览器自检通过：" + results.filter((r) => r.title).map((r) => r.name).join(", "));
