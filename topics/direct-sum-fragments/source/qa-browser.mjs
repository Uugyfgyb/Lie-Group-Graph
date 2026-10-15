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

const LABS = ["lab-so5", "lab-he", "lab-cheng", "lab-tu", "lab-circ", "lab-shots", "lab-guo"];
const results = [];
const fail = [];
for (const [name, vp, scheme] of [["desktop-light", { width: 1366, height: 900 }, "light"], ["desktop-dark", { width: 1366, height: 900 }, "dark"], ["mobile-light", { width: 390, height: 844 }, "light"], ["mobile-dark", { width: 390, height: 844 }, "dark"]]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: vp.width < 500 ? 2 : 1 });
  const page = await ctx.newPage();
  const net = [], errs = [];
  page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) net.push(r.url()); });
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text()); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const loadMs = Date.now() - t0;
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
  for (const p of r.panels) if (p.len < 20) fail.push(`${name}: 题跋 ${p.id || "(无 id)"} 是空的`);
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
  if (name.startsWith("mobile")) await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });

  // 交互：动一动每个控件，看读数是否跟着变
  if (name === "desktop-light") {
    const steps = [];
    const txt = (id) => page.locator("#" + id).innerText();
    const setRange = async (id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, [id, String(v)]);
    const expectChange = async (label, panel, act) => { const before = await txt(panel); await act(); await page.waitForTimeout(60); const after = await txt(panel); steps.push({ control: label, changed: before !== after }); if (before === after) fail.push(`${label} 动了，${panel} 没变`); return after; };
    // 代：so(5)
    await expectChange("so5-t", "so5-panel", () => setRange("so5-t", 450));
    const end = await expectChange("so5-t→end", "so5-panel", () => setRange("so5-t", 1000));
    if (!/剩下/.test(end)) fail.push("so5 转完以后没有给出剩下的两项");
    for (const k of ["star", "all"]) await expectChange("so5-kind:" + k, "so5-panel", () => page.click(`#so5-kind [data-k="${k}"]`));
    await expectChange("so5-new", "so5-panel", () => page.click("#so5-new"));
    await page.click("#so5-play"); await page.waitForTimeout(900); await page.click("#so5-play");
    { const v = +(await page.locator("#so5-t").inputValue()); steps.push({ control: "so5-play", value: v }); if (v === 0) fail.push("so5-play 没有推动进度"); }
    // 和：拖动第一个圆盘，再转
    await page.locator("#dials").scrollIntoViewIfNeeded();
    const db = await page.locator("#dials").boundingBox();
    await expectChange("dials:drag", "he-panel", async () => { await page.mouse.move(db.x + db.width * 0.27 + 30, db.y + db.height * 0.5 - 30); await page.mouse.down(); await page.mouse.move(db.x + db.width * 0.27 + 70, db.y + db.height * 0.5 - 10, { steps: 5 }); await page.mouse.up(); });
    await page.click("#he-play"); await page.waitForTimeout(2600);
    { const t = await txt("he-panel"); steps.push({ control: "he-play", done: /贝尔测量/.test(t) }); if (!/贝尔测量/.test(t)) fail.push("he-play 转完以后没有提到贝尔测量"); }
    await expectChange("he-reset", "he-panel", () => page.click("#he-reset"));
    // 称：点另一个扇区
    await page.locator("#sectors").scrollIntoViewIfNeeded();
    const sb = await page.locator("#sectors").boundingBox();
    await expectChange("sectors:click", "cheng-panel", () => page.mouse.click(sb.x + sb.width * 0.125, sb.y + sb.height * 0.25));
    // 图：逐个预设，收拢孪生类，自己连两条边
    for (const k of ["fig1", "fig2", "claw", "spider", "h2", "fig3"]) await expectChange("tu-preset:" + k, "tu-text", () => page.click(`#tu-preset [data-k="${k}"]`));
    await page.click('#tu-view [data-k="q"]'); await page.waitForTimeout(800);
    await page.locator("#lab-tu").screenshot({ path: path.join(out, "desktop-light-tu-quotient.png") });
    await page.click('#tu-view [data-k="g"]'); await page.waitForTimeout(800);
    await page.click('#tu-preset [data-k="blank"]');
    const gb = await page.locator("#graph").boundingBox();
    const vpos = await page.evaluate(() => { const c = document.getElementById("graph"), w = c.clientWidth, h = c.clientHeight, s = Math.min((w - 68) / 400, (h - 68) / 300), ox = (w - 400 * s) / 2, oy = (h - 300 * s) / 2; return Presets.graphs.find((g) => g.id === "blank").pos.map(([x, y]) => [ox + x * s, oy + y * s]); });
    const clickV = (i) => page.mouse.click(gb.x + vpos[i][0], gb.y + vpos[i][1]);
    await expectChange("graph:edge 0–1", "tu-text", async () => { await clickV(0); await clickV(1); });
    await expectChange("graph:edge 1–2", "tu-text", async () => { await clickV(1); await clickV(2); });
    { const t = await txt("tu-text"); if (!/2 条边/.test(t)) fail.push("自己连两条边后读数不是 2 条边：" + t.slice(0, 60)); }
    // 线：态与重抽
    await expectChange("sh-a", "sh-panel", () => setRange("sh-a", 0));
    await expectChange("sh-ground", "sh-panel", () => page.click("#sh-ground"));
    { const t = await txt("sh-panel"); if (!/方差为 0/.test(t)) fail.push("回到基态后没有说 NC 方差为 0"); }
    await setRange("sh-a", -250); await expectChange("sh-again", "sh-panel", () => page.click("#sh-again"));
    // 果：分子与表
    for (const k of ["H2", "BeH2", "H2O", "NH3"]) await expectChange("guo-mol:" + k, "guo-panel", () => page.click(`#guo-mol [data-k="${k}"]`));
    await page.click('#guo-mol [data-k="H2"]');
    { const t = await txt("guo-panel"); steps.push({ control: "H2 repro", ok: /十个数与论文一致/.test(t) }); if (!/十个数与论文一致/.test(t)) fail.push("H₂ 重算没有与论文一致：" + t.slice(0, 120)); }
    await page.locator("#lab-guo").screenshot({ path: path.join(out, "desktop-light-guo-H2.png") });
    await expectChange("guo-tab:II", "bars-title", () => page.click('#guo-tab [data-k="II"]'));
    // 术语弹注
    await page.click('.term[data-g="linegraph"]'); const popVisible = await page.locator("#pop").isVisible(); const popTitle = await page.locator("#pop-title").innerText();
    steps.push({ control: "term:linegraph", popVisible, popTitle }); if (!popVisible) fail.push("术语弹注没有出现");
    await page.screenshot({ path: path.join(out, "desktop-light-pop.png") });
    if (errs.length) fail.push(`${name}: 交互中脚本报错 ${errs.join(" | ")}`);
    results.push({ name, steps });
  }
  results.push({ name, loadMs, ...r, net: net.length, errors: errs });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(root, "qa-browser.json"), JSON.stringify({ date: new Date().toISOString().slice(0, 10), browser: executablePath || "msedge", fail, results }, null, 2) + "\n");
if (fail.length) { console.error(fail.join("\n")); process.exit(1); }
console.log("浏览器自检通过：" + results.filter((r) => r.title).map((r) => `${r.name}（${r.loadMs} ms）`).join(", "));
