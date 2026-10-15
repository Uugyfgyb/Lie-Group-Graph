// 把 page.html + ink.css + solv.js + ink.js + app.js + KaTeX 公式与字体合成一个可直接打开的单文件页面。
// 输出：../index.html（完整文档，离线可开）与 ../artifact.html（同一内容去掉 html/head/body 外壳和回目录的链接，供 claude.ai Artifact 发布；不入库）。
// 运行：node source/build.mjs（或 deno run -A source/build.mjs；先 npm install / deno install）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import katex from "katex";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const read = (f) => fs.readFileSync(path.join(here, f), "utf8");
const katexDist = path.dirname(require.resolve("katex/dist/katex.min.css"));

let html = read("page.html");

// ---- 1. 公式编号：<div class="eq" data-label="x" data-paper="20">$$…$$</div> 依出现顺序编号；
//      data-paper 是论文里的式号，写在本页编号下面；{{eq:x}} 换成带链接的“式 (n)” ----
const labels = new Map();
html = html.replace(/<div class="eq" data-label="([\w-]+)"(?: data-paper="([^"]+)")?>\s*(\$\$[\s\S]+?\$\$)\s*<\/div>/g, (_, key, paper, body) => {
  if (labels.has(key)) throw new Error("公式标签重复：" + key);
  labels.set(key, labels.size + 1);
  return `<div class="eq" id="eq-${key}">${body}<span class="eq-no">(${labels.size})${paper ? `<small>原文 (${paper})</small>` : ""}</span></div>`;
});
if (/data-label=/.test(html)) throw new Error("有 data-label 没被识别（检查 .eq 的写法）");
const used = new Set();
html = html.replace(/\{\{eq:([\w-]+)\}\}/g, (_, key) => {
  if (!labels.has(key)) throw new Error("引用了不存在的公式标签：" + key);
  used.add(key);
  return `<a class="eqref" href="#eq-${key}">式 (${labels.get(key)})</a>`;
});

// ---- 2. 公式：构建时用 KaTeX 渲染成静态 HTML（页面里不需要 KaTeX 脚本）----
let formulaCount = 0;
const strict = (code) => (code === "unknownSymbol" || code === "unicodeTextInMathMode" ? "ignore" : "error");
const tex = (src, displayMode) => { formulaCount++; return katex.renderToString(src.trim(), { displayMode, throwOnError: true, strict, output: "htmlAndMathml" }); };
html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, src) => tex(src, true));
// 行内公式紧挨着中文标点时，把标点并进公式，免得标点单独掉到下一行开头
html = html.replace(/(（?)\\\(([\s\S]+?)\\\)([，。；：、）？！]*)/g, (_, pre, src, post) =>
  tex((pre ? `\\text{${pre}}` : "") + src.trim() + (post ? `\\text{${post}}` : ""), false));

// 术语按钮后面紧跟的中文标点和按钮绑在一起，免得标点落到下一行开头
html = html.replace(/(<button type="button" class="term"(?:(?!<\/button>)[\s\S])*<\/button>)([，。；：、）？！]+)/g, '<span class="nobr">$1$2</span>');

// ---- 3. 术语注释：正文里每个 data-g 都要在总表里有一条，总表里每一条都要被用到 ----
const defined = [...html.matchAll(/class="gl" id="g-([\w-]+)"/g)].map((m) => m[1]);
const asked = new Set([...html.matchAll(/class="term" data-g="([\w-]+)"/g)].map((m) => m[1]));
if (new Set(defined).size !== defined.length) throw new Error("总表里有重复条目");
for (const k of asked) if (!defined.includes(k)) throw new Error("术语没有注释：" + k);
for (const k of defined) if (!asked.has(k)) throw new Error("总表里这一条正文没有用到：" + k);
// 总表按正文首次出现的先后排列
const firstUse = (k) => html.indexOf(`data-g="${k}"`);
const order = defined.map((k) => [k, firstUse(k)]);
for (let i = 1; i < order.length; i++) if (order[i][1] < order[i - 1][1]) throw new Error(`总表顺序与正文不符：${order[i - 1][0]} 应在 ${order[i][0]} 之后`);
const zhuCount = (html.match(/class="zhu"/g) || []).length;

// ---- 4. KaTeX 样式与字体：只内嵌用得到的 woff2（画布标注要用 Main、Math、Fraktur，必留）----
const uses = (re) => re.test(html);
const KEEP = ["KaTeX_Main-Regular", "KaTeX_Math-Italic", "KaTeX_Size1-Regular", "KaTeX_Size2-Regular", "KaTeX_Size3-Regular", "KaTeX_Size4-Regular", "KaTeX_Fraktur-Regular"];
if (uses(/class="[^"]*\b(amsrm|mathbb)\b/)) KEEP.push("KaTeX_AMS-Regular");
if (uses(/class="[^"]*\b(mathbf|textbf)\b/)) KEEP.push("KaTeX_Main-Bold");
if (uses(/class="[^"]*\b(mathit|textit)\b/)) KEEP.push("KaTeX_Main-Italic");
if (uses(/class="[^"]*\bboldsymbol\b/)) KEEP.push("KaTeX_Math-BoldItalic");
if (uses(/class="[^"]*\bmathsf\b/)) KEEP.push("KaTeX_SansSerif-Regular");
if (uses(/class="[^"]*\bmathcal\b/)) KEEP.push("KaTeX_Caligraphic-Regular");
const embedded = [];
const katexCss = fs.readFileSync(path.join(katexDist, "katex.min.css"), "utf8").replace(/@font-face\{[^}]*\}/g, (block) => {
  const m = block.match(/url\(fonts\/([\w-]+)\.woff2\)/);
  if (!m || !KEEP.includes(m[1])) return "";
  const b64 = fs.readFileSync(path.join(katexDist, "fonts", m[1] + ".woff2")).toString("base64");
  embedded.push(m[1]);
  return block.replace(/src:[^;}]+/, () => `src:url(data:font/woff2;base64,${b64}) format("woff2")`);
});
if (embedded.length !== KEEP.length) throw new Error("KaTeX 字体内嵌不完整：" + embedded.join(","));
if (/url\((?!data:)/.test(katexCss)) throw new Error("KaTeX 样式中仍有外部 url()");

// ---- 5. 内嵌样式和脚本 ----
const put = (mark, text) => { if (!html.includes(mark)) throw new Error("模板缺少占位符 " + mark); html = html.replace(mark, () => text); };
put("/*__KATEX_CSS__*/", katexCss);
put("/*__CSS__*/", read("ink.css"));
put("/*__SOLV__*/", read("solv.js"));
put("/*__INK__*/", read("ink.js"));
put("/*__APP__*/", read("app.js"));

// ---- 6. 自检 ----
const bodyOnly = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
if (/\{\{|\$\$|\\\(|\\\)/.test(bodyOnly)) throw new Error("正文里还有没处理的占位符或公式定界符");
// 页面不得依赖在线资源：外链的脚本、样式、图片、字体、@import 一律拒绝；只放行参考文献的 <a href>
const external = [...html.matchAll(/<(?!a\s)[a-z]+[^>]*\s(?:src|href)="(https?:[^"]+)"|url\(\s*["']?(https?:[^)"']+)|@import\s+["']?(https?:[^"';]+)/g)].map((m) => m[1] || m[2] || m[3]);
if (external.length) throw new Error("页面引用了在线资源：" + external.join(", "));
const ids = [...bodyOnly.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dup.length) throw new Error("id 重复：" + dup.join(","));

fs.writeFileSync(path.join(here, "..", "index.html"), html);
// Artifact 版：发布时平台会套上自己的 <!doctype><head><body>，这里只留 <title>、<style> 和 body 里的内容
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = [...html.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0]).join("\n");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<!--repo-only-->[\s\S]*?<!--\/repo-only-->/g, "");
fs.writeFileSync(path.join(here, "..", "artifact.html"), `${title}\n${styles}\n${body}`);
console.log(JSON.stringify({ bytes: Buffer.byteLength(html), formulas: formulaCount, numbered: labels.size, zhu: zhuCount, glossary: defined.length, fonts: embedded, unreferencedLabels: [...labels.keys()].filter((k) => !used.has(k)) }, null, 2));
