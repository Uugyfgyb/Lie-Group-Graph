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
const LABS = ["lab-jiu", "lab-fu", "lab-kuai", "lab-bi", "lab-chain", "lab-fei", "lab-lu"];

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
    const panels = [...document.querySelectorAll('[id$="-panel"]')].map((p) => ({ id: p.id, len: p.textContent.trim().length }));
    const bars = document.querySelectorAll(".barcell").length;
    const bg = getComputedStyle(document.body).backgroundColor;
    return { overflow, wide, canv, panels, bars, bg, title: document.title };
  });
  for (const c of r.canv) if (c.inkFrac < 0.005) fail.push(`${name}: 画布 ${c.id} 几乎是空的（${c.inkFrac}）`);
  for (const p of r.panels) if (p.len < 20) fail.push(`${name}: 题跋 ${p.id} 是空的`);
  if (r.panels.length !== 7) fail.push(`${name}: 题跋应有 7 个，实际 ${r.panels.length}`);
  if (r.bars !== 38) fail.push(`${name}: 表格墨条应有 38 格，实际 ${r.bars}`);
  if (r.overflow > 0) fail.push(`${name}: 横向溢出 ${r.overflow}px ${r.wide.join(" ")}`);
  if (net.length) fail.push(`${name}: 有网络请求 ${net.join(", ")}`);
  if (errs.length) fail.push(`${name}: 脚本报错 ${errs.join(" | ")}`);
  await page.screenshot({ path: path.join(out, `${name}-top.png`) });
  if (name === "desktop-light") await page.screenshot({ path: path.join(root, "preview.png") });
  if (name === "mobile-light") await page.screenshot({ path: path.join(root, "preview-mobile.png") });
  for (const id of LABS) {
    await page.locator("#" + id).scrollIntoViewIfNeeded(); await page.waitForTimeout(120);
    await page.locator("#" + id).screenshot({ path: path.join(out, `${name}-${id}.png`) });
  }
  if (!name.startsWith("desktop")) await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });
  // 交互：动一动每个控件，看读数是否跟着变
  if (name === "desktop-light") {
    const txt = (id) => page.locator("#" + id).innerText();
    const steps = [];
    const note = (control, before, after) => { steps.push({ control, changed: before !== after }); if (before === after) fail.push(`${control} 动了，读数没变`); };
    const setRange = async (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, [id, String(v)]);
    for (const [id, panel, v] of [["jiu-t", "jiu-panel", 1.5], ["fu-t", "fu-panel", 2], ["kuai-s", "kuai-panel", 1], ["kuai-s", "kuai-panel", 3], ["chain-n", "chain-panel", 5], ["fei-ne", "fei-panel", 3]]) {
      const before = await txt(panel); await setRange(id, v); note(`${id}=${v}`, before, await txt(panel));
    }
    // 转动走完时 A₁、A₂ 的系数应为 0；矩阵在 s = 3 时对角
    await setRange("jiu-t", 2);
    const jiuEnd = await txt("jiu-panel"); steps.push({ control: "jiu-t=2", text: jiuEnd.slice(0, 160) });
    if (!/\(0\.00, 0\.00, /.test(jiuEnd)) fail.push("jiu 转完后前两个系数不是 0");
    const kuaiEnd = await txt("kuai-panel"); if (!/对角线外[\s\S]*?0\.000/.test(kuaiEnd)) fail.push("kuai 在 s = 3 时对角线外不为 0");
    for (const [sel, panel] of [['#fu-sec [data-k="2"]', "fu-panel"], ["#fu-flat", "fu-panel"], ["#fu-ex", "fu-panel"], ['#bi-pre [data-k="ctx"]', "bi-panel"], ['#bi-pre [data-k="ac"]', "bi-panel"], ['#bi-pick [data-s="XY"]', "bi-panel"], ['#chain-mode [data-k="fc"]', "chain-panel"], ['#fei-v [data-k="11"]', "fei-panel"], ["#lu-one", "lu-panel"], ["#lu-many", "lu-panel"], ['#lu-mode [data-k="a"]', "lu-panel"], ["#lu-reset", "lu-panel"]]) {
      const before = await txt(panel); await page.click(sel); note(sel, before, await txt(panel));
    }
    // 动态电路：测 200 次后平均值与准确值相差不到 4 个标准误
    await page.click("#lu-many"); await page.click("#lu-many");
    const luText = await txt("lu-panel"), dev = +(luText.match(/偏差\s*([\d.]+) 个标准误/) || [])[1];
    steps.push({ control: "lu 400 shots", deviationSE: dev }); if (!(dev < 4)) fail.push(`lu 测 400 次后偏差 ${dev} 个标准误`);
    // “系数是数”之后矩阵面板的泡利项应只剩 4 个（含常数项）
    await page.click("#fu-flat"); await setRange("kuai-s", 0);
    const flatTerms = await page.locator("#kuai-panel .terms li").count(); steps.push({ control: "fu-flat → kuai terms", count: flatTerms });
    if (flatTerms !== 4) fail.push(`系数是数时原始 H 应剩 4 项，实际 ${flatTerms}`);
    await page.click("#fu-ex");
    // 播放
    await page.locator("#fu-play").scrollIntoViewIfNeeded();
    await page.click("#fu-play"); await page.waitForTimeout(700); await page.click("#fu-play");
    const ft = await page.locator("#fu-t").inputValue(); steps.push({ control: "fu-play", value: ft }); if (+ft === 0) fail.push("fu-play 没有推动转动");
    await page.locator("#lab-fu").screenshot({ path: path.join(out, "desktop-light-fu-mid.png") });
    // 术语弹注
    await page.click('.term[data-g="noncontext"]'); const popVisible = await page.locator("#pop").isVisible(); const popTitle = await page.locator("#pop-title").innerText();
    steps.push({ control: "term:noncontext", popVisible, popTitle }); if (!popVisible) fail.push("术语弹注没有出现");
    await page.screenshot({ path: path.join(out, "desktop-light-pop.png") });
    await page.keyboard.press("Escape");
    // 拖动“符”图里的一支箭头：t = 0 时拖箭头应改变扇区的系数
    await page.click("#fu-ex"); await setRange("fu-t", 0);
    await page.locator("#fu").scrollIntoViewIfNeeded();
    const tip = await page.evaluate(() => { const c = document.getElementById("fu"); const b = c.getBoundingClientRect(); return { x: b.x, y: b.y }; });
    const before = await txt("fu-panel");
    const tips = await page.evaluate(() => window.__fuTips || null);
    if (tips) { await page.mouse.move(tip.x + tips[0][0], tip.y + tips[0][1]); await page.mouse.down(); await page.mouse.move(tip.x + tips[0][0] + 40, tip.y + tips[0][1] - 30, { steps: 6 }); await page.mouse.up(); }
    const after = await txt("fu-panel"); steps.push({ control: "drag fu arrow", changed: before !== after });
    if (!tips) fail.push("拿不到箭头位置（window.__fuTips）"); else if (before === after) fail.push("拖动箭头后读数没变");
    await page.locator("#lab-fu").screenshot({ path: path.join(out, "desktop-light-fu-dragged.png") });
    await page.locator("#lab-kuai").screenshot({ path: path.join(out, "desktop-light-kuai-after-drag.png") });
    results.push({ name, steps });
  }
  results.push({ name, ...r, net: net.length, errors: errs });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(root, "qa-browser.json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: executablePath || "msedge", fail, results }, null, 2) + "\n");
if (fail.length) { console.error(fail.join("\n")); process.exit(1); }
console.log("浏览器自检通过：" + results.filter((r) => r.title).map((r) => r.name).join(", "));
